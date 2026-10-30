import { Signal, WritableSignal, computed, signal } from '@angular/core';
import { DailyPuzzle, WEEKDAYS, localDay } from '../engine/daily';
import { GameSession } from '../engine/game-session';
import { PuzzleGame } from '../engine/puzzle-game';
import { DailyRecords, DailyResult } from './daily-records';
import { shareText } from './share';
import { DailyControls, formatTime } from './shell-controls';

/**
 * One day's daily puzzle, made observable by Angular (as SessionStore is
 * for free play), with its clock.
 *
 * The clock starts at the first touch on the board, and runs only while
 * the puzzle is on screen (see setActive). Restart doesn't reset it. When
 * the puzzle is solved the time is kept as the day's result, and the
 * board stays solved. The game and the time so far are saved after every
 * change, and whenever the clock stops.
 */
export class DailyStore<Params, State, Move> implements DailyControls {
  readonly kind = 'daily';
  readonly id: string;
  readonly title: string;
  readonly number: number;
  readonly dayName: string;
  readonly label: string;
  readonly canShowMistakes: boolean;
  readonly showMistakes: WritableSignal<boolean>;
  readonly celebrate = signal(false);
  readonly result: WritableSignal<DailyResult | null>;

  readonly puzzle: DailyPuzzle<Params>;
  private readonly records: DailyRecords;
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

  readonly state = this.read(() => this.session.state);
  readonly completed = this.read(() => this.session.isCompleted);
  readonly canUndo = this.read(() => !this.result() && this.session.canUndo);
  readonly canRedo = this.read(() => !this.result() && this.session.canRedo);
  readonly canShare = computed(() => this.result()?.onDay === true);
  readonly elapsed: Signal<number> = computed(() => {
    this.tick();
    const since = this.since();
    return this.base() + (since === null ? 0 : Date.now() - since);
  });

  constructor(
    game: PuzzleGame<Params, State, Move>,
    puzzle: DailyPuzzle<Params>,
    records: DailyRecords,
    showMistakes: WritableSignal<boolean>,
  ) {
    this.puzzle = puzzle;
    this.records = records;
    const saved = records.game<Move>(puzzle.date);
    const snapshot = saved?.snapshot.seed === puzzle.seed ? saved.snapshot : undefined;
    this.session = new GameSession(game, puzzle.params, puzzle.seed, snapshot);
    this.base = signal(snapshot ? saved!.elapsed : 0);
    this.started = snapshot ? saved!.started : false;
    this.result = signal(records.results()[puzzle.date] ?? null);

    this.id = game.id;
    this.title = game.name;
    this.number = puzzle.number;
    this.dayName = WEEKDAYS[puzzle.weekday];
    this.label = paramsLabel(game, puzzle.params);
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
    if (this.result()) return;
    this.started = true;
    this.sync();
  }

  move(move: Move): void {
    if (this.result()) return;
    this.started = true;
    this.change(() => this.session.move(move));
    if (this.session.isCompleted) this.finish();
    this.sync();
  }

  undo(): void {
    if (!this.result()) this.change(() => this.session.undo());
  }

  redo(): void {
    if (!this.result()) this.change(() => this.session.redo());
  }

  restart(): void {
    if (!this.result()) this.change(() => this.session.restart());
  }

  async share(): Promise<string | null> {
    const result = this.result();
    if (!result?.onDay) return null;
    const streak = this.records.streak(localDay());
    const lines = [
      `${this.title} daily puzzle #${this.number} (${this.dayName}, ${this.label})`,
      `Solved in ${formatTime(result.time)}`,
      ...(streak > 1 ? [`🔥 ${streak}-day streak`] : []),
    ];
    return shareText(`${this.title} daily puzzle #${this.number}`, lines.join('\n'));
  }

  private finish(): void {
    const result = { time: this.clock(), onDay: localDay() === this.puzzle.date };
    this.base.set(result.time);
    this.since.set(null);
    this.result.set(result);
    this.records.addResult(this.puzzle.date, result);
    this.celebrate.set(true);
    this.save();
  }

  /** Starts or stops the clock, to match the puzzle's state. */
  private sync(): void {
    const run = this.active && this.started && !this.result();
    if (run && this.since() === null) {
      this.since.set(Date.now());
      this.ticker = setInterval(() => this.tick.update((t) => t + 1), 250);
    } else if (!run && this.since() !== null) {
      this.base.set(this.clock());
      this.since.set(null);
    }
    if (!run && this.ticker !== undefined) {
      clearInterval(this.ticker);
      this.ticker = undefined;
      this.save();
    }
  }

  /** The time on the clock now. */
  private clock(): number {
    const since = this.since();
    return this.base() + (since === null ? 0 : Date.now() - since);
  }

  private change(action: () => void): void {
    this.celebrate.set(false); // only the winning move (finish) sets it
    action();
    this.save();
    this.version.update((v) => v + 1);
  }

  private save(): void {
    this.records.saveGame(this.puzzle.date, {
      snapshot: this.session.snapshot(),
      elapsed: this.clock(),
      started: this.started,
    });
  }

  private read<T>(get: () => T): Signal<T> {
    return computed(() => {
      this.version();
      return get();
    });
  }
}

/** A puzzle's size (as named in the size menu) and difficulty: "9×9", "10×12 Hard". */
export function paramsLabel<Params, State, Move>(
  game: PuzzleGame<Params, State, Move>,
  params: Params,
): string {
  const difficulty = game.difficultyOf?.(params);
  const atDifficulty = (p: Params) =>
    game.withDifficulty && difficulty !== undefined ? game.withDifficulty(p, difficulty) : p;
  const encoded = game.encodeParams(params);
  const size =
    game.presets().find((p) => game.encodeParams(atDifficulty(p.params)) === encoded)?.name ??
    encoded;
  return difficulty !== undefined && game.difficulties
    ? `${size} ${game.difficulties[difficulty]}`
    : size;
}
