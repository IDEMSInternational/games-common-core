import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { DayStatus } from '../daily-records';
import { PuzzleMenu } from '../puzzle-menu/puzzle-menu';
import { DayInfo, HomeControls, LevelInfo } from '../puzzle-screens';
import { formatTime } from '../shell-controls';

/**
 * The home page: today's daily puzzle with the last 7 days', free play, and
 * how to play. The ☰ menu lives here. Opening a day's puzzle asks for the
 * level (Low, Medium or High) each time.
 */
@Component({
  selector: 'puzzle-home',
  imports: [PuzzleMenu],
  templateUrl: './puzzle-home.html',
  styleUrl: './puzzle-home.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'choosing.set(null)',
  },
})
export class PuzzleHome {
  readonly controls = input.required<HomeControls>();

  /** The day whose level is being chosen, if any. */
  protected readonly choosing = signal<DayInfo | null>(null);

  protected open(day: DayInfo, level: LevelInfo): void {
    this.choosing.set(null);
    this.controls().openDaily(day.date, level.level);
  }

  /** The day's levels played so far: "Low: solved in 0:52 · Medium: 1:20 so far". */
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
   * A day's circle, in thirds clockwise from the top: Low, Medium, High,
   * each shaded orange when solved (paler when solved after the day).
   */
  protected thirds(day: DayInfo): string {
    const [low, medium, high] = day.levels.map((level) =>
      level.status === 'solved'
        ? 'var(--brand)'
        : level.status === 'late'
          ? 'color-mix(in srgb, var(--brand) 35%, var(--surface))'
          : 'var(--surface)',
    );
    const line = 'var(--border)';
    return (
      `conic-gradient(${line} 0 3deg, ${low} 3deg 120deg, ${line} 120deg 123deg, ` +
      `${medium} 123deg 240deg, ${line} 240deg 243deg, ${high} 243deg 360deg)`
    );
  }

  protected dayLabel(day: DayInfo): string {
    return `${day.dayName}${day.isToday ? ' (today)' : ''}, puzzle #${day.number}: ${this.summary(day)}`;
  }
}
