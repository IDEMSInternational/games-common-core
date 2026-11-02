import { Signal, WritableSignal, computed, signal } from '@angular/core';
import { PuzzleGame } from '../engine/puzzle-game';
import { CelebrationSize } from './puzzle-fireworks/puzzle-fireworks';
import { SessionStore } from './session-store';
import { shareText } from './share';
import { TimedControls, formatTime } from './shell-controls';
import { readStoredJson, writeStoredJson } from './stored-setting';

/** A best time, for one size and difficulty. */
export interface BestTime {
  /** "7×7", "10×10 Hard" */
  readonly label: string;
  /** Milliseconds. */
  readonly time: number;
}

/** The clock of the puzzle in progress, saved with it. */
interface TimedClock {
  /** The puzzle the clock is for. */
  readonly gameId: string;
  readonly elapsed: number;
  readonly started: boolean;
}

/**
 * Timed play: any size and difficulty against the clock, keeping the
 * best time for each size and difficulty.
 *
 * The clock starts at the first touch on the board, and runs only while
 * the puzzle is on screen (see setActive). Restart doesn't reset it; a new
 * puzzle does. There's no Solve.
 */
export class TimedStore<Params, State, Move> implements TimedControls {
  readonly kind = 'timed';
  readonly id: string;
  readonly title: string;
  readonly presetNames: readonly string[];
  readonly difficulties: readonly string[];
  readonly canShowMistakes: boolean;
  readonly showMistakes: WritableSignal<boolean>;
  readonly result = signal<number | null>(null);
  readonly best = signal<number | null>(null);
  readonly newBest = signal(false);
  /** Normal; big for a new best time. */
  readonly celebration = computed<CelebrationSize>(() => (this.newBest() ? 'big' : 'normal'));
  /** Undo and redo, until the puzzle is solved: the solved board then stays. */
  readonly canUndo: Signal<boolean>;
  readonly canRedo: Signal<boolean>;

  private readonly session: SessionStore<Params, State, Move>;
  private readonly bestKey: string;
  private readonly clockKey: string;
  /** Time on the clock before it last started. */
  private readonly base = signal(0);
  /** When the clock last started (Date.now()), or null while it's stopped. */
  private readonly since = signal<number | null>(null);
  /** Moves the displayed time on while the clock runs. */
  private readonly tick = signal(0);
  private ticker: ReturnType<typeof setInterval> | undefined;
  private started = false;
  private active = false;

  readonly elapsed: Signal<number> = computed(() => {
    this.tick();
    return this.clock(this.since());
  });

  /** Create it in an injection context (e.g. a component field), as SessionStore. */
  constructor(game: PuzzleGame<Params, State, Move>) {
    this.session = new SessionStore(game, `${game.id}.timed`);
    this.canUndo = computed(() => this.result() === null && this.session.canUndo());
    this.canRedo = computed(() => this.result() === null && this.session.canRedo());
    this.bestKey = `${game.id}.timed.best`;
    this.clockKey = `${game.id}.timed.clock`;
    this.id = game.id;
    this.title = game.name;
    this.presetNames = this.session.presetNames;
    this.difficulties = this.session.difficulties;
    this.canShowMistakes = this.session.canShowMistakes;
    this.showMistakes = this.session.showMistakes;

    const saved = readStoredJson<TimedClock>(this.clockKey);
    if (saved?.gameId === this.session.gameId()) {
      this.base.set(saved.elapsed);
      this.started = saved.started;
    }
    this.best.set(this.bestTimes()[this.sizeKey()]?.time ?? null);
    this.save();
  }

  get state(): Signal<State> {
    return this.session.state;
  }
  get completed(): Signal<boolean> {
    return this.session.completed;
  }
  get celebrate(): Signal<boolean> {
    return this.session.celebrate;
  }
  get presetIndex(): Signal<number> {
    return this.session.presetIndex;
  }
  get difficulty(): Signal<number> {
    return this.session.difficulty;
  }
  get customFields() {
    return this.session.customFields;
  }
  get label(): Signal<string> {
    return this.session.label;
  }

  /** Every best time, by size and difficulty in the game's text form ("7x7", "10x10dh"). */
  bestTimes(): Readonly<Record<string, BestTime>> {
    return readStoredJson<Record<string, BestTime>>(this.bestKey) ?? {};
  }

  /** Whether the puzzle is on screen (and the app in front): the clock runs only then. */
  setActive(active: boolean): void {
    this.active = active;
    this.sync();
  }

  touch(): void {
    if (this.result() !== null) return;
    this.started = true;
    this.sync();
  }

  move(move: Move): void {
    if (this.result() !== null) return;
    this.started = true;
    this.session.move(move);
    if (this.session.completed()) this.finish();
    this.sync();
    this.save();
  }

  undo(): void {
    if (this.result() === null) this.session.undo();
  }

  redo(): void {
    if (this.result() === null) this.session.redo();
  }

  restart(): void {
    if (this.result() === null) this.session.restart();
  }

  newGame(presetIndex?: number): void {
    this.fresh(() => this.session.newGame(presetIndex));
  }

  setDifficulty(difficulty: number): void {
    this.fresh(() => this.session.setDifficulty(difficulty));
  }

  newCustomGame(values: Readonly<Record<string, number>>): string | null {
    let error: string | null = null;
    this.fresh(() => (error = this.session.newCustomGame(values)));
    return error;
  }

  async share(): Promise<string | null> {
    const time = this.result();
    if (time === null || !this.newBest()) return null;
    return shareText(
      `${this.title}: timed play`,
      `${this.title}, timed play: ${this.session.label()} solved in ${formatTime(time)}, a new best time!`,
    );
  }

  /** A new puzzle, with the clock back to zero. */
  private fresh(start: () => void): void {
    const before = this.session.gameId();
    start();
    if (this.session.gameId() === before) return; // e.g. a custom size that wasn't valid
    this.since.set(null);
    this.base.set(0);
    this.started = false;
    this.result.set(null);
    this.newBest.set(false);
    this.best.set(this.bestTimes()[this.sizeKey()]?.time ?? null);
    this.sync();
    this.save();
  }

  private finish(): void {
    const time = this.clock(this.since());
    this.base.set(time);
    this.since.set(null);
    this.result.set(time);
    const best = this.best();
    if (best === null || time < best) {
      this.newBest.set(true);
      writeStoredJson(this.bestKey, {
        ...this.bestTimes(),
        [this.sizeKey()]: { label: this.session.label(), time },
      });
    }
  }

  /** Starts or stops the clock, to match the puzzle's state. */
  private sync(): void {
    const run = this.active && this.started && this.result() === null;
    if (run && this.since() === null) {
      this.since.set(Date.now());
      this.ticker = setInterval(() => this.tick.update((t) => t + 1), 250);
    } else if (!run && this.since() !== null) {
      this.base.set(this.clock(this.since()));
      this.since.set(null);
    }
    if (!run && this.ticker !== undefined) {
      clearInterval(this.ticker);
      this.ticker = undefined;
      this.save();
    }
  }

  private clock(since: number | null): number {
    return this.base() + (since === null ? 0 : Date.now() - since);
  }

  /** The size and difficulty in the game's text form: "7x7", "10x10dh". */
  private sizeKey(): string {
    return this.session.gameId().split('#')[0];
  }

  private save(): void {
    writeStoredJson(this.clockKey, {
      gameId: this.session.gameId(),
      elapsed: this.clock(this.since()),
      started: this.started,
    } satisfies TimedClock);
  }
}
