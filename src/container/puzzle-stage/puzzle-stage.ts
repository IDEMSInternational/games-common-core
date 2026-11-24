import { ChangeDetectionStrategy, Component, computed, inject, isDevMode, signal } from '@angular/core';
import { CelebrationSize, PuzzleFireworks } from '../puzzle-fireworks/puzzle-fireworks';
import { ThemeStore } from '../theme-store';

/** The screen the apps are designed for (an iPhone 16), in CSS pixels. */
export const DESIGN_WIDTH = 393;
export const DESIGN_HEIGHT = 852;
/** The widest the stage gets, in design pixels (large tablets), so buttons don't stretch across the screen. */
const MAX_WIDTH = 700;

/**
 * The whole app, laid out for a 393 × 852 screen and scaled to the real
 * one, so it looks the same on every phone. The scale is whichever of the
 * screen's width and height runs out first; the space left in the other
 * direction is used, not left empty: on long phones the stage is taller
 * (the home page spreads its cards out, the board grows), on wide screens
 * (tablets) it's wider, up to MAX_WIDTH. Nothing scrolls, except the ☰
 * menu's pages and the welcome notice's text.
 *
 * The on-screen keyboard covers the bottom of the app rather than shrinking
 * it: Android makes the window shorter while it's open, and the stage
 * ignores that, sliding up only if the box being typed in would be hidden.
 *
 * Place it once around everything in a game's app.html. Positions inside
 * it ("position: fixed" included) are relative to the stage.
 *
 * In development builds, fireworks('small' | 'normal' | 'big') in the
 * browser console plays a celebration over the whole stage, for testing.
 */
@Component({
  selector: 'puzzle-stage',
  imports: [PuzzleFireworks],
  template: `<div
    class="stage"
    [style.width.px]="size().width"
    [style.height.px]="size().height"
    [style.left.px]="size().left"
    [style.top.px]="-lift()"
    [style.transform]="'scale(' + size().scale + ')'"
  >
    <ng-content />
    @if (demo(); as demo) {
      <puzzle-fireworks [size]="demo" [style.z-index]="2000" (done)="this.demo.set(null)" />
    }
  </div>`,
  styleUrl: './puzzle-stage.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(window:resize)': 'measure()',
  },
})
export class PuzzleStage {
  /** Created here, so the light or dark theme applies from the start. */
  private readonly theme = inject(ThemeStore);
  private readonly screen = signal({ width: innerWidth, height: innerHeight });
  /** How far the stage slides up, in screen pixels, to keep a box above the keyboard. */
  protected readonly lift = signal(0);
  /** A celebration playing for testing (see above). */
  protected readonly demo = signal<CelebrationSize | null>(null);

  constructor() {
    if (isDevMode()) {
      (globalThis as { fireworks?: (size?: CelebrationSize) => void }).fireworks = (size = 'normal') => {
        this.demo.set(null);
        setTimeout(() => this.demo.set(size));
      };
    }
  }

  /** The stage's size in design pixels, its scale, and its left edge on screen. */
  protected readonly size = computed(() => {
    const { width, height } = this.screen();
    const scale = Math.min(width / DESIGN_WIDTH, height / DESIGN_HEIGHT);
    const stageWidth = Math.min(width / scale, MAX_WIDTH);
    return {
      scale,
      width: stageWidth,
      height: height / scale,
      left: (width - stageWidth * scale) / 2,
    };
  });

  protected measure(): void {
    const { width, height } = this.screen();
    const typing = document.activeElement;
    if (innerWidth === width && innerHeight < height && isTextBox(typing)) {
      // The keyboard has opened (or grown): keep the stage as it was, under the
      // keyboard, and slide it up just enough to keep the box in view.
      const bottom = typing.getBoundingClientRect().bottom + this.lift(); // where it'd be unlifted
      this.lift.set(Math.max(0, bottom + KEYBOARD_GAP - innerHeight));
      return;
    }
    this.lift.set(0);
    this.screen.set({ width: innerWidth, height: innerHeight });
  }
}

/** Space kept between the box being typed in and the keyboard, in screen pixels. */
const KEYBOARD_GAP = 12;

/** True for a box that opens the on-screen keyboard. */
function isTextBox(element: Element | null): element is HTMLElement {
  if (element instanceof HTMLTextAreaElement) return true;
  if (!(element instanceof HTMLInputElement)) return false;
  return !['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file'].includes(
    element.type,
  );
}
