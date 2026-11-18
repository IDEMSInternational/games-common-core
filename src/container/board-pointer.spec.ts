import { Point, squareAt } from '../engine/geometry';
import { BoardPointer } from './board-pointer';

/** A gesture that records where the finger went. */
class Trail {
  readonly points: Point[];
  constructor(start: Point) {
    this.points = [start];
  }
  moveTo(at: Point): void {
    this.points.push(at);
  }
}

describe('BoardPointer', () => {
  // A board drawn at 40 pixels a square, its corner at (100, 60) on the screen.
  let matrix: DOMMatrix | null;
  const setPointerCapture = vi.fn();
  const svg = {
    getScreenCTM: () => matrix,
    setPointerCapture,
  } as unknown as SVGSVGElement;
  const pointer = (clientX: number, clientY: number, button = 0) =>
    ({
      clientX,
      clientY,
      button,
      pointerId: 7,
      preventDefault: vi.fn(),
    }) as unknown as PointerEvent;

  beforeEach(() => {
    matrix = { a: 40, b: 0, c: 0, d: 40, e: 100, f: 60 } as DOMMatrix;
    setPointerCapture.mockClear();
  });

  it('follows the finger in squares, from down to up', () => {
    const board = new BoardPointer<Trail>(() => svg);
    const down = pointer(120, 80);
    board.down(down, (at) => new Trail(at));
    expect(down.preventDefault).toHaveBeenCalled();
    expect(setPointerCapture).toHaveBeenCalledWith(7);
    expect(board.current?.points).toEqual([{ x: 0.5, y: 0.5 }]);

    board.move(pointer(196, 96));
    const trail = board.up(pointer(220, 100));
    expect(trail?.points).toEqual([
      { x: 0.5, y: 0.5 },
      { x: 2.4, y: 0.9 },
      { x: 3, y: 1 },
    ]);
    expect(board.current).toBeNull();
    expect(board.move(pointer(240, 100))).toBeNull(); // nothing after the finger lifts
  });

  it('can give the gesture squares instead of positions', () => {
    const size = { w: 4, h: 4 };
    const board = new BoardPointer<Trail>(
      () => svg,
      (at) => squareAt(size, at.x, at.y),
    );
    board.down(pointer(120, 80), (at) => new Trail(at));
    const trail = board.up(pointer(500, 30)); // off the board, past its top-right corner
    expect(trail?.points).toEqual([
      { x: 0, y: 0 },
      { x: 3, y: 0 },
    ]);
  });

  it('ignores buttons other than the main one, and drops a cancelled gesture', () => {
    const board = new BoardPointer<Trail>(() => svg);
    const start = vi.fn((at: Point) => new Trail(at));
    expect(board.down(pointer(120, 80, 2), start)).toBeNull();
    expect(start).not.toHaveBeenCalled();
    expect(setPointerCapture).not.toHaveBeenCalled();

    board.down(pointer(120, 80), start);
    board.cancel();
    expect(board.current).toBeNull();
    expect(board.up(pointer(130, 80))).toBeNull();
  });

  it('measures the pixels a square takes up', () => {
    const board = new BoardPointer<Trail>(() => svg);
    expect(board.pixelsPerSquare()).toBe(40);
    matrix = null; // not on screen
    expect(board.pixelsPerSquare()).toBeNull();
  });
});
