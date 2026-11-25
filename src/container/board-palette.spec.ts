import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BoardPalette, PaletteChoice, paletteLayout } from './board-palette';

const CHOICES: PaletteChoice[] = [
  { value: 1, label: 'One' },
  { value: 2, label: 'Two' },
];

@Component({
  imports: [BoardPalette],
  template: `
    <svg (pointerdown)="boardTouched = true">
      <g boardPalette [board]="board" [choices]="choices" [(picked)]="picked" [hint]="hint()" />
      <g boardPalette class="drawn" [board]="board" [choices]="choices" [(picked)]="picked">
        <ng-template let-choice>
          <svg:circle class="drawn" [attr.r]="choice.value / 10" />
        </ng-template>
      </g>
    </svg>
  `,
})
class PaletteHost {
  readonly board = { w: 10, h: 8 };
  readonly choices = CHOICES;
  readonly picked = signal(1);
  readonly hint = signal<number | null>(null);
  boardTouched = false;
}

describe('BoardPalette', () => {
  let fixture: ComponentFixture<PaletteHost>;
  const host = () => fixture.componentInstance;
  const choices = () =>
    Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll(
        'g[boardPalette]:not(.drawn) .choice',
      ),
    );

  beforeEach(async () => {
    fixture = TestBed.createComponent(PaletteHost);
    await fixture.whenStable();
  });

  it('lays its choices out in a centred row under the board, sized to its width', () => {
    const { slots, height } = paletteLayout({ w: 10, h: 8 }, 2);
    expect(slots.map((s) => [+s.x.toFixed(2), s.y, s.size])).toEqual([
      [3.45, 8.7, 1.3],
      [5.25, 8.7, 1.3],
    ]);
    expect(height).toBeCloseTo(2);
  });

  it('shows each choice by its label, and which one is picked', () => {
    expect(choices().map((c) => c.getAttribute('aria-label'))).toEqual(['One', 'Two']);
    expect(choices().map((c) => c.textContent!.trim())).toEqual(['One', 'Two']);
    expect(choices().map((c) => c.getAttribute('aria-checked'))).toEqual(['true', 'false']);
  });

  it('picks a choice on touch, without the board taking the touch', async () => {
    choices()[1].dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await fixture.whenStable();
    expect(host().picked()).toBe(2);
    expect(choices().map((c) => c.getAttribute('aria-checked'))).toEqual(['false', 'true']);
    expect(host().boardTouched).toBe(false);
  });

  it('points out a choice (the tutorial)', async () => {
    expect(choices().some((c) => c.querySelector('.board-hint'))).toBe(false);
    host().hint.set(2);
    await fixture.whenStable();
    expect(choices().map((c) => !!c.querySelector('.board-hint'))).toEqual([false, true]);
  });

  it("draws each choice the game's way when it gives a template", () => {
    const drawn = (fixture.nativeElement as HTMLElement).querySelectorAll('circle.drawn');
    expect(Array.from(drawn, (c) => c.getAttribute('r'))).toEqual(['0.1', '0.2']);
  });
});
