import { Signal, WritableSignal, computed, signal } from '@angular/core';
import { DAILY_LEVELS, DAILY_LEVEL_KEYS } from '../engine/daily';
import { GameSession, SessionSnapshot } from '../engine/game-session';
import { PuzzleGame } from '../engine/puzzle-game';
import { paramsLabel } from './daily-store';
import { CelebrationSize } from './puzzle-fireworks/puzzle-fireworks';
import { shareText } from './share';
import { ClockControls } from './shell-controls';
import { readStoredJson, removeStored, writeStoredJson } from './stored-setting';

/** How long a solved puzzle stays on screen (with the clock stopped) before the next. */
export const NEXT_PUZZLE_MS = 900;

/**
 * What a run's puzzles are: a difficulty, as the daily puzzles' levels
 * ("low", "medium", "high": Easy, Medium, Hard), or one custom size
 * ("custom:" and its settings, e.g. "custom:7x9").
 */
export type ClockChoice = string;

/** The difficulties, Easy to Hard. */
export const CLOCK_LEVELS: readonly ClockChoice[] = DAILY_LEVEL_KEYS;

const CUSTOM = 'custom:';

/** A custom size's choice. */
export function customClockChoice<Params>(game: PuzzleGame<Params, unknown, unknown>, params: Params): ClockChoice {
  return CUSTOM + game.encodeParams(params);
}

/** A custom choice's settings; null for a difficulty, or settings no longer valid. */
export function customClockParams<Params>(game: PuzzleGame<Params, unknown, unknown>, choice: ClockChoice): Params | null {
  if (!choice.startsWith(CUSTOM)) return null;
  const params = game.decodeParams(choice.slice(CUSTOM.length));
  return game.validateParams(params) ? null : params;
}

/**
 * The puzzle settings a choice's runs are dealt from: a difficulty's are
 * that daily level's sizes (each once); a custom choice's, its one size.
 * Empty if the choice can't be played.
 */
export function clockChoiceParams<Params>(game: PuzzleGame<Params, unknown, unknown>, choice: ClockChoice): Params[] {
  const level = CLOCK_LEVELS.indexOf(choice);
  if (level >= 0) {
    const sizes = new Map((game.daily?.levels[level] ?? []).map((p) => [game.encodeParams(p), p]));
    return [...sizes.values()];
  }
  const custom = customClockParams(game, choice);
  return custom ? [custom] : [];
}

/** "Medium", "7×9", "7×9 Hard". */
export function clockChoiceLabel<Params>(game: PuzzleGame<Params, unknown, unknown>, choice: ClockChoice): string {
  const level = CLOCK_LEVELS.indexOf(choice);
  if (level >= 0) return DAILY_LEVELS[level];
  const custom = customClockParams(game, choice);
  return custom ? paramsLabel(game, custom) : choice;
}

/** A record: the most puzzles solved with a choice in a time limit. */
export interface ClockRecord {
  readonly choice: ClockChoice;
  readonly minutes: number;
  readonly solved: number;
}

/** Before difficulties, runs were medium puzzles. */
const OLD_CHOICE = 'medium';

/** A run of Beat the clock in progress, saved so it can be continued. */
export interface ClockRun<Move> {
  /** Missing in runs saved before difficulties (then Medium). */
  readonly choice?: ClockChoice;
  readonly minutes: number;
  /** Milliseconds left. */
  readonly left: number;
  readonly solved: number;
  /** The clock started (at the first touch on the board). */
  readonly started: boolean;
  readonly snapshot: SessionSnapshot<Move>;
  /** The puzzle settings still to come in this set (indexes into the choice's, see clockChoiceParams). */
  readonly bag?: readonly number[];
}

/** The player's Beat the clock records and unfinished run, remembered on this device. */
export class ClockRecords {
  private readonly recordsKey: string;
  private readonly runKey: string;

  constructor(gameId: string) {
    this.recordsKey = `${gameId}.clock.records`;
    this.runKey = `${gameId}.clock.run`;
  }

  /** All the records, as saved: the most puzzles solved, keyed "medium/5" (choice/minutes). */
  private saved(): Record<string, number> {
    const saved = readStoredJson<Record<string, number>>(this.recordsKey) ?? {};
    // Records from before difficulties are keyed by minutes alone.
    return Object.fromEntries(
      Object.entries(saved).map(([key, solved]) => [key.includes('/') ? key : `${OLD_CHOICE}/${key}`, solved]),
    );
  }

  records(): ClockRecord[] {
    return Object.entries(this.saved()).map(([key, solved]) => {
      const slash = key.lastIndexOf('/');
      return { choice: key.slice(0, slash), minutes: Number(key.slice(slash + 1)), solved };
    });
  }

  /** The record for a choice and time limit; 0 if none yet. */
  record(choice: ClockChoice, minutes: number): number {
    return this.saved()[`${choice}/${minutes}`] ?? 0;
  }

  deleteRecord(choice: ClockChoice, minutes: number): void {
    const records = this.saved();
    delete records[`${choice}/${minutes}`];
    writeStoredJson(this.recordsKey, records);
  }

