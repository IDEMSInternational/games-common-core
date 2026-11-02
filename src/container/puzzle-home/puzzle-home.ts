import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterEveryRender,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { DayStatus } from '../daily-records';
import { PuzzleMenu } from '../puzzle-menu/puzzle-menu';
import { DayInfo, HomeControls, LevelInfo } from '../puzzle-screens';
import { formatTime } from '../shell-controls';

/**
 * The home page: today's daily puzzles with the last 7 days', Beat the
 * clock and timed play. The ☰ menu lives here. On screens too small for
 * it all, the page zooms out to fit, so it never scrolls. Opening a
 * day's puzzle asks for the level (Easy, Medium or Hard) each time, and
 * Beat the clock for the time limit.
 */
@Component({
  selector: 'puzzle-home',
  imports: [PuzzleMenu],
  templateUrl: './puzzle-home.html',
  styleUrl: './puzzle-home.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'choosing.set(null); choosingTime.set(false)',
    '(window:resize)': 'fit()',
  },
})
export class PuzzleHome {
  readonly controls = input.required<HomeControls>();

  /** How far the page is zoomed out to fit the screen (1: not at all). */
  protected readonly zoom = signal(1);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly content = viewChild.required<ElementRef<HTMLElement>>('content');

  /** The day whose level is being chosen, if any. */
  protected readonly choosing = signal<DayInfo | null>(null);
  /** Choosing Beat the clock's time limit. */
  protected readonly choosingTime = signal(false);
  protected readonly timeLimits = [5, 10, 15, 20];
  protected readonly time = formatTime;

  protected open(day: DayInfo, level: LevelInfo): void {
    this.choosing.set(null);
    this.controls().openDaily(day.date, level.level);
  }

  constructor() {
    afterEveryRender(() => this.fit()); // the content changes height (e.g. a record appears)
  }

  /** Zooms the page out just enough for it all to fit the screen's height. */
  protected fit(): void {
    const host = this.host.nativeElement;
    const style = getComputedStyle(host);
    const room = host.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    const needed = this.content().nativeElement.getBoundingClientRect().height / this.zoom();
    const zoom = needed > 0 && room > 0 ? Math.min(1, Math.floor((room / needed) * 1000) / 1000) : 1;
    if (Math.abs(zoom - this.zoom()) > 0.002) this.zoom.set(zoom);
  }

  protected startClock(minutes: number): void {
    this.choosingTime.set(false);
    this.controls().openClock(minutes, true);
  }

  protected continueClock(minutes: number): void {
    this.choosingTime.set(false);
    this.controls().openClock(minutes);
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
   * A day's circle, in thirds clockwise from the top: Easy, Medium, Hard.
   * A level solved on its day fills its third in orange; solved later, it
   * colours only that third's edge.
   */
  protected thirds(day: DayInfo): string {
    const pie = (colours: string[]) =>
      `conic-gradient(${colours[0]} 0 120deg, ${colours[1]} 120deg 240deg, ${colours[2]} 240deg 360deg)`;
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
