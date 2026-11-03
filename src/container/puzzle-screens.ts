import {
  DestroyRef,
  Signal,
  WritableSignal,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { App } from '@capacitor/app';
import { DAILY_LEVELS, WEEKDAYS, availableDays, dailyPuzzle, localDay } from '../engine/daily';
import { PuzzleGame } from '../engine/puzzle-game';
import { Tutorial } from '../engine/tutorial';
import { CustomField } from '../engine/puzzle-game';
import {
  CLOCK_LEVELS,
  ClockChoice,
  ClockRecords,
  ClockStore,
  clockChoiceLabel,
  clockChoiceParams,
  customClockChoice,
  customClockParams,
} from './clock-store';
import { DailyRecords, DayStatus } from './daily-records';
import { DailyStore, paramsLabel } from './daily-store';
import { hasSeenTutorial, markTutorialSeen } from './first-run';
import { LadderRecords, LadderStore } from './ladder-store';
import { SessionStore } from './session-store';
import { formatTime } from './shell-controls';
import { BestTime, TimedStore } from './timed-store';
import {
  readStored,
  readStoredJson,
  removeStored,
  storedKeys,
  storedSetting,
  writeStored,
  writeStoredJson,
} from './stored-setting';
import { TutorialStore } from './tutorial-store';

export type Screen =
  | { readonly name: 'home' }
  | { readonly name: 'challenges' }
  | { readonly name: 'records' }
  | { readonly name: 'free' }
  | { readonly name: 'daily'; readonly date: string; readonly level: number }
  | { readonly name: 'clock'; readonly minutes: number; readonly choice: ClockChoice }
  | { readonly name: 'timed' }
  | { readonly name: 'ladder'; readonly difficulty: number };

const HOME: Screen = { name: 'home' };

/** A day whose daily puzzles can be played, for the home page. */
export interface DayInfo {
  readonly date: string;
  readonly number: number;
  /** "Friday" */
  readonly dayName: string;
  readonly isToday: boolean;
  /** The day as a whole: solved if any level was solved on the day, and so on. */
  readonly status: DayStatus;
  /** Easy, Medium and Hard. */
  readonly levels: readonly LevelInfo[];
}

/** One level of a day's daily puzzle. */
export interface LevelInfo {
  readonly level: number;
  /** "Easy" */
  readonly name: string;
  /** "9×9", "10×12 Hard" */
  readonly label: string;
  readonly status: DayStatus;
  /** Milliseconds on the clock: the result if solved, else the time so far. */
  readonly time: number;
}

/** A level's current streak: days in a row solved on the day. */
export interface LevelStreak {
  /** "Easy" */
  readonly name: string;
  readonly days: number;
}

/** A Beat the clock record: the most puzzles solved at a difficulty (or size) in a time limit. */
export interface ClockRecordInfo {
  /** "Medium", "7×9" */
  readonly label: string;
  readonly minutes: number;
  readonly solved: number;
}

/** An unfinished Beat the clock run. */
export interface ClockRunInfo {
  readonly choice: ClockChoice;
  /** "Medium", "7×9" */
  readonly label: string;
  readonly minutes: number;
  readonly solved: number;
  /** Milliseconds left. */
  readonly left: number;
}

/** A ladder best time. */
export interface LadderBest {
  /** "Easy"; null if the game has no difficulties. */
  readonly difficulty: string | null;
  /** Milliseconds. */
  readonly time: number;
}

/** An unfinished ladder. */
export interface LadderRunInfo {
  readonly difficulty: number;
  /** "Easy"; null if the game has no difficulties. */
  readonly difficultyName: string | null;
  /** The rung being played, from 0, of rungCount. */
  readonly rung: number;
  readonly rungCount: number;
  /** Milliseconds on the clock. */
  readonly elapsed: number;
}

/** One of the player's records, on the records page. */
export interface RecordRow {
  /** Identifies it, for deleting it (see PuzzleScreens.deleteRecord). */
  readonly id: string;
  /** "Easy: best streak", "Medium, 5 min", "7×7" */
  readonly label: string;
  /** "6 days", "7 puzzles", "1:05" */
  readonly value: string;
  /** More, under it: "Now: 4 days". */
  readonly detail: string | null;
  /** The text to share it with. */
  readonly share: string;
}

/** A mode's records, on the records page. */
export interface RecordGroup {
  /** "Daily puzzles", "Beat the clock", "Timed play", "Ladder" */
  readonly title: string;
  readonly rows: readonly RecordRow[];
}

/** "1 day", "6 days" */
const dayCount = (days: number) => (days === 1 ? '1 day' : `${days} days`);
/** "1 puzzle", "7 puzzles" */
const puzzleCount = (solved: number) => (solved === 1 ? '1 puzzle' : `${solved} puzzles`);

/** A day's status is the best of its levels'. */
const STATUS_ORDER: readonly DayStatus[] = ['solved', 'late', 'started', 'new'];

/** An on/off setting in Game options, remembered on the device. */
export interface OptionSwitch {
  readonly label: string;
  /** One line on what it does. */
  readonly description: string;
  readonly checked: WritableSignal<boolean>;
}

/** The game options in the ☰ menu that belong to the game (the theme is the app's). */
export interface GameOptions {
  /**
   * Settings for playing, shared by every game: Show mistakes, if the
   * game has it (the same setting as the switch on the game screens).
   * A game's own switches, like Rectangles' Lock, stay on its screens.
   */
  readonly switches: readonly OptionSwitch[];
  /**
   * Deletes the player's records on this device: daily results and
   * streaks (and daily puzzles in progress), Beat the clock records and
   * its unfinished run, timed play's best times, and the ladder's best
   * times and unfinished ladder. Settings, and free and timed play's
   * puzzles in progress, stay.
   */
  resetRecords(): void;
  /** Whether the game has daily puzzles. */
  readonly hasDaily: boolean;
  /** The daily levels the player plays, Easy, Medium and Hard: at least one. */
  readonly dailyLevels: Signal<readonly boolean[]>;
  /** Plays (or stops playing) a daily level; the last one played can't be turned off. */
  setDailyLevel(level: number, on: boolean): void;
}

/** What the home page needs, independent of the game's types. */
export interface HomeControls extends GameOptions {
  readonly id: string;
  readonly title: string;
  readonly version: string;
  /** The home page, the Challenges page (Beat the clock, timed play, the ladder) or the records page. */
  readonly page: Signal<'home' | 'challenges' | 'records'>;
  /** The player's records, by mode, for the records page. */
  readonly recordGroups: Signal<readonly RecordGroup[]>;
  /** Deletes one record (see RecordRow.id). */
  deleteRecord(id: string): void;
  openRecords(): void;
  /**
   * The daily puzzles that can be played, today's last (null before the
   * first one); empty without daily puzzles. Each day has the levels the
   * player plays (see GameOptions).
   */
  readonly days: Signal<readonly (DayInfo | null)[]>;
  readonly today: Signal<DayInfo | null>;
  /** One of the levels' current streaks: the next one each time the home page opens. */
  readonly streak: Signal<LevelStreak | null>;
  openDaily(date: string, level: number): void;
  /** Whether the game has Beat the clock. */
  readonly hasClock: boolean;
  /** One of the Beat the clock records: the next one each time the Challenges page opens. */
  readonly clockRecord: Signal<ClockRecordInfo | null>;
  readonly clockRun: Signal<ClockRunInfo | null>;
  /** Beat the clock's difficulty (or custom size) last played, remembered. */
  readonly clockChoice: Signal<ClockChoice>;
  /** The game's difficulty names for a custom size ("Easy", "Hard"); empty if it has none. */
  readonly difficulties: readonly string[];
  /** The custom size's settings for Beat the clock, filled in from the last custom size played. */
  clockCustomFields(): { readonly fields: readonly CustomField[]; readonly difficulty: number };
  /** Beat the clock's choice for a custom size; or what's wrong with it. */
  customClock(values: Readonly<Record<string, number>>, difficulty: number): { choice: ClockChoice } | { error: string };
  /**
   * Beat the clock at a difficulty (or custom size) with this time limit:
   * continues the unfinished run, or with `fresh`, starts a new one
   * (forgetting any unfinished run).
   */
  openClock(minutes: number, choice: ClockChoice, fresh?: boolean): void;
  /** One of timed play's best times: the next one each time the Challenges page opens. */
  readonly timedBest: Signal<BestTime | null>;
  openTimed(): void;
  /** One of the ladder's best times (by difficulty): the next one each time the Challenges page opens. */
  readonly ladderBest: Signal<LadderBest | null>;
  readonly ladderRun: Signal<LadderRunInfo | null>;
  /** The best time for each difficulty (index), for the ladder's sheet. */
  ladderBestTimes(): Readonly<Record<string, number>>;
  /**
   * The ladder at a difficulty (0 if the game has none): continues the
   * unfinished ladder, or with `fresh`, starts a new one (forgetting any
   * unfinished ladder).
   */
  openLadder(difficulty: number, fresh?: boolean): void;
  openFreePlay(): void;
  openChallenges(): void;
  /** Back a page (see PuzzleScreens.goHome). */
  goHome(): void;
  startTutorial(): void;
}

/**
 * Which screen a game's app shows: the home page, a daily puzzle, free
 * play, the Challenges page, Beat the clock, timed play, or the tutorial
 * over any of them (on first launch, over the home page). Each screen is
 * a browser history entry, so Back (the browser's, or Android's back
 * button) returns to the page it was opened from: the home page, or the
 * Challenges page for Beat the clock and timed play.
 *
 * Create it in an injection context (e.g. a component field).
 */
export class PuzzleScreens<Params, State, Move, Hint> implements HomeControls {
  readonly id: string;
  readonly title: string;
  readonly version: string;
  /** Free play, continuing where the player left off. */
  readonly session: SessionStore<Params, State, Move>;
  /** Timed play, likewise. */
  readonly timed: TimedStore<Params, State, Move>;
  /** The daily puzzle last opened. */
  readonly daily = signal<DailyStore<Params, State, Move> | null>(null);
  /** The Beat the clock run last opened. */
  readonly clock = signal<ClockStore<Params, State, Move> | null>(null);
  /** The ladder last opened. */
  readonly ladder = signal<LadderStore<Params, State, Move> | null>(null);
  readonly hasClock: boolean;
  readonly screen = signal<Screen>(HOME);
  /** The tutorial in progress, if any. It runs automatically on first launch. */
  readonly tutorial: WritableSignal<TutorialStore<Params, State, Move, Hint> | null>;
  readonly page = computed(() => {
    const name = this.screen().name;
    return name === 'challenges' || name === 'records' ? name : 'home';
  });
  /** The puzzle on screen: a daily puzzle, free play, Beat the clock or timed play; null on the home and Challenges pages. */
  readonly play = computed(() => {
    const screen = this.screen();
    if (screen.name === 'free') return this.session;
    if (screen.name === 'daily') return this.daily();
    if (screen.name === 'clock') return this.clock();
    if (screen.name === 'timed') return this.timed;
    if (screen.name === 'ladder') return this.ladder();
    return null;
  });

  private readonly game: PuzzleGame<Params, State, Move>;
  private readonly tutorialSteps: Tutorial<Params, State, Move, Hint>;
  private readonly records: DailyRecords;
  private readonly clockRecordsStore: ClockRecords;
  private readonly ladderRecords: LadderRecords;
  private readonly todayDate = signal(localDay());
  /** False while the app is in the background. */
  private readonly appActive = signal(true);
  /** How many times the home page has opened (remembered): picks the streak shown. */
  private readonly homeVisits: WritableSignal<number>;
  /** Likewise for the Challenges page: picks the record and best time shown. */
  private readonly challengeVisits: WritableSignal<number>;

  readonly dailyLevels: WritableSignal<readonly boolean[]>;
  readonly hasDaily: boolean;
  /** The app's "Show mistakes" setting, shared by every mode. */
  readonly showMistakes: WritableSignal<boolean>;
  readonly switches: readonly OptionSwitch[];
  /** Bumped when records are deleted (one, or all), so what's shown is read again. */
  private readonly resets = signal(0);
  readonly days = computed(() => {
    this.screen(); // read the records again on coming back home
    this.resets();
    const today = this.todayDate();
    const schedule = this.game.daily;
    const played = this.dailyLevels();
    if (!schedule) return [];
    return availableDays(today).map((date): DayInfo | null => {
      const puzzles = DAILY_LEVELS.map((_, level) => dailyPuzzle(this.id, schedule, date, level));
      if (!puzzles[0]) return null;
      const levels = puzzles
        .map((puzzle, level): LevelInfo => ({
          level,
          name: DAILY_LEVELS[level],
          label: paramsLabel(this.game, puzzle!.params),
          status: this.records.status(date, level),
          time: this.records.result(date, level)?.time ?? this.records.game(date, level)?.elapsed ?? 0,
        }))
        .filter((level) => played[level.level]);
      return {
        date,
        number: puzzles[0].number,
        dayName: WEEKDAYS[puzzles[0].weekday],
        isToday: date === today,
        status: STATUS_ORDER.find((status) => levels.some((l) => l.status === status))!,
        levels,
      };
    });
  });
  readonly today = computed(() => this.days().find((day) => day?.isToday) ?? null);
  readonly clockRecord = computed(() => {
    const visits = this.challengeVisits(); // read first: it also brings in new records
    this.resets();
    const records = this.sortedClockRecords().map(
      ({ label, minutes, solved }): ClockRecordInfo => ({ label, minutes, solved }),
    );
    return records.length ? records[visits % records.length] : null;
  });
  readonly recordGroups = computed((): RecordGroup[] => {
    this.screen(); // read the records again on opening the page
    this.resets();
    const title = this.title;
    const groups: RecordGroup[] = [];
    if (this.hasDaily) {
      const today = this.todayDate();
      const rows = DAILY_LEVELS.flatMap((name, level): RecordRow[] => {
        const best = this.records.bestStreak(level);
        if (best === 0) return [];
        const now = this.records.streak(today, level);
        return [
          {
            id: `daily:${level}`,
            label: `${name}: best streak`,
            value: dayCount(best),
            detail: now > 0 ? `Now: ${dayCount(now)}` : null,
            share: `${title} daily puzzles: my best streak at ${name} is ${dayCount(best)} 🔥`,
          },
        ];
      });
      groups.push({ title: 'Daily puzzles', rows });
    }
    if (this.hasClock) {
      const rows = this.sortedClockRecords().map(({ choice, label, minutes, solved }): RecordRow => ({
        id: `clock:${choice}/${minutes}`,
        label: `${label}, ${minutes} min`,
        value: puzzleCount(solved),
        detail: null,
        share: `${title}, Beat the clock (${label}): my record is ${puzzleCount(solved)} in ${minutes === 1 ? '1 minute' : `${minutes} minutes`}`,
      }));
      groups.push({ title: 'Beat the clock', rows });
    }
    const timed = Object.entries(this.timed.bestTimes())
      .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
      .map(([size, best]): RecordRow => ({
        id: `timed:${size}`,
        label: best.label,
        value: formatTime(best.time),
        detail: null,
        share: `${title}, timed play: my best time for ${best.label} is ${formatTime(best.time)}`,
      }));
    groups.push({ title: 'Timed play', rows: timed });
    const sizes = this.game.presets().length;
    const ladder = Object.entries(this.ladderRecords.bestTimes())
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([difficulty, time]): RecordRow => {
        const name = this.game.difficulties?.[Number(difficulty)];
        return {
          id: `ladder:${difficulty}`,
          label: name ? `${name}, ${sizes} sizes` : `${sizes} sizes`,
          value: formatTime(time),
          detail: null,
          share: `${title}, Ladder${name ? ` (${name})` : ''}: my best time for all ${sizes} sizes is ${formatTime(time)}`,
        };
      });
    groups.push({ title: 'Ladder', rows: ladder });
    return groups;
  });
  readonly clockRun = computed((): ClockRunInfo | null => {
    this.screen();
    this.resets();
    const run = this.clockRecordsStore.run();
    if (!run?.choice) return null;
    const { choice, minutes, solved, left } = run;
    return { choice, label: clockChoiceLabel(this.game, choice), minutes, solved, left };
  });
  readonly clockChoice: WritableSignal<ClockChoice>;
  readonly difficulties: readonly string[];
  readonly ladderBest = computed((): LadderBest | null => {
    const visits = this.challengeVisits(); // read first: it also brings in new best times
    this.resets();
    const times = Object.entries(this.ladderRecords.bestTimes())
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([difficulty, time]) => ({ difficulty: this.game.difficulties?.[Number(difficulty)] ?? null, time }));
    return times.length ? times[visits % times.length] : null;
  });
  readonly ladderRun = computed((): LadderRunInfo | null => {
    this.screen();
    this.resets();
    const run = this.ladderRecords.run();
    if (!run) return null;
    return {
      difficulty: run.difficulty,
      difficultyName: this.game.difficulties?.[run.difficulty] ?? null,
      rung: run.rung,
      rungCount: this.game.presets().length,
      elapsed: run.elapsed,
    };
  });
  readonly timedBest = computed(() => {
    const visits = this.challengeVisits(); // read first: it also brings in new best times
    this.resets();
    const times = Object.entries(this.timed.bestTimes())
      .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
      .map(([, best]) => best);
    return times.length ? times[visits % times.length] : null;
  });
  readonly streak = computed(() => {
    const visits = this.homeVisits(); // read first: it also brings in new results
    const today = this.todayDate();
    const played = this.dailyLevels();
    this.resets();
    const streaks = DAILY_LEVELS.map((name, level) => ({
      name,
      days: played[level] ? this.records.streak(today, level) : 0,
    })).filter((streak) => streak.days > 0);
    return streaks.length ? streaks[visits % streaks.length] : null;
  });

  constructor(
    game: PuzzleGame<Params, State, Move>,
    tutorial: Tutorial<Params, State, Move, Hint>,
    version: string,
  ) {
    this.game = game;
    this.tutorialSteps = tutorial;
    this.id = game.id;
    this.title = game.name;
    this.version = version;
    this.showMistakes = storedSetting(`${game.id}.showMistakes`);
    this.switches = game.canShowMistakes
      ? [{ label: 'Show mistakes', description: 'Rule-breaking pieces are shown in red', checked: this.showMistakes }]
      : [];
    this.session = new SessionStore(game, game.id, this.showMistakes);
    this.timed = new TimedStore(game, this.showMistakes);
    this.records = new DailyRecords(game.id);
    this.clockRecordsStore = new ClockRecords(game.id);
    this.ladderRecords = new LadderRecords(game.id);
    this.homeVisits = signal(Number(readStored(`${game.id}.home.visits`)) || 0);
    this.challengeVisits = signal(Number(readStored(`${game.id}.challenges.visits`)) || 0);
    this.hasDaily = !!game.daily;
    const levels = readStoredJson<boolean[]>(`${game.id}.daily.levels`);
    this.dailyLevels = signal(
      Array.isArray(levels) && levels.length === DAILY_LEVELS.length && levels.some(Boolean)
        ? levels.map(Boolean)
        : DAILY_LEVELS.map(() => true),
    );
    this.hasClock = !!game.daily;
    this.difficulties = game.difficulties ?? [];
    const choice = readStored(`${game.id}.clock.choice`);
    this.clockChoice = signal(choice && clockChoiceParams(game, choice).length ? choice : 'medium');
    this.records.clearOldGames(this.todayDate());
    this.tutorial = signal(hasSeenTutorial(game.id) ? null : this.newTutorial());

    // After a reload, stay on the same screen.
    this.show((history.state as { screen?: Screen } | null)?.screen ?? HOME);
    const onPopState = (event: PopStateEvent) =>
      this.show((event.state as { screen?: Screen } | null)?.screen ?? HOME);
    window.addEventListener('popstate', onPopState);

    // The daily puzzle's and Beat the clock's clocks run only while on screen.
    effect(() => {
      const shown = !this.tutorial() && this.appActive();
      this.daily()?.setActive(shown && this.screen().name === 'daily');
      this.clock()?.setActive(shown && this.screen().name === 'clock');
      this.timed.setActive(shown && this.screen().name === 'timed');
      this.ladder()?.setActive(shown && this.screen().name === 'ladder');
    });

    const listeners = [
      App.addListener('backButton', () => this.back()),
      App.addListener('appStateChange', ({ isActive }) => {
        this.appActive.set(isActive);
        if (isActive) this.todayDate.set(localDay());
      }),
    ];
    const midnight = setInterval(() => this.todayDate.set(localDay()), 60_000);
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('popstate', onPopState);
      listeners.forEach((listener) => listener.then((l) => l.remove()));
      clearInterval(midnight);
      this.daily()?.setActive(false);
      this.clock()?.setActive(false);
      this.timed.setActive(false);
      this.ladder()?.setActive(false);
    });
  }

  openFreePlay(): void {
    this.go({ name: 'free' });
  }

  openChallenges(): void {
    this.go({ name: 'challenges' });
  }

  openRecords(): void {
    this.go({ name: 'records' });
  }

  deleteRecord(id: string): void {
    const colon = id.indexOf(':');
    const [kind, rest] = [id.slice(0, colon), id.slice(colon + 1)];
    if (kind === 'daily') {
      const level = Number(rest);
      this.records.forgetLevel(level);
      if (this.daily()?.puzzle.level === level) {
        this.daily()?.setActive(false);
        this.daily.set(null); // it would save its old result again
      }
    } else if (kind === 'clock') {
      const slash = rest.lastIndexOf('/');
      const [choice, minutes] = [rest.slice(0, slash), Number(rest.slice(slash + 1))];
      this.clockRecordsStore.deleteRecord(choice, minutes);
      const open = this.clock();
      if (open?.choice === choice && open.minutes === minutes) open.record = 0;
    } else if (kind === 'timed') {
      this.timed.forgetBestTime(rest);
    } else if (kind === 'ladder') {
      const difficulty = Number(rest);
      this.ladderRecords.deleteBest(difficulty);
      if (this.ladder()?.difficulty === difficulty) this.ladder()?.best.set(null);
    }
    this.resets.update((n) => n + 1);
  }

  openTimed(): void {
    this.go({ name: 'timed' });
  }

  setDailyLevel(level: number, on: boolean): void {
    const levels = [...this.dailyLevels()];
    if (!(level in levels)) return;
    levels[level] = on;
    if (!levels.some(Boolean)) return; // at least one
    this.dailyLevels.set(levels);
    writeStoredJson(`${this.id}.daily.levels`, levels);
  }

  resetRecords(): void {
    const kept = new Set([`${this.id}.daily.levels`, `${this.id}.clock.choice`, `${this.id}.clock.custom`]);
    const prefixes = ['daily.', 'clock.', 'ladder.', 'timed.best'].map((p) => `${this.id}.${p}`);
    for (const key of storedKeys()) {
      if (!kept.has(key) && prefixes.some((prefix) => key.startsWith(prefix))) removeStored(key);
    }
    // Puzzles opened before are forgotten too: they'd save their old results again.
    this.daily()?.setActive(false);
    this.daily.set(null);
    this.clock()?.setActive(false);
    this.clock.set(null);
    this.ladder()?.setActive(false);
    this.ladder.set(null);
    this.timed.forgetBestTimes();
    this.resets.update((n) => n + 1);
  }

  ladderBestTimes(): Readonly<Record<string, number>> {
    return this.ladderRecords.bestTimes();
  }

  openLadder(difficulty: number, fresh = false): void {
    if (!this.validDifficulty(difficulty)) return;
    if (fresh) {
      this.ladderRecords.clearRun();
      this.ladder()?.setActive(false);
      this.ladder.set(null);
    }
    this.go({ name: 'ladder', difficulty });
  }

  openDaily(date: string, level: number): void {
    if (this.available(date) && DAILY_LEVELS[level]) this.go({ name: 'daily', date, level });
  }

  clockCustomFields(): { readonly fields: readonly CustomField[]; readonly difficulty: number } {
    const custom = readStored(`${this.id}.clock.custom`);
    const params =
      (custom && customClockParams(this.game, custom)) ||
      clockChoiceParams(this.game, 'medium')[0] ||
      this.game.defaultParams();
    return { fields: this.game.customFields(params), difficulty: this.game.difficultyOf?.(params) ?? 0 };
  }

  customClock(values: Readonly<Record<string, number>>, difficulty: number): { choice: ClockChoice } | { error: string } {
    const game = this.game;
    for (const field of game.customFields(game.defaultParams())) {
      const value = values[field.key];
      if (!Number.isInteger(value) || value < field.min || value > field.max) {
        return { error: `${field.label} must be a whole number from ${field.min} to ${field.max}` };
      }
    }
    let params = game.customParams(values);
    if (game.withDifficulty) params = game.withDifficulty(params, difficulty);
    const error = game.validateParams(params);
    return error ? { error } : { choice: customClockChoice(game, params) };
  }

  openClock(minutes: number, choice: ClockChoice, fresh = false): void {
    if (!this.hasClock || !Number.isInteger(minutes) || minutes < 1) return;
    if (!clockChoiceParams(this.game, choice).length) return;
    this.clockChoice.set(choice);
    writeStored(`${this.id}.clock.choice`, choice);
    if (customClockParams(this.game, choice)) writeStored(`${this.id}.clock.custom`, choice);
    if (fresh) {
      this.clockRecordsStore.clearRun();
      this.clock()?.setActive(false);
      this.clock.set(null);
    }
    this.go({ name: 'clock', minutes, choice });
  }

  /** Back a page: to the home page, or from Beat the clock or timed play to the Challenges page (if opened from it). */
  goHome(): void {
    if (this.screen().name !== 'home') history.back();
  }

  startTutorial(): void {
    this.tutorial.set(this.newTutorial());
  }

  endTutorial(): void {
    markTutorialSeen(this.id);
    this.tutorial.set(null);
  }

  /** Android's back button: closes the tutorial, then goes back a page, then (on the home page) leaves the app. */
  private back(): void {
    if (this.tutorial()) this.endTutorial();
    else if (this.screen().name !== 'home') this.goHome();
    else App.exitApp();
  }

  private go(screen: Screen): void {
    history.pushState({ screen }, '');
    this.show(screen);
  }

  private show(screen: Screen): void {
    if (screen.name === 'daily') {
      const puzzle =
        this.game.daily && DAILY_LEVELS[screen.level] && dailyPuzzle(this.id, this.game.daily, screen.date, screen.level);
      if (!puzzle || !this.available(screen.date)) return this.screen.set(HOME);
      const open = this.daily()?.puzzle;
      if (open?.date !== screen.date || open.level !== screen.level) {
        this.daily()?.setActive(false);
        this.daily.set(new DailyStore(this.game, puzzle, this.records, this.showMistakes, this.dailyLevels));
      }
    }
    if (screen.name === 'clock') {
      const choice = screen.choice ?? 'medium'; // history from before difficulties
      if (!this.hasClock || !clockChoiceParams(this.game, choice).length) return this.screen.set(HOME);
      const open = this.clock();
      if (open?.minutes !== screen.minutes || open.choice !== choice || open.finished()) {
        open?.setActive(false);
        this.clock.set(
          new ClockStore(this.game, this.clockRecordsStore, screen.minutes, choice, this.showMistakes),
        );
      }
    }
    if (screen.name === 'ladder') {
      if (!this.validDifficulty(screen.difficulty)) return this.screen.set(HOME);
      const open = this.ladder();
      if (open?.difficulty !== screen.difficulty || open.result() !== null) {
        open?.setActive(false);
        this.ladder.set(new LadderStore(this.game, this.ladderRecords, screen.difficulty, this.showMistakes));
      }
    }
    if (screen.name === 'home') {
      this.homeVisits.update((n) => n + 1);
      writeStored(`${this.id}.home.visits`, String(this.homeVisits()));
    }
    if (screen.name === 'challenges') {
      this.challengeVisits.update((n) => n + 1);
      writeStored(`${this.id}.challenges.visits`, String(this.challengeVisits()));
    }
    this.screen.set(screen);
  }

  /** The Beat the clock records: Easy, Medium and Hard, then custom sizes; each by time limit. */
  private sortedClockRecords(): (ClockRecordInfo & { readonly choice: ClockChoice })[] {
    const order = (choice: ClockChoice) => {
      const level = CLOCK_LEVELS.indexOf(choice);
      return level >= 0 ? level : CLOCK_LEVELS.length;
    };
    return this.clockRecordsStore
      .records()
      .map((record) => ({ ...record, label: clockChoiceLabel(this.game, record.choice) }))
      .sort(
        (a, b) =>
          order(a.choice) - order(b.choice) ||
          a.label.localeCompare(b.label, undefined, { numeric: true }) ||
          a.minutes - b.minutes,
      );
  }

  /** A difficulty of the game's (0 if it has none). */
  private validDifficulty(difficulty: number): boolean {
    return Number.isInteger(difficulty) && difficulty >= 0 && difficulty < Math.max(1, this.difficulties.length);
  }

  private available(date: string): boolean {
    return availableDays(this.todayDate()).includes(date);
  }

  private newTutorial(): TutorialStore<Params, State, Move, Hint> {
    return new TutorialStore(this.game, this.tutorialSteps, () => this.endTutorial());
  }
}