  setRecord(choice: ClockChoice, minutes: number, solved: number): void {
    writeStoredJson(this.recordsKey, { ...this.saved(), [`${choice}/${minutes}`]: solved });
  }

  run<Move>(): ClockRun<Move> | null {
    const run = readStoredJson<ClockRun<Move>>(this.runKey);
    return run && { ...run, choice: run.choice ?? OLD_CHOICE };
  }

  saveRun<Move>(run: ClockRun<Move>): void {
    writeStoredJson(this.runKey, run);
  }

  clearRun(): void {
    removeStored(this.runKey);
  }
}

/**
 * A run of Beat the clock, made observable by Angular: random puzzles of
 * a difficulty (the daily puzzles' sizes for that level) or of one custom
 * size, one after another until the time is up.
 *
 * The clock counts down from the first touch on the board, and runs only
 * while the puzzle is on screen (see setActive), and not while a solved
 * puzzle is shown before the next. There's no skipping a puzzle. The run is saved after every change,
 * so it can be continued; when the time is up the record is kept and the
 * run forgotten.
 */
export class ClockStore<Params, State, Move> implements ClockControls {
  readonly kind = 'clock';
  readonly id: string;
  readonly title: string;
  readonly minutes: number;
  readonly choice: ClockChoice;
  readonly choiceLabel: string;
  readonly canShowMistakes: boolean;
  readonly showMistakes: WritableSignal<boolean>;
  readonly celebrate = signal(false);
  /** A quick burst between puzzles; a big show for a new record when the time is up. */
  readonly celebration = signal<CelebrationSize>('small');
  readonly solved: WritableSignal<number>;
  readonly finished = signal(false);
  readonly newRecord = signal(false);
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
  /** The settings the puzzles are dealt from (see nextParams). */
  private readonly choices: Params[];
  /** The rest of the current set of puzzle settings (see nextParams). */
  private bag: number[];
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
    choice: ClockChoice,
    showMistakes: WritableSignal<boolean>,
  ) {
    this.game = game;
    this.records = records;
    this.choice = choice;
    this.choiceLabel = clockChoiceLabel(game, choice);
    const choices = clockChoiceParams(game, choice);
    this.choices = choices.length ? choices : [game.defaultParams()];
    const saved = records.run<Move>();
    const run = saved?.minutes === minutes && saved.choice === choice ? saved : null;
    this.bag = run?.bag ? [...run.bag] : [];
    const continued = run && new GameSession(game, game.defaultParams(), undefined, run.snapshot);
    this.session =
      continued && continued.seed === run.snapshot.seed && !continued.isCompleted
        ? continued
        : new GameSession(game, this.nextParams());
    this.minutes = minutes;
    this.left = signal(run ? run.left : minutes * 60_000);
    this.solved = signal(run ? run.solved : 0);
    this.started = run ? run.started : false;
    this.record = records.record(choice, minutes);

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
      this.celebration.set('small');
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

  playAgain(): void {
    clearTimeout(this.nextPuzzle);
    this.between = false;
    this.started = false;
    this.record = this.records.record(this.choice, this.minutes);
    this.solved.set(0);
    this.left.set(this.minutes * 60_000);
    this.finished.set(false);
    this.newRecord.set(false);
    this.bag = []; // a fresh set of puzzles
    this.change(() => this.session.newGame(this.nextParams()));
  }

  async share(): Promise<string | null> {
    if (!this.newRecord()) return null;
    const puzzles = this.solved() === 1 ? '1 puzzle' : `${this.solved()} puzzles`;
    return shareText(
      this.id,
      `${this.title}: Beat the clock`,
      `${this.title}, Beat the clock (${this.choiceLabel}): ${puzzles} solved in ${this.minutes === 1 ? '1 minute' : `${this.minutes} minutes`}, a new record!`,
    );
  }

  private next(): void {
    this.between = false;
    this.change(() => this.session.newGame(this.nextParams()));
    this.sync();
  }

  private finish(): void {
    clearTimeout(this.nextPuzzle);
    this.between = false;
    this.left.set(0);
    this.since.set(null);
    this.finished.set(true);
    this.celebrate.set(false);
    if (this.solved() > this.records.record(this.choice, this.minutes)) {
      this.records.setRecord(this.choice, this.minutes, this.solved());
      this.newRecord.set(true);
      this.celebration.set('big');
      this.celebrate.set(true);
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

  /**
   * The next puzzle's settings, dealt like cards for a fair mix: each set
   * has every one of the choice's settings once, in random order, so no
   * run can be all big puzzles or all small ones.
   */
  private nextParams(): Params {
    const choices = this.choices;
    if (this.bag.length === 0) {
      this.bag = choices.map((_, i) => i);
      for (let i = this.bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
      }
    }
    return choices[this.bag.shift()!] ?? choices[0];
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
      choice: this.choice,
      minutes: this.minutes,
      left: this.timeLeft(this.since()),
      solved: this.solved(),
      started: this.started,
      snapshot: this.session.snapshot(),
      bag: this.bag,
    });
  }

  private read<T>(get: () => T): Signal<T> {
    return computed(() => {
      this.version();
      return get();
    });
  }
}
