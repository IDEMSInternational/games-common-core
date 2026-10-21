import { Signal, computed, signal } from '@angular/core';
import { PuzzleGame } from '../engine/puzzle-game';
import { Tutorial, TutorialRun } from '../engine/tutorial';

/** Pause between steps, so the player sees the result of their move. */
const STEP_PAUSE_MS = 500;
/** How long "Well done!" shows before the game starts. */
const FINISH_PAUSE_MS = 1800;

/** What the tutorial frame needs, independent of the game's types. */
export interface TutorialControls {
  readonly title: string;
  readonly text: Signal<string>;
  readonly stepIndex: Signal<number>;
  readonly stepCount: number;
  readonly finished: Signal<boolean>;
}

/** Makes a TutorialRun observable by Angular, and paces the steps. */
export class TutorialStore<Params, State, Move, Hint> implements TutorialControls {
  private readonly run: TutorialRun<Params, State, Move, Hint>;
  private readonly version = signal(0);
  private readonly onFinish: () => void;
  /** True during the pause after a step, when the board takes no moves. */
  private readonly pausing = signal(false);

  readonly title: string;
  readonly stepCount: number;
  readonly finished = signal(false);

  readonly state = this.read(() => this.run.state);
  readonly stepIndex = this.read(() => this.run.stepIndex);
  readonly text = this.read(() => this.run.step.text);
  readonly hint = this.read(() => (this.pausing() ? null : (this.run.hint ?? null)));

  constructor(
    game: PuzzleGame<Params, State, Move>,
    tutorial: Tutorial<Params, State, Move, Hint>,
    onFinish: () => void,
  ) {
    this.run = new TutorialRun(game, tutorial);
    this.title = `How to play ${game.name}`;
    this.stepCount = this.run.stepCount;
    this.onFinish = onFinish;
  }

  move(move: Move): void {
    if (this.pausing()) return;
    const result = this.run.move(move);
    this.version.update((v) => v + 1);
    if (result !== 'step-done') return;

    this.pausing.set(true);
    if (this.run.next()) {
      setTimeout(() => {
        this.pausing.set(false);
        this.version.update((v) => v + 1);
      }, STEP_PAUSE_MS);
    } else {
      this.finished.set(true);
      setTimeout(this.onFinish, FINISH_PAUSE_MS);
    }
  }

  private read<T>(get: () => T): Signal<T> {
    return computed(() => {
      this.version();
      return get();
    });
  }
}
