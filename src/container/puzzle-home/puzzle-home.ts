import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { PuzzleMenu } from '../puzzle-menu/puzzle-menu';
import { DayInfo, HomeControls } from '../puzzle-screens';
import { formatTime } from '../shell-controls';

/**
 * The home page: today's daily puzzle with this week's, free play, and
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

  protected readonly letters = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  protected status(day: DayInfo): string {
    switch (day.status) {
      case 'solved':
        return `Solved in ${formatTime(day.time)}`;
      case 'late':
        return `Solved late, in ${formatTime(day.time)}`;
      case 'started':
        return `In progress: ${formatTime(day.time)} so far`;
      case 'future':
        return 'Coming soon';
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
