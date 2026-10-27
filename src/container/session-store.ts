import { Signal, WritableSignal, computed, signal } from '@angular/core';
import { GameSession } from '../engine/game-session';
import { CustomField, PuzzleGame } from '../engine/puzzle-game';
import { storedSetting } from './stored-setting';

/** What the puzzle shell needs from a game session, independent of the game's types. */
export interface ShellControls {
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
 * Create it in an injection context (e.g. a component field), since the
 * "Show mistakes" setting is remembered on the device.
 */
export class SessionStore<Params, State, Move> implements ShellControls {
  private readonly session: GameSession<Params, State, Move>;
  private readonly game: PuzzleGame<Params, State, Move>;
  private readonly version = signal(0);

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
    this.session = new GameSession(game);
    this.title = game.name;
    this.presetNames = game.presets().map((p) => p.name);
    this.difficulties = game.difficulties ?? [];
    this.canShowMistakes = game.canShowMistakes ?? false;
    this.showMistakes = storedSetting(`${game.id}.showMistakes`);
  }

  newGame(presetIndex?: number): void {
    const preset = presetIndex === undefined ? undefined : this.game.presets()[presetIndex];
    this.change(() => this.session.newGame(preset && this.atCurrentDifficulty(preset.params)));
  }

  setDifficulty(difficulty: number): void {
    if (!this.game.withDifficulty) return;
    const params = this.game.withDifficulty(this.session.params, difficulty);
    this.change(() => this.session.newGame(params));
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
    if (!error) this.change(() => this.session.newGame(params));
    return error;
  }

  move(move: Move): void {
    this.change(() => this.session.move(move));
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

  /** The given size, at the difficulty currently being played. */
  private atCurrentDifficulty(params: Params): Params {
    const game = this.game;
    if (!game.withDifficulty || !game.difficultyOf) return params;
    return game.withDifficulty(params, game.difficultyOf(this.session.params));
  }

  private change(action: () => void): void {
    action();
    this.version.update((v) => v + 1);
  }

  private read<T>(get: () => T): Signal<T> {
    return computed(() => {
      this.version();
      return get();
    });
  }
}
