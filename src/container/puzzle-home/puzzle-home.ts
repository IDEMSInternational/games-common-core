import { ChangeDetectionStrategy, Component, ElementRef, input, signal, viewChild } from '@angular/core';
import { DAILY_LEVELS } from '../../engine/daily';
import { CLOCK_LEVELS, ClockChoice } from '../clock-store';
import { DayStatus } from '../daily-records';
import { PuzzleMenu } from '../puzzle-menu/puzzle-menu';
import { ClockRunInfo, DayInfo, HomeControls, LevelInfo } from '../puzzle-screens';
import { formatTime } from '../shell-controls';

/** The Beat the clock sheet's custom size option. */
const CUSTOM = 'custom';

/**
 * The home page: today's daily puzzles with the last 7 days', free play
 * and Challenges. The ☰ menu lives here. Opening a day's puzzle asks for
 * the level (Easy, Medium or Hard) each time.
 *
 * Also the Challenges page (see HomeControls.page), in the same style:
 * Beat the clock, which asks for the difficulty (Easy, Medium, Hard or a
 * custom size) and the time limit, timed play, and the ladder, which
 * asks for the difficulty (if the game has them) or whether to continue.
 */
@Component({
  selector: 'puzzle-home',
  imports: [PuzzleMenu],
  templateUrl: './puzzle-home.html',
  styleUrl: './puzzle-home.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'choosing.set(null); choosingTime.set(false); choosingLadder.set(false)',
  },
})
export class PuzzleHome {
  readonly controls = input.required<HomeControls>();

  /** The day whose level is being chosen, if any. */
  protected readonly choosing = signal<DayInfo | null>(null);
  /** Choosing Beat the clock's difficulty and time limit. */
  protected readonly choosingTime = signal(false);
  protected readonly timeLimits = [1, 2, 5, 10];
  protected readonly time = formatTime;
  protected readonly CUSTOM = CUSTOM;
  protected readonly clockLevels = CLOCK_LEVELS.map((choice, i) => ({ choice, name: DAILY_LEVELS[i] }));
  /** The difficulty chosen in the sheet, or CUSTOM. */
  protected readonly clockChoice = signal<ClockChoice>('medium');
  /** The custom size's fields, as the sheet opened. */
  protected readonly customFields = signal<ReturnType<HomeControls['clockCustomFields']>>({ fields: [], difficulty: 0 });
  protected readonly customError = signal<string | null>(null);
  private readonly customSize = viewChild<ElementRef<HTMLFormElement>>('customSize');

  /** Opens Beat the clock's sheet, at the difficulty (or custom size) last played. */
  protected openClockChooser(): void {
    const c = this.controls();
    const last = c.clockChoice();
    this.clockChoice.set(CLOCK_LEVELS.includes(last) ? last : CUSTOM);
    this.customFields.set(c.clockCustomFields());
    this.customError.set(null);
    this.choosingTime.set(true);
  }

  /** Choosing the ladder's difficulty, or whether to continue the unfinished one. */
  protected readonly choosingLadder = signal(false);
  /** The ladder's best times by difficulty, as the sheet opened. */
  protected readonly ladderBests = signal<Readonly<Record<string, number>>>({});

  /** The ladder: straight up it if there's nothing to choose, else the sheet. */
  protected playLadder(): void {
    const c = this.controls();
    if (c.difficulties.length === 0 && !c.ladderRun()) {
      c.openLadder(0, true);
      return;
    }
    this.ladderBests.set(c.ladderBestTimes());
    this.choosingLadder.set(true);
  }

  protected startLadder(difficulty: number): void {
    this.choosingLadder.set(false);
    this.controls().openLadder(difficulty, true);
  }

  protected continueLadder(difficulty: number): void {
    this.choosingLadder.set(false);
    this.controls().openLadder(difficulty);
  }

  protected chooseCustomSize(): void {
    this.customError.set(null);
    this.clockChoice.set(CUSTOM);
  }

  protected open(day: DayInfo, level: LevelInfo): void {
    this.choosing.set(null);
    this.controls().openDaily(day.date, level.level);
  }

  /** A new run at the chosen difficulty, or custom size if it's valid. */
  protected startClock(minutes: number): void {
    let choice = this.clockChoice();
    if (choice === CUSTOM) {
      const form = this.customSize()?.nativeElement;
      if (!form) return;
      const data = new FormData(form);
      const values: Record<string, number> = {};
      for (const field of this.customFields().fields) values[field.key] = Number(data.get(field.key));
      const custom = this.controls().customClock(values, Number(data.get('difficulty') ?? 0));
      if ('error' in custom) {
        this.customError.set(custom.error);
        return;
      }
      choice = custom.choice;
    }
    this.choosingTime.set(false);
    this.controls().openClock(minutes, choice, true);
  }

  protected continueClock(run: ClockRunInfo): void {
    this.choosingTime.set(false);
    this.controls().openClock(run.minutes, run.choice);
  }

  protected startCustomClock(event: Event): void {
    event.preventDefault();
    const minutes = Number(new FormData(event.target as HTMLFormElement).get('minutes'));
    if (Number.isInteger(minutes) && minutes >= 1 && minutes <= 60) this.startClock(minutes);
  }

  /** The day's levels played so far: "Easy: solved in 0:52 · Medium: 1:20 so far". */
  protected summary(day: DayInfo): string {
    const played = day.levels.filter((level) => level.status !== 'new');
    if (played.length === 0) return 'Not played yet';
    return played.map((level) => `${level.name}: ${this.status(level.status, level.time)}`).join(' · ');
  }

  protected status(status: DayStatus, time: number): string {
    switch (status) {
      case 'solved':
        return `solved in ${formatTime(time)}`;
      case 'late':
        return `solved late, in ${formatTime(time)}`;
      case 'started':
        return `${formatTime(time)} so far`;
      default:
        return 'not played yet';
    }
  }

  /**
   * A day's circle, shared clockwise from the top between the levels the
   * player plays (thirds for Easy, Medium and Hard; halves for two; whole
   * for one). A level solved on its day fills its part in orange; solved
   * later, it colours only that part's edge.
   */
  protected segments(day: DayInfo): string {
    const pie = (colours: string[]) => {
      const share = 360 / colours.length;
      const stops = colours.map((colour, i) => `${colour} ${i * share}deg ${(i + 1) * share}deg`);
      return `conic-gradient(${stops.join(', ')})`;
    };
    const fills = day.levels.map((l) => (l.status === 'solved' ? 'var(--brand)' : 'var(--surface)'));
    const edges = day.levels.map((l) =>
      l.status === 'solved' || l.status === 'late' ? 'var(--brand)' : 'var(--border)',
    );
    // The fill inside the (transparent) border, the edges under it.
    return `${pie(fills)} padding-box, ${pie(edges)} border-box`;
  }

  protected dayLabel(day: DayInfo): string {
    return `${day.dayName}${day.isToday ? ' (today)' : ''}, puzzle #${day.number}: ${this.summary(day)}`;
  }
}
