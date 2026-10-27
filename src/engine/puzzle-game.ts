import { RandomState } from './random/random-state';

/** A named set of parameters offered in the game's size/difficulty menu. */
export interface Preset<Params> {
  readonly name: string;
  readonly params: Params;
}

/** A setting the player can choose when making a custom puzzle. */
export interface CustomField {
  readonly key: string;
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly value: number;
}

/** What a generator produces: the puzzle itself, plus its solution. */
export interface GeneratedPuzzle {
  /** Compact text form of the puzzle, e.g. "b3_2e5b4j2b8a4c3c4_2_4a2_2a2c2a". */
  readonly description: string;
  /** Compact text form of the solution, if the generator knows it. */
  readonly solution?: string;
}

/**
 * The contract between a game and the shared container. A game supplies
 * these framework-free functions; the container supplies everything common
 * to all games (new game, undo/redo, menus, saving, ...).
 *
 * Modelled on the `game` struct in the original collection's puzzles.h.
 * States are treated as immutable: applyMove returns a new state.
 */
export interface PuzzleGame<Params, State, Move> {
  readonly id: string;
  readonly name: string;

  // Parameters
  defaultParams(): Params;
  presets(): readonly Preset<Params>[];
  encodeParams(params: Params): string;
  decodeParams(text: string): Params;
  /** Returns an error message, or null if the parameters are usable. */
  validateParams(params: Params): string | null;
  /** Settings offered for a custom puzzle, filled in from `params`. */
  customFields(params: Params): readonly CustomField[];
  /** Parameters from the player's custom settings, keyed by CustomField.key. */
  customParams(values: Readonly<Record<string, number>>): Params;

  // Difficulty levels (optional). Presets and custom settings then choose
  // the size, and the difficulty is chosen separately.
  readonly difficulties?: readonly string[];
  difficultyOf?(params: Params): number;
  withDifficulty?(params: Params, difficulty: number): Params;

  // Puzzles
  generate(params: Params, random: RandomState): GeneratedPuzzle;
  /** Returns an error message, or null if the description is valid. */
  validateDescription(params: Params, description: string): string | null;
  newGame(params: Params, description: string): State;

  // Play
  /** Returns the new state, or null if the move is invalid. */
  applyMove(state: State, move: Move): State | null;
  isCompleted(state: State): boolean;
  /** Returns a move that solves the puzzle, or null if it can't. */
  solve(initial: State, solution?: string): Move | null;

  /**
   * True if the game's board can mark rule-breaking pieces in red. The
   * shell then offers a "Show mistakes" switch; what counts as a mistake,
   * and how it's drawn, is up to the game's board.
   */
  readonly canShowMistakes?: boolean;
}
