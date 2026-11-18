import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Point } from '../engine/geometry';

/** How long the finger takes to show a drag or swipe once, before it starts again. */
const GESTURE_SECONDS = 2;

/**
 * The tutorial's finger on a game's board (an SVG group, in squares),
 * showing the gesture a step asks for: tapping on a point (`at`), or
 * moving through points (`along`: a drag or a swipe), waiting at both ends.
 * Its look is `.board-finger` in theme.scss. Shared by every game's board:
 *
 * ```html
 * <g boardFinger [along]="[start, end]" />
 * <g boardFinger [at]="centre" />
 * ```
 */
@Component({
  selector: 'g[boardFinger]',
  template: `
    @if (path(); as path) {
      <svg:circle class="board-finger" r="0.22">
        <svg:animateMotion
          [attr.path]="path"
          [attr.dur]="duration"
          repeatCount="indefinite"
          keyPoints="0;0;1;1"
          keyTimes="0;0.2;0.8;1"
          calcMode="linear"
        />
      </svg:circle>
    } @else if (at(); as at) {
      <svg:circle class="board-finger tap" [attr.cx]="at.x" [attr.cy]="at.y" r="0.22" />
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BoardFinger {
  /** Where to tap. */
  readonly at = input<Point | null>(null);
  /** The points a drag or swipe goes through, from start to end (used instead of `at`). */
  readonly along = input<readonly Point[] | null>(null);

  protected readonly duration = `${GESTURE_SECONDS}s`;
  protected readonly path = computed(() => {
    const points = this.along();
    if (!points || points.length < 2) return null;
    return 'M ' + points.map((p) => `${p.x} ${p.y}`).join(' L ');
  });
}
