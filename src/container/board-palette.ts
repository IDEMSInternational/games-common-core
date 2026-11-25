import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  computed,
  contentChild,
  input,
  model,
} from '@angular/core';
import { Size } from '../engine/geometry';

/** One choice in a palette: what it stands for, and its name for screen readers. */
export interface PaletteChoice {
  readonly value: number;
  readonly label: string;
}

/** A choice's square on the board, in squares: its top-left corner and side. */
export interface PaletteSlot {
  readonly x: number;
  readonly y: number;
  readonly size: number;
}

/**
 * Sizes, as parts of the board's width, so that a palette looks the same
 * on screen whatever the board's size: a choice's side, the gap between
 * choices, and the space between the board and the palette.
 */
const CHOICE = 0.13;
const GAP = 0.05;
const MARGIN = 0.07;

/**
 * Where a palette of `count` choices goes under a board: a centred row,
 * and how much height it adds below the board (for the SVG's viewBox).
 */
export function paletteLayout(
  board: Size,
  count: number,
): { slots: PaletteSlot[]; height: number } {
  const size = CHOICE * board.w;
  const gap = GAP * board.w;
  const total = count * size + (count - 1) * gap;
  const left = (board.w - total) / 2;
  const y = board.h + MARGIN * board.w;
  const slots = Array.from({ length: count }, (_, i) => ({ x: left + i * (size + gap), y, size }));
  return { slots, height: MARGIN * board.w + size };
}

/**
 * A palette under a game's board (an SVG group, in squares): a row of
 * choices, one of them picked, e.g. the colour a tap gives (Unruly) or a
 * number to enter. Picking happens on touch, without moving the board's
 * own gestures. Each choice is drawn by the game, in a 1 × 1 square, with
 * an `ng-template` (its context is the choice); without one, its label is
 * written. Its look is `.board-palette` in theme.scss. Shared by every
 * game's board:
 *
 * ```html
 * <g boardPalette [board]="state" [choices]="choices" [(picked)]="colour">
 *   <ng-template let-choice><svg:rect ... /></ng-template>
 * </g>
 * ```
 */
@Component({
  selector: 'g[boardPalette]',
  imports: [NgTemplateOutlet],
  host: { class: 'board-palette', role: 'radiogroup' },
  template: `
    @for (item of items(); track item.choice.value) {
      <svg:g
        class="choice"
        role="radio"
        tabindex="0"
        [class.picked]="item.choice.value === picked()"
        [attr.aria-checked]="item.choice.value === picked()"
        [attr.aria-label]="item.choice.label"
        (pointerdown)="pick($event, item.choice.value)"
        (keydown.enter)="picked.set(item.choice.value)"
        (keydown.space)="picked.set(item.choice.value)"
      >
        <svg:rect
          class="back"
          [attr.x]="item.slot.x"
          [attr.y]="item.slot.y"
          [attr.width]="item.slot.size"
          [attr.height]="item.slot.size"
          [attr.rx]="item.slot.size * 0.16"
        />
        <svg:g
          [attr.transform]="
            'translate(' + item.slot.x + ' ' + item.slot.y + ') scale(' + item.slot.size + ')'
          "
        >
          @if (drawing(); as drawn) {
            <ng-container *ngTemplateOutlet="drawn; context: { $implicit: item.choice }" />
          } @else {
            <svg:text class="label" x="0.5" y="0.54">{{ item.choice.label }}</svg:text>
          }
        </svg:g>
        @if (item.choice.value === hint()) {
          <svg:rect
            class="board-hint"
            [attr.x]="item.slot.x - item.slot.size * 0.08"
            [attr.y]="item.slot.y - item.slot.size * 0.08"
            [attr.width]="item.slot.size * 1.16"
            [attr.height]="item.slot.size * 1.16"
            [attr.rx]="item.slot.size * 0.22"
          />
        }
      </svg:g>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BoardPalette {
  /** The board's size, in squares: the palette goes under it. */
  readonly board = input.required<Size>();
  readonly choices = input.required<readonly PaletteChoice[]>();
  /** The value of the choice picked. */
  readonly picked = model.required<number>();
  /** A choice to point out (the tutorial), or null. */
  readonly hint = input<number | null>(null);

  /** How the game draws a choice, if it does. */
  protected readonly drawing = contentChild(TemplateRef);

  protected readonly items = computed(() => {
    const { slots } = paletteLayout(this.board(), this.choices().length);
    return this.choices().map((choice, i) => ({ choice, slot: slots[i] }));
  });

  /** Picks a choice; the touch stays with the palette, not the board's gestures. */
  protected pick(event: PointerEvent, value: number): void {
    event.stopPropagation();
    event.preventDefault();
    this.picked.set(value);
  }
}
