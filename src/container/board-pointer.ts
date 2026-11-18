import { Point, screenToBoard } from '../engine/geometry';

/** What a finger does on a board (a drag, a swipe, a tap): it follows the finger until it lifts. */
export interface BoardGesture {
  moveTo(at: Point): void;
}

/**
 * The finger on a game's SVG board, shared by every game's board. It turns
 * pointer events into board positions (in squares) and keeps the gesture
 * in progress; the game decides what the gesture means. One finger at a
 * time: the first one holds on to the board until it lifts, and only the
 * main mouse button counts.
 *
 * ```ts
 * private readonly pointer = new BoardPointer<MyTouch>(() => this.svg().nativeElement);
 * onPointerDown(event) { this.pointer.down(event, (at) => new MyTouch(this.state(), at)); }
 * onPointerMove(event) { this.pointer.move(event); }
 * onPointerUp(event) { const move = this.pointer.up(event)?.finish(); ... }
 * ```
 */
export class BoardPointer<G extends BoardGesture> {
  private readonly svg: () => SVGSVGElement;
  private readonly toPosition: (at: Point) => Point;
  private gesture: G | null = null;

  /**
   * `svg` gives the board's SVG, drawn in squares; `toPosition`, if given,
   * changes every position before the gesture gets it (e.g. to the square
   * under it, with squareAt).
   */
  constructor(svg: () => SVGSVGElement, toPosition: (at: Point) => Point = (at) => at) {
    this.svg = svg;
    this.toPosition = toPosition;
  }

  /** The gesture in progress, if any. */
  get current(): G | null {
    return this.gesture;
  }

  /** On pointerdown: starts a gesture with `start`, at the finger's position. */
  down(event: PointerEvent, start: (at: Point) => G): G | null {
    if (event.button !== 0) return null;
    event.preventDefault();
    this.svg().setPointerCapture(event.pointerId);
    this.gesture = start(this.positionOf(event));
    return this.gesture;
  }

  /** On pointermove: moves the gesture in progress, if any, and returns it. */
  move(event: PointerEvent): G | null {
    this.gesture?.moveTo(this.positionOf(event));
    return this.gesture;
  }

  /** On pointerup: moves the gesture to where the finger lifted, ends it and returns it. */
  up(event: PointerEvent): G | null {
    const gesture = this.move(event);
    this.gesture = null;
    return gesture;
  }

  /** On pointercancel: drops the gesture in progress. */
  cancel(): void {
    this.gesture = null;
  }

  /** How many screen pixels a square takes up now, or null when the board isn't on screen. */
  pixelsPerSquare(): number | null {
    return this.svg().getScreenCTM()?.a || null;
  }

  private positionOf(event: PointerEvent): Point {
    return this.toPosition(screenToBoard(this.svg().getScreenCTM(), event.clientX, event.clientY));
  }
}
