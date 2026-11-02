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
import { DailyRecords, DayStatus } from './daily-records';
import { DailyStore, paramsLabel } from './daily-store';
import { hasSeenTutorial, markTutorialSeen } from './first-run';
import { SessionStore } from './session-store';
import { TutorialStore } from './tutorial-store';

export type Screen =
  | { readonly name: 'home' }
  | { readonly name: 'free' }
  | { readonly name: 'daily'; readonly date: string; readonly level: number };

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
  /** Low, Medium and High. */
  readonly levels: readonly LevelInfo[];
}

/** One level of a day's daily puzzle. */
export interface LevelInfo {
  readonly level: number;
  /** "Low" */
  readonly name: string;
  /** "9×9", "10×12 Hard" */
  readonly label: string;
  readonly status: DayStatus;
  /** Milliseconds on the clock: the result if solved, else the time so far. */
  readonly time: number;
}

/** A day's status is the best of its levels'. */
const STATUS_ORDER: readonly DayStatus[] = ['solved', 'late', 'started', 'new'];

/** What the home page needs, independent of the game's types. */
export interface HomeControls {
  readonly id: string;
  readonly title: string;
  readonly version: string;
  /** The daily puzzles that can be played, today's last (null before the first one); empty without daily puzzles. */
  readonly days: Signal<readonly (DayInfo | null)[]>;
  readonly today: Signal<DayInfo | null>;
  /** The most days in a row with a daily puzzle solved on its day. */
  readonly bestStreak: Signal<number>;
  openDaily(date: string, level: number): void;
  openFreePlay(): void;
  startTutorial(): void;
}

/**
 * Which screen a game's app shows: the home page, free play, a daily
 * puzzle, or the tutorial over any of them (on first launch, over the
 * home page). Each screen is a browser history entry, so Back (the
 * browser's, or Android's back button) returns to the home page.
 *
 * Create it in an injection context (e.g. a component field).
 */
export class PuzzleScreens<Params, State, Move, Hint> implements HomeControls {
  readonly id: string;
  readonly title: string;
  readonly version: string;
  /** Free play, continuing where the player left off. */
  readonly session: SessionStore<Params, State, Move>;
  /** The daily puzzle last opened. */
  readonly daily = signal<DailyStore<Params, State, Move> | null>(null);
  readonly screen = signal<Screen>(HOME);
  /** The tutorial in progress, if any. It runs automatically on first launch. */
  readonly tutorial: WritableSignal<TutorialStore<Params, State, Move, Hint> | null>;
  /** The puzzle on screen: free play or a daily puzzle; null on the home page. */
  readonly play = computed(() => {
    const screen = this.screen();
    return screen.name === 'free' ? this.session : screen.name === 'daily' ? this.daily() : null;
  });

  private readonly game: PuzzleGame<Params, State, Move>;
  private readonly tutorialSteps: Tutorial<Params, State, Move, Hint>;
  private readonly records: DailyRecords;
  private readonly todayDate = signal(localDay());
  /** False while the app is in the background. */
  private readonly appActive = signal(true);

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
  readonly bestStreak = computed(() => {
    this.screen();
    return this.records.bestStreak();
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
    this.records = new DailyRecords(game.id);
    this.records.clearOldGames(this.todayDate());
    this.tutorial = signal(hasSeenTutorial(game.id) ? null : this.newTutorial());

    // After a reload, stay on the same screen.
    this.show((history.state as { screen?: Screen } | null)?.screen ?? HOME);
    const onPopState = (event: PopStateEvent) =>
      this.show((event.state as { screen?: Screen } | null)?.screen ?? HOME);
    window.addEventListener('popstate', onPopState);

    // The daily puzzle's clock runs only while it's on screen.
    effect(() =>
      this.daily()?.setActive(
        this.screen().name === 'daily' && !this.tutorial() && this.appActive(),
      ),
    );

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
    });
  }

  openFreePlay(): void {
    this.go({ name: 'free' });
  }

  openDaily(date: string, level: number): void {
    if (this.available(date) && DAILY_LEVELS[level]) this.go({ name: 'daily', date, level });
  }

  /** Back to the home page. */
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

  /** Android's back button: closes the tutorial, then goes home, then leaves the app. */
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
    this.screen.set(screen);
  }

  private available(date: string): boolean {
    return availableDays(this.todayDate()).includes(date);
  }

  private newTutorial(): TutorialStore<Params, State, Move, Hint> {
    return new TutorialStore(this.game, this.tutorialSteps, () => this.endTutorial());
  }
}
