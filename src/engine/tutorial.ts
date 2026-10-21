import { PuzzleGame } from './puzzle-game';

/** One step of a guided tutorial; the player completes it by playing. */
export interface TutorialStep<State, Move, Hint> {
  /** A short explanation of what to do and why. */
  readonly text: string;
  /**
   * Game-specific guidance shown on the board, e.g. an animated gesture.
   * May depend on the board, e.g. to show the next of several squares.
   */
  readonly hint?: Hint | ((state: State) => Hint | undefined);
  /** Moves this step accepts; others are ignored. Absent = any move. */
  readonly expect?: (move: Move, state: State) => boolean;
  /** The step is complete when this becomes true. */
  readonly done: (state: State) => boolean;
}

/** A guided tutorial on a fixed, hand-made puzzle. */
export interface Tutorial<Params, State, Move, Hint> {
  readonly params: Params;
  readonly description: string;
  readonly steps: readonly TutorialStep<State, Move, Hint>[];
}

export type TutorialMoveResult = 'refused' | 'applied' | 'step-done';

/** Plays through a tutorial: tracks the step and the puzzle state. Framework-free. */
export class TutorialRun<Params, State, Move, Hint> {
  private readonly game: PuzzleGame<Params, State, Move>;
  private readonly tutorial: Tutorial<Params, State, Move, Hint>;

  stepIndex = 0;
  state: State;

  constructor(game: PuzzleGame<Params, State, Move>, tutorial: Tutorial<Params, State, Move, Hint>) {
    this.game = game;
    this.tutorial = tutorial;
    this.state = game.newGame(tutorial.params, tutorial.description);
  }

  get step(): TutorialStep<State, Move, Hint> {
    return this.tutorial.steps[this.stepIndex];
  }

  /** The current step's guidance for the board as it is now. */
  get hint(): Hint | undefined {
    const hint = this.step.hint;
    return typeof hint === 'function' ? (hint as (state: State) => Hint | undefined)(this.state) : hint;
  }

  get stepCount(): number {
    return this.tutorial.steps.length;
  }

  move(move: Move): TutorialMoveResult {
    if (this.step.expect && !this.step.expect(move, this.state)) return 'refused';
    const next = this.game.applyMove(this.state, move);
    if (next) this.state = next;
    return this.step.done(this.state) ? 'step-done' : 'applied';
  }

  /** Moves to the next step. Returns false if the tutorial is over. */
  next(): boolean {
    if (this.stepIndex === this.stepCount - 1) return false;
    this.stepIndex++;
    return true;
  }
}
