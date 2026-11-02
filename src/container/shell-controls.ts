import { Signal, WritableSignal } from '@angular/core';
import { CustomField } from '../engine/puzzle-game';
import { DailyResult } from './daily-records';

/** What the puzzle shell needs from any puzzle being played, independent of the game's types. */
export interface PlayControls {
  /** The game's short id ("slant"), also its repository's name. */
  readonly id: string;
  readonly title: string;
  readonly canUndo: Signal<boolean>;
  readonly canRedo: Signal<boolean>;
  readonly completed: Signal<boolean>;
  /** True right after the player solves the puzzle themselves (not with Solve). */
  readonly celebrate: Signal<boolean>;
  /** Whether the game supports "Show mistakes", and the player's setting for it. */
  readonly canShowMistakes: boolean;
  readonly showMistakes: WritableSignal<boolean>;
  undo(): void;
  redo(): void;
  restart(): void;
  /** The player touched the board. */
  touch(): void;
}

/** Free play: any size, a new puzzle whenever the player likes. */
export interface FreePlayControls extends PlayControls {
  readonly kind: 'free';
  readonly presetNames: readonly string[];
  readonly presetIndex: Signal<number>;
  /** Difficulty level names; empty if the game has no difficulty levels. */
  readonly difficulties: readonly string[];
  readonly difficulty: Signal<number>;
  readonly gameId: Signal<string>;
  /** Custom-puzzle settings, filled in from the current puzzle. */
  readonly customFields: Signal<readonly CustomField[]>;
  newGame(presetIndex?: number): void;
  /** Starts a new puzzle of the current size at another difficulty. */
  setDifficulty(difficulty: number): void;
  /** Starts a custom puzzle. Returns an error message, or null on success. */
  newCustomGame(values: Readonly<Record<string, number>>): string | null;
  solve(): void;
}

/** One day's daily puzzle at one level, against the clock. */
export interface DailyControls extends PlayControls {
  readonly kind: 'daily';
  readonly number: number;
  /** "Friday" */
  readonly dayName: string;
  /** "Easy", "Medium" or "Hard" */
  readonly levelName: string;
  /** The puzzle's size and difficulty: "9×9", "10×12 Hard". */
  readonly label: string;
  /** Milliseconds on the clock. */
  readonly elapsed: Signal<number>;
  /** Set once the puzzle is solved; the board then stays as it is. */
  readonly result: Signal<DailyResult | null>;
  /** True if the result can be shared: today's puzzle, solved today. */
  readonly canShare: Signal<boolean>;
  /** Opens the device's share panel. Returns a message to show, if any. */
  share(): Promise<string | null>;
}

/** Beat the clock: as many puzzles as possible in the time. */
export interface ClockControls extends PlayControls {
  readonly kind: 'clock';
  /** The time limit, in minutes. */
  readonly minutes: number;
  /** The puzzle's size and difficulty: "7×7", "10×10 Easy". */
  readonly label: Signal<string>;
  /** Milliseconds left. */
  readonly remaining: Signal<number>;
  /** Puzzles solved so far. */
  readonly solved: Signal<number>;
  /** True once the time is up. */
  readonly finished: Signal<boolean>;
  /** The record for this time limit, before this run. */
  readonly record: number;
  /** A new puzzle, without counting this one. */
  skip(): void;
  /** Another run with the same time limit. */
  playAgain(): void;
}

export type ShellControls = FreePlayControls | DailyControls | ClockControls;

/** Formats a time on the clock: "0:42", "12:05", "1:02:03". */
export function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const [h, m, s] = [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60];
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
