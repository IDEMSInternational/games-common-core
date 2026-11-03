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
import { ClockRecords, ClockStore } from './clock-store';
import { DailyRecords, DayStatus } from './daily-records';
import { DailyStore, paramsLabel } from './daily-store';
import { hasSeenTutorial, markTutorialSeen } from './first-run';
import { SessionStore } from './session-store';
import { BestTime, TimedStore } from './timed-store';
import { readStored, writeStored } from './stored-setting';
import { TutorialStore } from './tutorial-store';

export type Screen =
  | { readonly name: 'home' }
  | { readonly name: 'challenges' }
  | { readonly name: 'free' }
  | { readonly name: 'daily'; readonly date: string; readonly level: number }
  | { readonly name: 'clock'; readonly minutes: number }
  | { readonly name: 'timed' };

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

/** A Beat the clock record: the most puzzles solved in a time limit. */
export interface ClockRecord {
  readonly minutes: number;
  readonly solved: number;
}

/** An unfinished Beat the clock run. */
export interface ClockRunInfo {
  readonly minutes: number;
  readonly solved: number;
  /** Milliseconds left. */
  readonly left: number;
}

/** A day's status is the best of its levels'. */
const STATUS_ORDER: readonly DayStatus[] = ['solved', 'late', 'started', 'new'];

/** What the home page needs, independent of the game's types. */
export interface HomeControls {
  readonly id: string;
  readonly title: string;
  readonly version: string;
  /** The home page, or the Challenges page (Beat the clock and timed play). */
  readonly page: Signal<'home' | 'challenges'>;
  /** The daily puzzles that can be played, today's last (null before the first one); empty without daily puzzles. */
  readonly days: Signal<readonly (DayInfo | null)[]>;
  readonly today: Signal<DayInfo | null>;
  /** One of the levels' current streaks: the next one each time the home page opens. */
  readonly streak: Signal<LevelStreak | null>;
  openDaily(date: string, level: number): void;
  /** Whether the game has Beat the clock. */
  readonly hasClock: boolean;
  /** One of the Beat the clock records: the next one each time the Challenges page opens. */
  readonly clockRecord: Signal<ClockRecord | null>;
  readonly clockRun: Signal<ClockRunInfo | null>;
  /**
   * Beat the clock with this time limit: continues the unfinished run, or
   * with `fresh`, starts a new one (forgetting any unfinished run).
   */
  openClock(minutes: number, fresh?: boolean): void;
  /** One of timed play's best times: the next one each time the Challenges page opens. */
  readonly timedBest: Signal<BestTime | null>;
  openTimed(): void;
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
  readonly hasClock: boolean;
  readonly screen = signal<Screen>(HOME);
  /** The tutorial in progress, if any. It runs automatically on first launch. */
  readonly tutorial: WritableSignal<TutorialStore<Params, State, Move, Hint> | null>;
  readonly page = computed(() => (this.screen().name === 'challenges' ? 'challenges' : 'home'));
  /** The puzzle on screen: a daily puzzle, free play, Beat the clock or timed play; null on the home and Challenges pages. */
  readonly play = computed(() => {
    const screen = this.screen();
    if (screen.name === 'free') return this.session;
    if (screen.name === 'daily') return this.daily();
    if (screen.name === 'clock') return this.clock();
    if (screen.name === 'timed') return this.timed;
    return null;
  });

  private readonly game: PuzzleGame<Params, State, Move>;
  private readonly tutorialSteps: Tutorial<Params, State, Move, Hint>;
  private readonly records: DailyRecords;
  private readonly clockRecordsStore: ClockRecords;
  private readonly todayDate = signal(localDay());
  /** False while the app is in the background. */
  private readonly appActive = signal(true);
  /** How many times the home page has opened (remembered): picks the streak shown. */
  private readonly homeVisits: WritableSignal<number>;
  /** Likewise for the Challenges page: picks the record and best time shown. */
  private readonly challengeVisits: WritableSignal<number>;

  readonly days = computed(() => {
    this.screen(); // read the records again on coming back home
    const today = this.todayDate();
    const schedule = this.game.daily;
    if (!schedule) return [];
    return availableDays(today).map((date): DayInfo | null => {
      const puzzles = DAILY_LEVELS.map((_, level) => dailyPuzzle(this.id, schedule, date, level));
      if (!puzzles[0]) return null;
      const levels = puzzles.map((puzzle, level): LevelInfo => ({
        level,
        name: DAILY_LEVELS[level],
        label: paramsLabel(this.game, puzzle!.params),
        status: this.records.status(date, level),
        time: this.records.result(date, level)?.time ?? this.records.game(date, level)?.elapsed ?? 0,
      }));
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
    const records = Object.entries(this.clockRecordsStore.records())
      .map(([minutes, solved]) => ({ minutes: Number(minutes), solved }))
      .sort((a, b) => a.minutes - b.minutes);
    return records.length ? records[visits % records.length] : null;
  });
  readonly clockRun = computed(() => {
    this.screen();
    const run = this.clockRecordsStore.run();
    return run ? { minutes: run.minutes, solved: run.solved, left: run.left } : null;
  });
  readonly timedBest = computed(() => {
    const visits = this.challengeVisits(); // read first: it also brings in new best times
    const times = Object.entries(this.timed.bestTimes())
      .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
      .map(([, best]) => best);
    return times.length ? times[visits % times.length] : null;
  });
  readonly streak = computed(() => {
    const visits = this.homeVisits(); // read first: it also brings in new results
    const today = this.todayDate();
    const streaks = DAILY_LEVELS.map((name, level) => ({ name, days: this.records.streak(today, level) })).filter(
      (streak) => streak.days > 0,
    );
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
    this.session = new SessionStore(game);
    this.timed = new TimedStore(game);
    this.records = new DailyRecords(game.id);
    this.clockRecordsStore = new ClockRecords(game.id);
    this.homeVisits = signal(Number(readStored(`${game.id}.home.visits`)) || 0);
    this.challengeVisits = signal(Number(readStored(`${game.id}.challenges.visits`)) || 0);
    this.hasClock = !!game.beatTheClock;
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
    });
  }

  openFreePlay(): void {
    this.go({ name: 'free' });
  }

  openChallenges(): void {
    this.go({ name: 'challenges' });
  }

  openTimed(): void {
    this.go({ name: 'timed' });
  }

  openDaily(date: string, level: number): void {
    if (this.available(date) && DAILY_LEVELS[level]) this.go({ name: 'daily', date, level });
  }

  openClock(minutes: number, fresh = false): void {
    if (!this.hasClock || !Number.isInteger(minutes) || minutes < 1) return;
    if (fresh) {
      this.clockRecordsStore.clearRun();
      this.clock()?.setActive(false);
      this.clock.set(null);
    }
    this.go({ name: 'clock', minutes });
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
        this.daily.set(new DailyStore(this.game, puzzle, this.records, this.session.showMistakes));
      }
    }
    if (screen.name === 'clock') {
      if (!this.hasClock) return this.screen.set(HOME);
      if (this.clock()?.minutes !== screen.minutes || this.clock()?.finished()) {
        this.clock()?.setActive(false);
        this.clock.set(new ClockStore(this.game, this.clockRecordsStore, screen.minutes, this.session.showMistakes));
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

  private available(date: string): boolean {
    return availableDays(this.todayDate()).includes(date);
  }

  private newTutorial(): TutorialStore<Params, State, Move, Hint> {
    return new TutorialStore(this.game, this.tutorialSteps, () => this.endTutorial());
  }
}
