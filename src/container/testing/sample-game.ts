import { DailySchedule } from '../../engine/daily';
import { PuzzleGame } from '../../engine/puzzle-game';
import { Tutorial } from '../../engine/tutorial';

/**
 * A stand-in game for testing the shared screens without a real game: fill
 * in the hidden pattern, one square at a time. Its sizes and daily puzzles
 * are like Rectangles' (4×4 to 10×10, custom 4 to 25), so the shared tests
 * read like a real game's. Only tests use it.
 */
export interface SampleParams {
  w: number;
  h: number;
  /** Used only by the game with difficulties (sampleGame(true)). */
  difficulty: number;
}

export interface SampleState {
  readonly w: number;
  readonly h: number;
  /** The pattern to find, one '0' or '1' per square, row by row. */
  readonly target: string;
  readonly cells: string;
  readonly completed: boolean;
}

export type SampleMove =
  | { kind: 'set'; at: number; on: boolean }
  /** The whole answer at once (the Solve button, or a test playing it). */
  | { kind: 'solve'; cells: string };

const MIN_SIDE = 4;
const MAX_SIDE = 25;

/**
 * The sample game: without difficulties, like Rectangles, or with Easy and
 * Hard, like Slanted. Both are called "Sample", with the id "sample".
 */
export function sampleGame(
  withDifficulties = false,
): PuzzleGame<SampleParams, SampleState, SampleMove> {
  const square = (n: number, difficulty = 0): SampleParams => ({ w: n, h: n, difficulty });
  const daily: DailySchedule<SampleParams> = {
    firstDay: '2026-10-24',
    levels: [
      [5, 5, 6, 6, 6, 7, 7],
      [6, 6, 7, 7, 7, 8, 8],
      [9, 9, 9, 9, 10, 10, 10],
    ].map((week) => week.map((n) => square(n))),
  };
  const withState = (state: SampleState, cells: string): SampleState => ({
    ...state,
    cells,
    completed: state.completed || cells === state.target,
  });

  return {
    id: 'sample',
    name: 'Sample',

    defaultParams: () => square(7),
    presets: () => [4, 5, 6, 7, 8, 9, 10].map((n) => ({ name: `${n}×${n}`, params: square(n) })),
    encodeParams: (p) => `${p.w}x${p.h}` + (withDifficulties ? `d${p.difficulty}` : ''),
    decodeParams(text) {
      const [, w, h, d] = /^(\d*)(?:x(\d*))?(?:d(\d+))?/.exec(text)!;
      const width = parseInt(w, 10) || 0;
      return {
        w: width,
        h: h === undefined ? width : parseInt(h, 10) || 0,
        difficulty: parseInt(d ?? '0', 10),
      };
    },
    validateParams(p) {
      if (p.w <= 0 || p.h <= 0) return 'Width and height must both be greater than zero';
      if (p.w * p.h < 2 || p.w * p.h > 10000) return 'Unreasonable size';
      if (p.difficulty < 0 || p.difficulty > (withDifficulties ? 1 : 0))
        return 'Unknown difficulty';
      return null;
    },
    customFields: (p) => [
      { key: 'w', label: 'Width', min: MIN_SIDE, max: MAX_SIDE, value: p.w },
      { key: 'h', label: 'Height', min: MIN_SIDE, max: MAX_SIDE, value: p.h },
    ],
    customParams: (values) => ({ w: values['w'], h: values['h'], difficulty: 0 }),

    ...(withDifficulties
      ? {
          difficulties: ['Easy', 'Hard'],
          difficultyOf: (p: SampleParams) => p.difficulty,
          withDifficulty: (p: SampleParams, difficulty: number) => ({ ...p, difficulty }),
        }
      : {}),

    generate(params, random) {
      const bits = Array.from({ length: params.w * params.h }, () => (random.upto(2) ? '1' : '0'));
      if (!bits.includes('1')) bits[0] = '1'; // never solved before it starts
      const description = bits.join('');
      return { description, solution: description };
    },
    validateDescription: (p, d) =>
      d.length === p.w * p.h && /^[01]+$/.test(d) ? null : 'Not a pattern for this size',
    newGame: (p, description) => ({
      w: p.w,
      h: p.h,
      target: description,
      cells: '0'.repeat(description.length),
      completed: false,
    }),

    applyMove(state, move) {
      if (move.kind === 'solve') {
        return move.cells.length === state.cells.length ? withState(state, move.cells) : null;
      }
      if (move.kind !== 'set' || !(move.at >= 0 && move.at < state.cells.length)) return null;
      const value = move.on ? '1' : '0';
      if (state.cells[move.at] === value) return null;
      return withState(
        state,
        state.cells.slice(0, move.at) + value + state.cells.slice(move.at + 1),
      );
    },
    isCompleted: (state) => state.completed,
    solve: (initial) => ({ kind: 'solve', cells: initial.target }),
    canShowMistakes: true,
    daily,
  };
}

/** A one-step tutorial: fill in any square of a 4×4 pattern. */
export const sampleTutorial: Tutorial<SampleParams, SampleState, SampleMove, number> = {
  params: { w: 4, h: 4, difficulty: 0 },
  description: '1000010000100001',
  steps: [{ text: 'Fill in a square.', hint: 0, done: (state) => state.cells.includes('1') }],
};
