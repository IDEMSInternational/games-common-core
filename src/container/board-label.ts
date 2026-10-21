/** Text height and pill padding of board labels, in board units (cells). */
export const LABEL_FONT = 0.42;
const LABEL_PADDING = 0.18;

export interface BoardLabel {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Places a pill-shaped label next to an area of a board (all in cells):
 * just above it (where a finger is least likely to hide it), or below it
 * at the top of the board, or inside it if neither fits; always within
 * the board. Shared by every game's board.
 */
export function placeLabel(
  text: string,
  area: { x: number; y: number; w: number; h: number },
  board: { w: number; h: number },
): BoardLabel {
  const width = Math.min(text.length * LABEL_FONT * 0.55 + 2 * LABEL_PADDING, board.w);
  const height = LABEL_FONT + LABEL_PADDING;

  let y = area.y - height - 0.1;
  if (y < 0) y = area.y + area.h + 0.1;
  if (y + height > board.h) y = area.y + (area.h - height) / 2;
  const x = Math.min(Math.max(area.x + area.w / 2 - width / 2, 0), board.w - width);
  return { text, x, y, width, height };
}
