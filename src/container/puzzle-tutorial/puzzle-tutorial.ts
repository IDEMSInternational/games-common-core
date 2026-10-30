import { ChangeDetectionStrategy, Component, ElementRef, effect, input, output, viewChild } from '@angular/core';
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

  private readonly caption = viewChild<ElementRef<HTMLElement>>('caption');

  constructor() {
    // Each new caption fades in.
    effect(() => {
      this.controls().text();
      this.caption()?.nativeElement.animate?.(
        [{ opacity: 0, transform: 'translateY(4px)' }, {}],
        { duration: 400, easing: 'ease-out' },
      );
    });
  }
}
