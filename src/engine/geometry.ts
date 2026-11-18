/**
 * Positions and sizes on a game's board, shared by every game. Board
 * positions are in squares: (0, 0) is the board's top-left corner, and
 * (2.4, 0.9) is inside the third square of the first row.
 */

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  w: number;
  h: number;
}

/** The square under a position given in squares (e.g. 2.4, 0.9), kept on the board. */
export function squareAt(size: Size, x: number, y: number): Point {
  return {
    x: Math.min(Math.max(Math.floor(x), 0), size.w - 1),
    y: Math.min(Math.max(Math.floor(y), 0), size.h - 1),
  };
}

/**
 * The 2D matrix that takes board positions to the screen, as an SVG's
 * getScreenCTM() gives it: screen x = a·x + c·y + e, screen y = b·x + d·y + f.
 */
export interface ScreenMatrix {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

/**
 * The board position under a point on the screen (e.g. a finger's clientX
 * and clientY), through the matrix that draws the board. Without a matrix
 * (the board isn't on screen), the screen point is returned as it is.
 */
export function screenToBoard(
  matrix: ScreenMatrix | null | undefined,
  x: number,
  y: number,
): Point {
  if (!matrix) return { x, y };
  const { a, b, c, d, e, f } = matrix;
  const det = a * d - b * c;
  const dx = x - e;
  const dy = y - f;
  return { x: (d * dx - c * dy) / det, y: (a * dy - b * dx) / det };
}
