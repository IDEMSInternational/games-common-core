import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { PuzzleMenu } from '../puzzle-menu/puzzle-menu';
import { DayInfo, HomeControls } from '../puzzle-screens';
import { formatTime } from '../shell-controls';

/**
 * The home page: today's daily puzzle with the last 7 days', free play, and
 * how to play. The ☰ menu lives here.
 */
@Component({
  selector: 'puzzle-home',
  imports: [PuzzleMenu],
  templateUrl: './puzzle-home.html',
  styleUrl: './puzzle-home.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PuzzleHome {
  readonly controls = input.required<HomeControls>();

  protected status(day: DayInfo): string {
    switch (day.status) {
      case 'solved':
        return `Solved in ${formatTime(day.time)}`;
      case 'late':
        return `Solved late, in ${formatTime(day.time)}`;
      case 'started':
        return `In progress: ${formatTime(day.time)} so far`;
      default:
        return 'Not played yet';
    }
  }

  protected playLabel(day: DayInfo): string {
    if (day.status === 'solved' || day.status === 'late') return 'See your solution';
    return day.status === 'started' ? 'Continue' : 'Play';
  }

  protected dayLabel(day: DayInfo): string {
    return `${day.dayName}${day.isToday ? ' (today)' : ''}, puzzle #${day.number}: ${this.status(day)}`;
  }
}
