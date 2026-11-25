import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PuzzleStage } from './puzzle-stage';

@Component({
  imports: [PuzzleStage],
  template: `<puzzle-stage><input type="number" /><button type="button">Go</button></puzzle-stage>`,
})
class StageHost {}

/** The whole app, scaled to the screen; the on-screen keyboard goes over it. */
describe('PuzzleStage', () => {
  let fixture: ComponentFixture<StageHost>;
  const original = { width: innerWidth, height: innerHeight };

  /** Resizes the window, as the phone does (e.g. when its keyboard opens or closes). */
  async function resize(width: number, height: number): Promise<void> {
    Object.defineProperty(window, 'innerWidth', { value: width, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: height, configurable: true });
    window.dispatchEvent(new Event('resize'));
    await fixture.whenStable();
  }

  const stage = () => fixture.nativeElement.querySelector('.stage') as HTMLElement;
  const input = () => fixture.nativeElement.querySelector('input') as HTMLInputElement;
  /** Puts the box's bottom edge this far down the unlifted stage, in screen pixels. */
  const boxBottomAt = (bottom: number) =>
    vi
      .spyOn(input(), 'getBoundingClientRect')
      .mockImplementation(
        () => ({ bottom: bottom + parseFloat(stage().style.top || '0') }) as DOMRect,
      );

  beforeEach(async () => {
    Object.defineProperty(window, 'innerWidth', { value: 393, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 852, configurable: true });
    fixture = TestBed.createComponent(StageHost);
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.destroy();
    vi.restoreAllMocks();
    Object.defineProperty(window, 'innerWidth', { value: original.width, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: original.height, configurable: true });
  });

  it('scales the design to the screen', async () => {
    expect(stage().style.transform).toBe('scale(1)');
    await resize(786, 1704); // twice the size
    expect(stage().style.transform).toBe('scale(2)');
  });

  it('lets the keyboard cover the app while typing, instead of shrinking it', async () => {
    input().focus();
    boxBottomAt(200); // near the top: still in view above the keyboard
    await resize(393, 500);
    expect(stage().style.transform).toBe('scale(1)');
    expect(stage().style.height).toBe('852px');
    expect(stage().style.top).toBe('0px');

    await resize(393, 852); // the keyboard closes
    expect(stage().style.transform).toBe('scale(1)');
    expect(stage().style.top).toBe('0px');
  });

  it('slides up just enough to keep the box being typed in above the keyboard', async () => {
    input().focus();
    boxBottomAt(600); // the keyboard will cover from 500 down
    await resize(393, 500);
    expect(stage().style.transform).toBe('scale(1)');
    expect(stage().style.top).toBe('-112px'); // 600 - 500, plus a 12-pixel gap

    await resize(393, 852);
    expect(stage().style.top).toBe('0px');
  });

  it('still shrinks for a shorter window when nothing is being typed', async () => {
    fixture.nativeElement.querySelector('button').focus();
    await resize(393, 426);
    expect(stage().style.transform).toBe('scale(0.5)');
  });
});
