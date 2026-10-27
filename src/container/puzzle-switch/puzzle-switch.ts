import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

/**
 * An on/off switch with a label, for game modes and settings shown under
 * the board (e.g. Slant's "Thinking", Rectangles' "Lock"). Built around a
 * real checkbox, so it works with screen readers and the keyboard.
 *
 *   <puzzle-switch [(checked)]="thinking">Thinking</puzzle-switch>
 */
@Component({
  selector: 'puzzle-switch',
  templateUrl: './puzzle-switch.html',
  styleUrl: './puzzle-switch.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PuzzleSwitch {
  readonly checked = model(false);
  /** Short explanation shown as a tooltip and read by screen readers. */
  readonly description = input('');
}
