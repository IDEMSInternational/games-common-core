import { Signal, WritableSignal, computed, signal } from '@angular/core';
import { GameSession, SessionSnapshot } from '../engine/game-session';
import { PuzzleGame } from '../engine/puzzle-game';
import { paramsLabel } from './daily-store';
import { ClockControls } from './shell-controls';
import { readStoredJson, removeStored, writeStoredJson } from './stored-setting';

/** How long a solved puzzle stays on screen (with the clock stopped) before the next. */
export const NEXT_PUZZLE_MS = 900;

/** A run of Beat the clock in progress, saved so it can be continued. */
export interface ClockRun<Move> {
  readonly minutes: number;
  /** Milliseconds left. */
  readonly left: number;
  readonly solved: number;
  /** The clock started (at the first touch on the board). */
  readonly started: boolean;
  readonly snapshot: SessionSnapshot<Move>;
}

/** The player's Beat the clock records and unfinished run, remembered on this device. */
export class ClockRecords {
  private readonly recordsKey: string;
  private readonly runKey: string;

  constructor(gameId: string) {
    this.recordsKey = `${gameId}.clock.records`;
    this.runKey = `${gameId}.clock.run`;
  }

  /** The most puzzles solved, by time limit in minutes. */
  records(): Readonly<Record<string, number>> {
    return readStoredJson<Record<string, number>>(this.recordsKey) ?? {};
  }

  setRecord(minutes: number, solved: number): void {
    writeStoredJson(this.recordsKey, { ...this.records(), [minutes]: solved });
  }

  run<Move>(): ClockRun<Move> | null {
    return readStoredJson<ClockRun<Move>>(this.runKey);
  }

  saveRun<Move>(run: ClockRun<Move>): void {
    writeStoredJson(this.runKey, run);
  }

  clearRun(): void {
    removeStored(this.runKey);
  }
}

/**
 * A run of Beat the clock, made observable by Angular: random puzzles,
 * picked from the game's beatTheClock settings, one after another until
 * the time is up.
 *
 * The clock counts down from the first touch on the board, and runs only
 * while the puzzle is on screen (see setActive), and not while a solved
 * puzzle is shown before the next. The run is saved after every change,
 * so it can be continued; when the time is up the record is kept and the
 * run forgotten.
 */
export class ClockStore<Params, State, Move> implements ClockControls {
  readonly kind = 'clock';
  readonly id: string;
  readonly title: string;
  readonly minutes: number;
  readonly canShowMistakes: boolean;
  readonly showMistakes: WritableSignal<boolean>;
  readonly celebrate = signal(false);
  readonly solved: WritableSignal<number>;
  readonly finished = signal(false);
  record: number;

  private readonly game: PuzzleGame<Params, State, Move>;
  private readonly records: ClockRecords;
  private readonly session: GameSession<Params, State, Move>;
  private readonly version = signal(0);
  /** Time left when the clock last started. */
  private readonly left: WritableSignal<number>;
  /** When the clock last started (Date.now()), or null while it's stopped. */
  private readonly since = signal<number | null>(null);
  /** Moves the displayed time on while the clock runs. */
  private readonly tick = signal(0);
  private ticker: ReturnType<typeof setInterval> | undefined;
  private started: boolean;
  private active = false;
  /** A solved puzzle on show before the next one. */
  private between = false;
  private nextPuzzle: ReturnType<typeof setTimeout> | undefined;

  readonly state = this.read(() => this.session.state);
  readonly label = this.read(() => paramsLabel(this.game, this.session.params));
  readonly completed = this.read(() => this.session.isCompleted);
  readonly canUndo = this.read(() => !this.finished() && this.session.canUndo);
  readonly canRedo = this.read(() => !this.finished() && this.session.canRedo);
  readonly remaining: Signal<number> = computed(() => {
    this.tick();
    return this.timeLeft(this.since());
  });

