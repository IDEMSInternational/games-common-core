import { Signal, WritableSignal, computed, signal } from '@angular/core';
import { GameSession, SessionSnapshot } from '../engine/game-session';
import { PuzzleGame } from '../engine/puzzle-game';
import { NEXT_PUZZLE_MS } from './clock-store';
import { paramsLabel } from './daily-store';
import { CelebrationSize } from './puzzle-fireworks/puzzle-fireworks';
import { shareText } from './share';
import { LadderControls, formatTime } from './shell-controls';
import { readStoredJson, removeStored, writeStoredJson } from './stored-setting';

/** A ladder in progress, saved so it can be continued. */
export interface LadderRun<Move> {
  /** The difficulty (an index into the game's difficulties; 0 if it has none). */
  readonly difficulty: number;
  /** The rung being played, from 0. */
  readonly rung: number;
  /** Milliseconds on the clock. */
  readonly elapsed: number;
  /** The clock started (at the first touch on the board). */
  readonly started: boolean;
  readonly snapshot: SessionSnapshot<Move>;
}

/** The player's ladder best times and unfinished ladder, remembered on this device. */
export class LadderRecords {
  private readonly bestKey: string;
  private readonly runKey: string;

  constructor(gameId: string) {
    this.bestKey = `${gameId}.ladder.best`;
    this.runKey = `${gameId}.ladder.run`;
  }

  /** The best times (milliseconds), by difficulty. */
  bestTimes(): Readonly<Record<string, number>> {
    return readStoredJson<Record<string, number>>(this.bestKey) ?? {};
  }

  best(difficulty: number): number | null {
    return this.bestTimes()[difficulty] ?? null;
  }

  deleteBest(difficulty: number): void {
    const { [difficulty]: _, ...rest } = this.bestTimes();
    writeStoredJson(this.bestKey, rest);
  }

  setBest(difficulty: number, time: number): void {
    writeStoredJson(this.bestKey, { ...this.bestTimes(), [difficulty]: time });
  }

  run<Move>(): LadderRun<Move> | null {
    return readStoredJson<LadderRun<Move>>(this.runKey);
  }

  saveRun<Move>(run: LadderRun<Move>): void {
    writeStoredJson(this.runKey, run);
  }

  clearRun(): void {
    removeStored(this.runKey);
  }
}

/** The ladder's rungs: the size menu's sizes, smallest first, at the difficulty. */
export function ladderRungs<Params>(game: PuzzleGame<Params, unknown, unknown>, difficulty: number): Params[] {
  return game
    .presets()
    .map((preset) => (game.withDifficulty ? game.withDifficulty(preset.params, difficulty) : preset.params));
}

/**
 * A ladder, made observable by Angular: one puzzle of each size in the
 * size menu, smallest to largest, timed from the first touch to the last
 * puzzle solved.
 *
 * The clock runs only while the puzzle is on screen (see setActive), and
 * not while a solved puzzle is shown before the next size. There's no
 * skipping a size. The ladder is saved after every change, so it can be
 * continued; at the top, the best time is kept and the ladder forgotten.
 */
export class LadderStore<Params, State, Move> implements LadderControls {
  readonly kind = 'ladder';
  readonly id: string;
  readonly title: string;
  readonly difficulty: number;
  readonly difficultyName: string | null;
  readonly rungCount: number;
  readonly canShowMistakes: boolean;
  readonly showMistakes: WritableSignal<boolean>;
  readonly celebrate = signal(false);
  /** A quick burst for each rung; a show at the top, bigger for a new best time. */
  readonly celebration = signal<CelebrationSize>('small');
  readonly rung: WritableSignal<number>;
  readonly result = signal<number | null>(null);
  readonly best: WritableSignal<number | null>;
  readonly newBest = signal(false);

  private readonly game: PuzzleGame<Params, State, Move>;
  private readonly records: LadderRecords;
  private readonly rungs: Params[];
  private readonly session: GameSession<Params, State, Move>;
  private readonly version = signal(0);
  /** Time on the clock before it last started. */
  private readonly base: WritableSignal<number>;
  /** When the clock last started (Date.now()), or null while it's stopped. */
  private readonly since = signal<number | null>(null);
  /** Moves the displayed time on while the clock runs. */
  private readonly tick = signal(0);
  private ticker: ReturnType<typeof setInterval> | undefined;
  private started: boolean;
  private active = false;
  /** A solved puzzle on show before the next size. */
  private between = false;
  private nextPuzzle: ReturnType<typeof setTimeout> | undefined;

