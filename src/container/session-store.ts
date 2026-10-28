import { Signal, WritableSignal, computed, signal } from '@angular/core';
import { GameSession, SessionSnapshot } from '../engine/game-session';
import { CustomField, PuzzleGame } from '../engine/puzzle-game';
import {
  readStored,
  readStoredJson,
  removeStored,
  storedSetting,
  writeStored,
  writeStoredJson,
} from './stored-setting';

/** What the puzzle shell needs from a game session, independent of the game's types. */
export interface ShellControls {
  /** The game's short id ("slant"), also its repository's name. */
  readonly id: string;
  readonly title: string;
  readonly presetNames: readonly string[];
  readonly presetIndex: Signal<number>;
  /** Difficulty level names; empty if the game has no difficulty levels. */
  readonly difficulties: readonly string[];
  readonly difficulty: Signal<number>;
  readonly gameId: Signal<string>;
  readonly canUndo: Signal<boolean>;
  readonly canRedo: Signal<boolean>;
  readonly completed: Signal<boolean>;
  /** True right after the player solves the puzzle themselves (not with Solve). */
  readonly celebrate: Signal<boolean>;
  /** Custom-puzzle settings, filled in from the current puzzle. */
  readonly customFields: Signal<readonly CustomField[]>;
  /** Whether the game supports "Show mistakes", and the player's setting for it. */
  readonly canShowMistakes: boolean;
  readonly showMistakes: WritableSignal<boolean>;
  newGame(presetIndex?: number): void;
  /** Starts a new puzzle of the current size at another difficulty. */
  setDifficulty(difficulty: number): void;
  /** Starts a custom puzzle. Returns an error message, or null on success. */
  newCustomGame(values: Readonly<Record<string, number>>): string | null;
  undo(): void;
  redo(): void;
  restart(): void;
  solve(): void;
}

/**
 * Makes a GameSession observable by Angular: every change bumps a version
 * signal, and the computed signals below re-read the session.
 *
 * Saves the game in progress on the device after every change, so after
 * a reload, or closing and reopening the app, the player continues where
 * they left off (undo history included). A finished puzzle isn't kept:
 * then, as when no saved game can be restored, a new puzzle starts at the
 * last size and difficulty played.
 * Create it in an injection context (e.g. a component field), since the
 * "Show mistakes" setting is remembered too.
 */
export class SessionStore<Params, State, Move> implements ShellControls {
  private readonly session: GameSession<Params, State, Move>;
  private readonly game: PuzzleGame<Params, State, Move>;
  private readonly version = signal(0);
  private readonly paramsKey: string;
  private readonly savedGameKey: string;
  readonly celebrate = signal(false);

  readonly id: string;
  readonly title: string;
  readonly presetNames: readonly string[];
  readonly difficulties: readonly string[];
  readonly canShowMistakes: boolean;
  readonly showMistakes: WritableSignal<boolean>;

  readonly state = this.read(() => this.session.state);
  readonly gameId = this.read(() => this.session.gameId);
  readonly canUndo = this.read(() => this.session.canUndo);
  readonly canRedo = this.read(() => this.session.canRedo);
  readonly completed = this.read(() => this.session.isCompleted);
  readonly customFields = this.read(() => this.game.customFields(this.session.params));
  readonly difficulty = this.read(() => this.game.difficultyOf?.(this.session.params) ?? 0);
  readonly presetIndex = this.read(() => {
    const current = this.game.encodeParams(this.session.params);
    return this.game.presets().findIndex((p) => this.game.encodeParams(this.atCurrentDifficulty(p.params)) === current);
  });

  constructor(game: PuzzleGame<Params, State, Move>) {
    this.game = game;
    this.paramsKey = `${game.id}.size`;
    this.savedGameKey = `${game.id}.game`;
    this.session = new GameSession(game, this.rememberedParams());
    const saved = readStoredJson<SessionSnapshot<Move>>(this.savedGameKey);
    if (saved && this.session.restore(saved) && this.session.isCompleted) {
      this.session.newGame(); // a finished puzzle (saved by an older version): start afresh
    }
    this.save();
    this.id = game.id;
    this.title = game.name;
    this.presetNames = game.presets().map((p) => p.name);
    this.difficulties = game.difficulties ?? [];
    this.canShowMistakes = game.canShowMistakes ?? false;
    this.showMistakes = storedSetting(`${game.id}.showMistakes`);
  }

  newGame(presetIndex?: number): void {
    const preset = presetIndex === undefined ? undefined : this.game.presets()[presetIndex];
    this.startGame(preset && this.atCurrentDifficulty(preset.params));
  }

  setDifficulty(difficulty: number): void {
    if (!this.game.withDifficulty) return;
    this.startGame(this.game.withDifficulty(this.session.params, difficulty));
  }

  newCustomGame(values: Readonly<Record<string, number>>): string | null {
    for (const field of this.game.customFields(this.session.params)) {
      const value = values[field.key];
      if (!Number.isInteger(value) || value < field.min || value > field.max) {
        return `${field.label} must be a whole number from ${field.min} to ${field.max}`;
      }
    }
    const params = this.atCurrentDifficulty(this.game.customParams(values));
    const error = this.game.validateParams(params);
    if (!error) this.startGame(params);
    return error;
  }

  move(move: Move): void {
    const wasCompleted = this.session.isCompleted;
    this.change(() => this.session.move(move));
    if (!wasCompleted && this.session.isCompleted) this.celebrate.set(true);
  }

  undo(): void {
    this.change(() => this.session.undo());
  }

  redo(): void {
    this.change(() => this.session.redo());
  }

  restart(): void {
    this.change(() => this.session.restart());
  }

  solve(): void {
    this.change(() => this.session.solve());
  }

  /** A new puzzle (with new parameters, if given). */
  private startGame(params?: Params): void {
    this.change(() => this.session.newGame(params));
  }

  /** The size and difficulty last played on this device, if any and still valid. */
  private rememberedParams(): Params | undefined {
    const text = readStored(this.paramsKey);
    if (!text) return undefined;
    const params = this.game.decodeParams(text);
    return this.game.validateParams(params) ? undefined : params;
  }

  /** The given size, at the difficulty currently being played. */
  private atCurrentDifficulty(params: Params): Params {
    const game = this.game;
    if (!game.withDifficulty || !game.difficultyOf) return params;
    return game.withDifficulty(params, game.difficultyOf(this.session.params));
  }

  private change(action: () => void): void {
    this.celebrate.set(false); // only a winning move (in move()) sets it
    action();
    this.save();
    this.version.update((v) => v + 1);
  }

  /**
   * Saves the game in progress, to continue it after a reload. A finished
   * one is forgotten, keeping only its size for the next puzzle.
   */
  private save(): void {
    writeStored(this.paramsKey, this.game.encodeParams(this.session.params));
    if (this.session.isCompleted) removeStored(this.savedGameKey);
    else writeStoredJson(this.savedGameKey, this.session.snapshot());
  }

  private read<T>(get: () => T): Signal<T> {
    return computed(() => {
      this.version();
      return get();
    });
  }
}
