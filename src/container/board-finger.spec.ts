import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Point } from '../engine/geometry';
import { BoardFinger } from './board-finger';
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
    const motion = moving.querySelector('animateMotion')!;
    expect(motion.getAttribute('path')).toBe('M 0.5 0.5 L 2.5 1.5 L 3 2');
    expect(motion.getAttribute('dur')).toBe('2s'); // the same in every game
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
