import { PuzzleGame } from './puzzle-game';
import { RandomState } from './random/random-state';
import { newSeed } from './random/seed';

/**
 * One playing session of a game: the current puzzle and its move history.
 * This is the framework-free part of the container (the "midend" of the
 * original collection); the UI layer wraps it.
 */
export class GameSession<Params, State, Move> {
  private history: State[] = [];
  private position = 0;
  private solution: string | undefined;

  readonly game: PuzzleGame<Params, State, Move>;
  params: Params;
  seed = '';
  description = '';

  constructor(game: PuzzleGame<Params, State, Move>, params?: Params) {
    this.game = game;
    this.params = params ?? game.defaultParams();
    this.newGame();
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
    this.position = 0;
  }

  /** Applies a move. Returns false if the game rejected it. */
  move(move: Move): boolean {
    const next = this.game.applyMove(this.state, move);
    if (!next) return false;
    this.history = this.history.slice(0, this.position + 1);
    this.history.push(next);
    this.position++;
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
    this.history = this.history.slice(0, this.position + 1);
    this.history.push(this.history[0]);
    this.position++;
  }

  /** Shows the solution (undoable). Returns false if no solution is known. */
  solve(): boolean {
    const move = this.game.solve(this.history[0], this.solution);
    return move !== null && this.move(move);
  }
}
