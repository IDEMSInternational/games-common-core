import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TutorialControls } from '../tutorial-store';

/**
 * The frame for a game's tutorial: instruction card, the game's board
 * (projected), progress dots and Skip/Next. Shared by every game.
 */
@Component({
  selector: 'puzzle-tutorial',
  templateUrl: './puzzle-tutorial.html',
  styleUrl: './puzzle-tutorial.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PuzzleTutorial {
  readonly controls = input.required<TutorialControls>();
  readonly skip = output<void>();

  protected readonly dots = (count: number) => Array.from({ length: count }, (_, i) => i);
}
