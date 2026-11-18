import { screenToBoard, squareAt } from './geometry';

describe('squareAt', () => {
  it('finds the square under a position', () => {
    expect(squareAt({ w: 5, h: 4 }, 2.4, 0.9)).toEqual({ x: 2, y: 0 });
    expect(squareAt({ w: 5, h: 4 }, 3, 2)).toEqual({ x: 3, y: 2 });
  });

  it('keeps positions off the board on its edge squares', () => {
    expect(squareAt({ w: 5, h: 5 }, -0.3, 7)).toEqual({ x: 0, y: 4 });
    expect(squareAt({ w: 5, h: 4 }, 5, -2)).toEqual({ x: 4, y: 0 });
  });
});

describe('screenToBoard', () => {
  it('undoes the scale and offset the board is drawn with', () => {
    // 40 pixels a square, the board's corner at (100, 60) on the screen
    const matrix = { a: 40, b: 0, c: 0, d: 40, e: 100, f: 60 };
    expect(screenToBoard(matrix, 100, 60)).toEqual({ x: 0, y: 0 });
    expect(screenToBoard(matrix, 196, 96)).toEqual({ x: 2.4, y: 0.9 });
    expect(screenToBoard(matrix, 80, 60)).toEqual({ x: -0.5, y: 0 });
  });

  it('undoes any 2D transform, like the browser does', () => {
    // a quarter turn and a scale of 2, then an offset
    const matrix = { a: 0, b: 2, c: -2, d: 0, e: 10, f: 20 };
    const board = { x: 3, y: 1.5 };
    const screen = {
      x: matrix.a * board.x + matrix.c * board.y + matrix.e,
      y: matrix.b * board.x + matrix.d * board.y + matrix.f,
    };
    expect(screenToBoard(matrix, screen.x, screen.y)).toEqual(board);
  });

  it('returns the screen point when the board has no matrix', () => {
    expect(screenToBoard(null, 12, 34)).toEqual({ x: 12, y: 34 });
  });
});