  readonly state = this.read(() => this.session.state);
  readonly label = this.read(() => paramsLabel(this.game, this.session.params));
  readonly completed = this.read(() => this.session.isCompleted);
  readonly canUndo = this.read(() => this.result() === null && this.session.canUndo);
  readonly canRedo = this.read(() => this.result() === null && this.session.canRedo);
  readonly elapsed: Signal<number> = computed(() => {
    this.tick();
    return this.clock(this.since());
  });

  constructor(
    game: PuzzleGame<Params, State, Move>,
    records: LadderRecords,
    difficulty: number,
    showMistakes: WritableSignal<boolean>,
  ) {
    this.game = game;
    this.records = records;
    this.difficulty = difficulty;
    this.difficultyName = game.difficulties?.[difficulty] ?? null;
    this.rungs = ladderRungs(game, difficulty);
    this.rungCount = this.rungs.length;

    const saved = records.run<Move>();
    const run = saved?.difficulty === difficulty && saved.rung < this.rungCount ? saved : null;
    const continued = run && new GameSession(game, game.defaultParams(), undefined, run.snapshot);
    const resumed = continued && continued.seed === run.snapshot.seed && !continued.isCompleted;
    // A rung solved just before closing the app: on to the next.
    const rung = run ? Math.min(run.rung + (continued?.isCompleted ? 1 : 0), this.rungCount - 1) : 0;
    this.rung = signal(rung);
    this.session = resumed ? continued : new GameSession(game, this.rungs[rung]);
    this.base = signal(run ? run.elapsed : 0);
    this.started = run ? run.started : false;
    this.best = signal(records.best(difficulty));

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
    if (this.result() !== null) return;
    this.started = true;
    this.sync();
  }

  move(move: Move): void {
    if (this.result() !== null || this.between) return;
    this.started = true;
    this.change(() => this.session.move(move));
    if (this.session.isCompleted) {
      if (this.rung() === this.rungCount - 1) return this.finish();
      this.celebration.set('small');
      this.celebrate.set(true);
      this.between = true;
      this.nextPuzzle = setTimeout(() => this.next(), NEXT_PUZZLE_MS);
    }
    this.sync();
    this.save();
  }

  undo(): void {
    if (this.result() === null && !this.between) this.change(() => this.session.undo());
  }

  redo(): void {
    if (this.result() === null && !this.between) this.change(() => this.session.redo());
  }

  restart(): void {
    if (this.result() === null && !this.between) this.change(() => this.session.restart());
  }

  /** Back to the bottom of the ladder, the clock at zero. */
  playAgain(): void {
    clearTimeout(this.nextPuzzle);
    this.between = false;
    this.started = false;
    this.since.set(null);
    this.base.set(0);
    this.rung.set(0);
    this.result.set(null);
    this.newBest.set(false);
    this.best.set(this.records.best(this.difficulty));
    this.change(() => this.session.newGame(this.rungs[0]));
    this.sync();
  }

  async share(): Promise<string | null> {
    const time = this.result();
    if (time === null || !this.newBest()) return null;
    const ladder = this.difficultyName ? `Ladder (${this.difficultyName})` : 'Ladder';
    return shareText(
      `${this.title}: Ladder`,
      `${this.title}, ${ladder}: ${this.rungCount} sizes climbed in ${formatTime(time)}, a new best time!`,
    );
  }

  private next(): void {
    this.between = false;
    this.rung.update((r) => r + 1);
    this.change(() => this.session.newGame(this.rungs[this.rung()]));
    this.sync();
  }

  /** The top: the last size solved. */
  private finish(): void {
    const time = this.clock(this.since());
    this.base.set(time);
    this.since.set(null);
    this.result.set(time);
    const best = this.best();
    const newBest = best === null || time < best;
    if (newBest) this.records.setBest(this.difficulty, time);
    this.newBest.set(newBest);
    this.celebration.set(newBest ? 'big' : 'normal');
    this.celebrate.set(true);
    this.records.clearRun();
    this.sync();
  }

  /** Starts or stops the clock, to match the ladder's state. */
  private sync(): void {
    const run = this.active && this.started && !this.between && this.result() === null;
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

  private change(action: () => void): void {
    this.celebrate.set(false); // only a solving move sets it
    action();
    this.save();
    this.version.update((v) => v + 1);
  }

  private save(): void {
    if (this.result() !== null) return;
    this.records.saveRun({
      difficulty: this.difficulty,
      rung: this.rung(),
      elapsed: this.clock(this.since()),
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
