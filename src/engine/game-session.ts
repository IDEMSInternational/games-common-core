import { PuzzleGame } from './puzzle-game';
import { RandomState } from './random/random-state';
import { newSeed } from './random/seed';

/**
 * Everything needed to bring a session back exactly as it was: the
 * puzzle, and the moves made on it (null = "restart"). Plain data, so it
 * can be saved, e.g. to continue a game after the app is reopened.
 */
export interface SessionSnapshot<Move> {
  /** The parameters, in the game's text form (e.g. "7x7"). */
  readonly params: string;
  readonly seed: string;
  readonly description: string;
  readonly solution?: string;
  /** moves[i] leads from history entry i to i + 1. */
  readonly moves: readonly (Move | null)[];
  /** How far through the moves the player is (less than all after undo). */
  readonly position: number;
}

/**
 * One playing session of a game: the current puzzle and its move history.
 * This is the framework-free part of the container (the "midend" of the
 * original collection); the UI layer wraps it.
 */
export class GameSession<Params, State, Move> {
  private history: State[] = [];
  /** moves[i] produced history[i + 1]; null marks a restart. */
  private moves: (Move | null)[] = [];
  private position = 0;
  private solution: string | undefined;

  readonly game: PuzzleGame<Params, State, Move>;
  params: Params;
  seed = '';
  description = '';

  /**
   * Starts with a saved session if it can be restored, or else a new
   * puzzle (from `seed`, if given).
   */
  constructor(game: PuzzleGame<Params, State, Move>, params?: Params, seed?: string, saved?: SessionSnapshot<Move>) {
    this.game = game;
    this.params = params ?? game.defaultParams();
    if (!saved || !this.restore(saved)) this.newGame(undefined, seed);
  }

  get state(): State {
    return this.history[this.position];
  }

  get canUndo(): boolean {
    return this.position > 0;
  }

  get canRedo(): boolean {
    return this.position < this.history.length - 1;
  }

  get isCompleted(): boolean {
    return this.game.isCompleted(this.state);
  }

  /** Game ID that regenerates this exact puzzle, e.g. "7x7#123456789012345". */
  get gameId(): string {
    return `${this.game.encodeParams(this.params)}#${this.seed}`;
  }

  /** Starts a new random puzzle, optionally with new parameters or a given seed. */
  newGame(params?: Params, seed?: string): void {
    if (params) {
      const error = this.game.validateParams(params);
      if (error) throw new Error(error);
      this.params = params;
    }
    this.seed = seed ?? newSeed();
    const puzzle = this.game.generate(this.params, new RandomState(this.seed));
    this.description = puzzle.description;
    this.solution = puzzle.solution;
    this.history = [this.game.newGame(this.params, this.description)];
    this.moves = [];
    this.position = 0;
  }

  /** Applies a move. Returns false if the game rejected it. */
  move(move: Move): boolean {
    const next = this.game.applyMove(this.state, move);
    if (!next) return false;
    this.record(next, move);
    return true;
  }

  undo(): void {
    if (this.canUndo) this.position--;
  }

  redo(): void {
    if (this.canRedo) this.position++;
  }

  /** Returns to the start of the current puzzle (undoable). */
  restart(): void {
    if (this.position === 0) return;
    this.record(this.history[0], null);
  }

  /** Shows the solution (undoable). Returns false if no solution is known. */
  solve(): boolean {
    const move = this.game.solve(this.history[0], this.solution);
    return move !== null && this.move(move);
  }

  /** The session as plain data, for saving. */
  snapshot(): SessionSnapshot<Move> {
    return {
      params: this.game.encodeParams(this.params),
      seed: this.seed,
      description: this.description,
      solution: this.solution,
      moves: [...this.moves],
      position: this.position,
    };
  }

  /**
   * Brings back a saved session by replaying its moves through the game's
   * rules. Returns false, leaving the session unchanged, if the snapshot
   * isn't valid for this game (e.g. saved by an incompatible version).
   */
  restore(snapshot: SessionSnapshot<Move>): boolean {
    try {
      const params = this.game.decodeParams(snapshot.params);
      if (this.game.validateParams(params)) return false;
      if (this.game.validateDescription(params, snapshot.description)) return false;
      if (!Number.isInteger(snapshot.position) || snapshot.position < 0) return false;
      if (snapshot.position > snapshot.moves.length) return false;

      const history = [this.game.newGame(params, snapshot.description)];
      for (const move of snapshot.moves) {
        const next = move === null ? history[0] : this.game.applyMove(history[history.length - 1], move);
        if (!next) return false;
        history.push(next);
      }

      this.params = params;
      this.seed = snapshot.seed;
      this.description = snapshot.description;
      this.solution = snapshot.solution;
      this.history = history;
      this.moves = [...snapshot.moves];
      this.position = snapshot.position;
      return true;
    } catch {
      return false; // e.g. malformed moves
    }
  }

  /** Adds a state after the current one, discarding any redo history. */
  private record(next: State, move: Move | null): void {
    this.history = this.history.slice(0, this.position + 1);
    this.moves = this.moves.slice(0, this.position);
    this.history.push(next);
    this.moves.push(move);
    this.position++;
  }
}
