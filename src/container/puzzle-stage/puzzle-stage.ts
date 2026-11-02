import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';

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
 * Place it once around everything in a game's app.html. Positions inside
 * it ("position: fixed" included) are relative to the stage.
 */
@Component({
  selector: 'puzzle-stage',
  template: `<div
    class="stage"
    [style.width.px]="size().width"
    [style.height.px]="size().height"
    [style.left.px]="size().left"
    [style.transform]="'scale(' + size().scale + ')'"
  >
    <ng-content />
  </div>`,
  styleUrl: './puzzle-stage.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(window:resize)': 'measure()',
  },
})
export class PuzzleStage {
  private readonly screen = signal({ width: innerWidth, height: innerHeight });

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
    this.screen.set({ width: innerWidth, height: innerHeight });
  }
}
