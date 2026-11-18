import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  input,
  viewChild,
} from '@angular/core';
import { Point } from '../engine/geometry';

/** How long the finger takes to show a drag or swipe once, before it starts again. */
const GESTURE_SECONDS = 2;
/** The parts of each loop the finger waits at the start and, after moving, at the end. */
const START_WAIT = 0.2;
const END_WAIT = 0.2;

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
    @if (gesture(); as g) {
      <svg:circle
        #moving
        class="board-finger"
        [attr.cx]="g.start.x"
        [attr.cy]="g.start.y"
        r="0.22"
      />
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

  /** The gesture to show, as its start and its keyframes; the same for equal points. */
  protected readonly gesture = computed(
    () => {
      const points = this.along();
      return points && points.length > 1
        ? { start: points[0], frames: gestureFrames(points) }
        : null;
    },
    { equal: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
  );
  private readonly moving = viewChild<ElementRef<SVGCircleElement>>('moving');

  constructor() {
    // Whenever the finger appears or its gesture changes, it starts at the
    // moment it begins to move: straight into the gesture, without the wait
    // at the start that later loops have.
    afterRenderEffect((onCleanup) => {
      const gesture = this.gesture();
      const circle = this.moving()?.nativeElement;
      if (!gesture || !circle?.animate) return; // the test DOM has no animations
      const animation = circle.animate(gesture.frames, {
        duration: GESTURE_SECONDS * 1000,
        delay: -START_WAIT * GESTURE_SECONDS * 1000,
        iterations: Infinity,
      });
      onCleanup(() => animation.cancel());
    });
  }
}

/**
 * The finger's keyframes for a gesture through `points`, moving it from the
 * first point (where it is drawn): wait, move at an even speed, wait.
 */
export function gestureFrames(points: readonly Point[]): Keyframe[] {
  const [first] = points;
  const lengths = points.slice(1).map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y));
  const total = lengths.reduce((a, b) => a + b, 0) || 1;
  const moving = 1 - START_WAIT - END_WAIT;
  const at = (p: Point, offset: number): Keyframe => ({
    offset,
    transform: `translate(${p.x - first.x}px, ${p.y - first.y}px)`,
  });

  const frames = [at(first, 0), at(first, START_WAIT)];
  let done = 0;
  points.slice(1).forEach((p, i) => {
    done += lengths[i];
    frames.push(at(p, START_WAIT + (moving * done) / total));
  });
  frames.push(at(points[points.length - 1], 1));
  return frames;
}
