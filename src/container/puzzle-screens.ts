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
import { WEEKDAYS, availableDays, dailyPuzzle, localDay } from '../engine/daily';
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
  | { readonly name: 'daily'; readonly date: string };

const HOME: Screen = { name: 'home' };

/** A day whose daily puzzle can be played, for the home page. */
export interface DayInfo {
  readonly date: string;
  readonly number: number;
  /** "Friday" */
  readonly dayName: string;
  /** "9×9", "10×12 Hard" */
  readonly label: string;
  readonly status: DayStatus;
  readonly isToday: boolean;
  /** Milliseconds on the clock: the result if solved, else the time so far. */
  readonly time: number;
}

/** What the home page needs, independent of the game's types. */
export interface HomeControls {
  readonly id: string;
  readonly title: string;
  readonly version: string;
  /** The daily puzzles that can be played, today's last (null before the first one); empty without daily puzzles. */
  readonly days: Signal<readonly (DayInfo | null)[]>;
  readonly today: Signal<DayInfo | null>;
  /** Days in a row with the daily puzzle solved on its day. */
  readonly streak: Signal<number>;
  openDaily(date: string): void;
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
    const results = this.records.results();
    return availableDays(today).map((date): DayInfo | null => {
      const puzzle = dailyPuzzle(this.id, schedule, date);
      if (!puzzle) return null;
      return {
        date,
        number: puzzle.number,
        dayName: WEEKDAYS[puzzle.weekday],
        label: paramsLabel(this.game, puzzle.params),
        status: this.records.status(date),
        isToday: date === today,
        time: results[date]?.time ?? this.records.game(date)?.elapsed ?? 0,
      };
    });
  });
  readonly today = computed(() => this.days().find((day) => day?.isToday) ?? null);
  readonly streak = computed(() => {
    this.screen();
    return this.records.streak(this.todayDate());
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

  openDaily(date: string): void {
    if (this.available(date)) this.go({ name: 'daily', date });
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
      const puzzle = this.game.daily && dailyPuzzle(this.id, this.game.daily, screen.date);
      if (!puzzle || !this.available(screen.date)) return this.screen.set(HOME);
      if (this.daily()?.puzzle.date !== screen.date) {
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
