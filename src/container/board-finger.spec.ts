import { ApplicationRef, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Point } from '../engine/geometry';
import { BoardFinger, gestureFrames } from './board-finger';
import { BoardLabel } from './board-label';
import { BoardLabelView } from './board-label-view';

@Component({
  imports: [BoardFinger, BoardLabelView],
  template: `
    <svg viewBox="0 0 5 5">
      <g boardFinger [at]="at()" [along]="along()" />
      @if (label(); as label) {
        <g boardLabel class="note" role="status" [label]="label" />
      }
    </svg>
  `,
})
class Board {
  readonly at = signal<Point | null>(null);
  readonly along = signal<Point[] | null>(null);
  readonly label = signal<BoardLabel | null>(null);
}

describe('The tutorial finger and labels on a board', () => {
  function render() {
    const fixture = TestBed.createComponent(Board);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    return {
      board: fixture.componentInstance,
      update: () => fixture.detectChanges(),
      fingers: () => [...el.querySelectorAll('circle.board-finger')],
      label: () => el.querySelector('g.board-label'),
    };
  }

  it('taps on a point, or moves through points, in SVG', () => {
    const { board, update, fingers } = render();
    expect(fingers()).toEqual([]);

    board.at.set({ x: 2.5, y: 1.5 });
    update();
    const [tap] = fingers();
    expect(tap.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(tap.classList).toContain('tap');
    expect([tap.getAttribute('cx'), tap.getAttribute('cy')]).toEqual(['2.5', '1.5']);

    board.along.set([
      { x: 0.5, y: 0.5 },
      { x: 2.5, y: 1.5 },
      { x: 3, y: 2 },
    ]);
    update(); // a gesture to show is shown instead of a tap
    const [moving] = fingers();
    expect(fingers().length).toBe(1);
    expect(moving.classList).not.toContain('tap');
    // drawn at the gesture's start, where it waits when not animated
    expect([moving.getAttribute('cx'), moving.getAttribute('cy')]).toEqual(['0.5', '0.5']);
  });

  it('moves through the points at an even speed, waiting at both ends', () => {
    const frames = gestureFrames([
      { x: 0.5, y: 0.5 },
      { x: 3.5, y: 0.5 },
      { x: 3.5, y: 1.5 },
    ]);
    expect(frames.map((f) => f['transform'])).toEqual([
      'translate(0px, 0px)',
      'translate(0px, 0px)', // waits at the start
      'translate(3px, 0px)',
      'translate(3px, 1px)',
      'translate(3px, 1px)', // waits at the end
    ]);
    const offsets = [0, 0.2, 0.2 + 0.6 * 0.75, 0.8, 1]; // 3 of the 4 squares to go at 0.65
    frames.forEach((f, i) => expect(f.offset).toBeCloseTo(offsets[i]));
  });

  it('starts a drag or swipe moving at once whenever it appears or changes', async () => {
    // The browser's animations; the test DOM has none, so record them.
    const started: { frames: Keyframe[]; options: KeyframeAnimationOptions; cancel: () => void }[] =
      [];
    const proto = Element.prototype as unknown as {
      animate?: (frames: Keyframe[], options: KeyframeAnimationOptions) => unknown;
    };
    proto.animate = function (frames: Keyframe[], options: KeyframeAnimationOptions) {
      const animation = { frames, options, cancel: vi.fn() };
      started.push(animation);
      return animation;
    };
    try {
      const { board, update } = render();
      const step = async (along: Point[] | null) => {
        board.along.set(along);
        update();
        await TestBed.inject(ApplicationRef).whenStable();
      };
      await step([
        { x: 0.5, y: 0.5 },
        { x: 2.5, y: 0.5 },
      ]);
      expect(started.length).toBe(1);
      expect(started[0].options).toEqual({ duration: 2000, delay: -400, iterations: Infinity });
      // 2 seconds a loop in every game; started 0.4 s in, past the wait at the start

      await step([
        { x: 0.5, y: 0.5 },
        { x: 2.5, y: 0.5 },
      ]); // the same gesture: it carries on
      expect(started.length).toBe(1);

      await step([
        { x: 0.5, y: 1.5 },
        { x: 3.5, y: 1.5 },
      ]); // the next step's gesture
      expect(started.length).toBe(2);
      expect(started[0].cancel).toHaveBeenCalled();

      await step(null); // hidden, e.g. while the player draws
      await step([
        { x: 0.5, y: 1.5 },
        { x: 3.5, y: 1.5 },
      ]);
      expect(started.length).toBe(3);
    } finally {
      delete proto.animate;
    }
  });

  it('draws a label as a pill with its text', () => {
    const { board, update, label } = render();
    expect(label()).toBeNull();

    board.label.set({ text: 'Shines on a light', x: 1, y: 0.5, width: 3, height: 0.6 });
    update();
    const g = label()!;
    expect(g.classList).toContain('note');
    expect(g.getAttribute('role')).toBe('status');
    const rect = g.querySelector('rect')!;
    expect(['x', 'y', 'width', 'height', 'rx'].map((a) => rect.getAttribute(a))).toEqual([
      '1',
      '0.5',
      '3',
      '0.6',
      '0.3',
    ]);
    const text = g.querySelector('text')!;
    expect(text.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(text.textContent!.trim()).toBe('Shines on a light');
    expect(Number(text.getAttribute('x'))).toBe(2.5); // centred
    expect(Number(text.getAttribute('y'))).toBeCloseTo(0.82);
  });
});