  constructor(
    game: PuzzleGame<Params, State, Move>,
    records: ClockRecords,
    minutes: number,
    showMistakes: WritableSignal<boolean>,
  ) {
    this.game = game;
    this.records = records;
    const saved = records.run<Move>();
    const run = saved?.minutes === minutes ? saved : null;
    this.session = new GameSession(game, this.randomParams(), undefined, run?.snapshot);
    if (run && this.session.isCompleted) this.session.newGame(this.randomParams());
    this.minutes = minutes;
    this.left = signal(run ? run.left : minutes * 60_000);
    this.solved = signal(run ? run.solved : 0);
    this.started = run ? run.started : false;
    this.record = records.records()[minutes] ?? 0;

    this.id = game.id;
    this.title = game.name;
    this.canShowMistakes = game.canShowMistakes ?? false;
    this.showMistakes = showMistakes;
    this.save();
  }

  /** Whether the puzzle is on screen (and the app in front): the clock runs only then. */
  setActive(active: boolean): void {
    this.active = active;
    this.sync();
  }

  touch(): void {
    if (this.finished()) return;
    this.started = true;
    this.sync();
  }

  move(move: Move): void {
    if (this.finished() || this.between) return;
    this.started = true;
    this.change(() => this.session.move(move));
    if (this.session.isCompleted) {
      this.solved.update((n) => n + 1);
      this.celebrate.set(true);
      this.between = true;
      this.nextPuzzle = setTimeout(() => this.next(), NEXT_PUZZLE_MS);
    }
    this.sync();
    this.save();
  }

  undo(): void {
    if (!this.finished() && !this.between) this.change(() => this.session.undo());
  }

  redo(): void {
    if (!this.finished() && !this.between) this.change(() => this.session.redo());
  }

  restart(): void {
    if (!this.finished() && !this.between) this.change(() => this.session.restart());
  }

  skip(): void {
    if (!this.finished() && !this.between) this.next();
  }

  playAgain(): void {
    clearTimeout(this.nextPuzzle);
    this.between = false;
    this.started = false;
    this.record = this.records.records()[this.minutes] ?? 0;
    this.solved.set(0);
    this.left.set(this.minutes * 60_000);
    this.finished.set(false);
    this.change(() => this.session.newGame(this.randomParams()));
  }

  private next(): void {
    this.between = false;
    this.change(() => this.session.newGame(this.randomParams()));
    this.sync();
  }

  private finish(): void {
    clearTimeout(this.nextPuzzle);
    this.between = false;
    this.left.set(0);
    this.since.set(null);
    this.finished.set(true);
    this.celebrate.set(false);
    if (this.solved() > (this.records.records()[this.minutes] ?? 0)) {
      this.records.setRecord(this.minutes, this.solved());
    }
    this.records.clearRun();
    this.sync();
  }

  /** Starts or stops the clock, to match the run's state. */
  private sync(): void {
    if (this.finished()) {
      clearInterval(this.ticker);
      this.ticker = undefined;
      return;
    }
    const run = this.active && this.started && !this.between;
    if (run && this.since() === null) {
      this.since.set(Date.now());
      this.ticker = setInterval(() => {
        if (this.timeLeft(this.since()) <= 0) this.finish();
        else this.tick.update((t) => t + 1);
      }, 250);
    } else if (!run && this.since() !== null) {
      this.left.set(this.timeLeft(this.since()));
      this.since.set(null);
      if (this.left() <= 0) return this.finish();
    }
    if (!run && this.ticker !== undefined) {
      clearInterval(this.ticker);
      this.ticker = undefined;
      this.save();
    }
  }

  private timeLeft(since: number | null): number {
    return Math.max(0, this.left() - (since === null ? 0 : Date.now() - since));
  }

  private randomParams(): Params {
    const choices = this.game.beatTheClock ?? [this.game.defaultParams()];
    return choices[Math.floor(Math.random() * choices.length)];
  }

  private change(action: () => void): void {
    this.celebrate.set(false); // only a solving move sets it
    action();
    this.save();
    this.version.update((v) => v + 1);
  }

  private save(): void {
    if (this.finished()) return;
    this.records.saveRun({
      minutes: this.minutes,
      left: this.timeLeft(this.since()),
      solved: this.solved(),
      started: this.started,
      snapshot: this.session.snapshot(),
    });
  }

  private read<T>(get: () => T): Signal<T> {
    return computed(() => {
      this.version();
      return get();
    });
  }
}
