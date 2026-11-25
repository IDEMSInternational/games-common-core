import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PuzzleGame } from '../../engine/puzzle-game';
import { NEXT_PUZZLE_PAUSE } from '../clock-store';
import { LEGAL_VERSION } from '../legal';
import { PuzzleScreens } from '../puzzle-screens';
import { SampleMove, SampleParams, SampleState, sampleGame } from './sample-game';
import { SAMPLE_GAME, SampleApp } from './sample-app';

/**
 * The pause between puzzles in Beat the clock and the ladder, in these tests
 * (0.9 s in the apps), so they don't wait for real.
 */
export const PAUSE_MS = 10;

export type SampleScreens = PuzzleScreens<SampleParams, SampleState, SampleMove, number>;

export interface HarnessOptions {
  /** The date and time the test runs at (only Date is faked; timers run in real time). */
  now?: Date;
  /** The game with Easy and Hard (sampleGame(true)) instead of the one without difficulties. */
  withDifficulties?: boolean;
  /** As on a first launch: the welcome notice and tutorial not seen yet. */
  firstLaunch?: boolean;
}

/**
 * The sample app, opened as a player would, for the shared screens' tests:
 * a fresh device (empty storage) at a fixed date, then helpers to read the
 * screen and play. Call `start()` in beforeEach and `stop()` in afterEach.
 */
export class AppHarness {
  readonly game: PuzzleGame<SampleParams, SampleState, SampleMove>;
  fixture!: ComponentFixture<SampleApp>;
  private readonly options: HarnessOptions;

  constructor(options: HarnessOptions = {}) {
    this.options = options;
    this.game = sampleGame(options.withDifficulties);
  }

  get screens(): SampleScreens {
    return this.fixture.componentInstance.screens;
  }

  get element(): HTMLElement {
    return this.fixture.nativeElement as HTMLElement;
  }

  /** Sets up a fresh device and opens the app (unless `open` is false). */
  async start(open = true): Promise<void> {
    if (this.options.now) vi.useFakeTimers({ toFake: ['Date'], now: this.options.now });
    localStorage.clear();
    if (!this.options.firstLaunch) {
      localStorage.setItem('sample.noticeSeen', LEGAL_VERSION);
      localStorage.setItem('sample.tutorialSeen', '1');
    }
    history.replaceState(null, ''); // the home page
    await this.configure();
    if (open) await this.open();
  }

  stop(): void {
    this.fixture?.destroy();
    vi.useRealTimers();
  }

  /** Opens the app (again, as after closing it: a new app reads what the last one saved). */
  async open(): Promise<void> {
    this.fixture?.destroy();
    this.fixture = TestBed.createComponent(SampleApp);
    await this.fixture.whenStable();
  }

  /** Sets up the testing module afresh (e.g. after TestBed.resetTestingModule). */
  async configure(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [SampleApp],
      providers: [
        { provide: SAMPLE_GAME, useValue: this.game },
        { provide: NEXT_PUZZLE_PAUSE, useValue: PAUSE_MS },
      ],
    }).compileComponents();
  }

  readonly stable = () => this.fixture.whenStable();
  readonly text = (selector: string) => this.element.querySelector(selector)?.textContent?.trim();
  readonly texts = (selector: string) =>
    Array.from(this.element.querySelectorAll(selector), (e) => e.textContent!.trim());

  /** Clicks the matching element (the nth, from 0), then lets the screen update. */
  async click(selector: string, nth = 0): Promise<void> {
    (this.element.querySelectorAll(selector)[nth] as HTMLElement).click();
    await this.stable();
  }

  /** Plays the button on the nth card of the home or Challenges page. */
  readonly play = (card: number) => this.click('puzzle-home .card button.primary', card);

  /** Moves the faked clock on (the time the player takes). */
  readonly later = (seconds: number) => vi.setSystemTime(Date.now() + seconds * 1000);
  /** Real time passing: the clocks' displays, the next puzzle. */
  readonly wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  /** The Android back button, or the page's back arrow: back a page, as browser history. */
  async goHome(): Promise<void> {
    const popped = new Promise((resolve) =>
      window.addEventListener('popstate', resolve, { once: true }),
    );
    this.screens.goHome();
    await popped;
    await this.stable();
  }

  /** Solves the puzzle in these controls, as a player's move. */
  solve(controls: { state(): SampleState; move(move: SampleMove): void }): void {
    controls.move(this.game.solve(controls.state())!);
  }

  /** Stubs the clipboard (the test browser has no share panel, so sharing copies). */
  clipboard(): ReturnType<typeof vi.fn> {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    return writeText;
  }
}

/** The sample game's page, at the end of every shared message. */
export const SAMPLE_PAGE = 'https://idemsinternational.github.io/games-data/sample/';
