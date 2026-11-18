import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { BoardLabel } from './board-label';

/**
 * A pill-shaped label on a game's board (an SVG group, in squares), placed
 * by placeLabel: a tutorial note, or e.g. Rectangles' size while drawing.
 * Its look is `.board-label` in theme.scss (`.note` for a tutorial note).
 * Shared by every game's board:
 *
 * ```html
 * <g boardLabel class="note" role="status" [label]="label" />
 * ```
 */
@Component({
  selector: 'g[boardLabel]',
  host: { class: 'board-label' },
  template: `
    @let l = label();
    <svg:rect
      [attr.x]="l.x"
      [attr.y]="l.y"
      [attr.width]="l.width"
      [attr.height]="l.height"
      [attr.rx]="l.height / 2"
    />
    <svg:text [attr.x]="l.x + l.width / 2" [attr.y]="l.y + l.height / 2 + 0.02">
      {{ l.text }}
    </svg:text>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BoardLabelView {
  readonly label = input.required<BoardLabel>();
}
