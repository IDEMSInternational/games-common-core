import { GameSession } from './game-session';
import { PuzzleGame } from './puzzle-game';

/**
 * A tiny game for testing sessions: the puzzle is a target number, the
 * state is a running total, and each move adds 1 or 2. It's solved when
 * the total reaches the target.
 */
interface CountState {
  target: number;
  total: number;
}
type CountMove = { add: number };

const countGame: PuzzleGame<{ target: number }, CountState, CountMove> = {
  id: 'count',
  name: 'Count',
  defaultParams: () => ({ target: 5 }),
  presets: () => [],
  encodeParams: (p) => String(p.target),
  decodeParams: (text) => ({ target: Number(text) }),
  validateParams: (p) => (p.target > 0 ? null : 'Target must be positive'),
  customFields: () => [],
  customParams: () => ({ target: 5 }),
  generate: (p) => ({ description: String(p.target), solution: String(p.target) }),
  validateDescription: (_, d) => (/^\d+$/.test(d) ? null : 'Bad description'),
  newGame: (p) => ({ target: p.target, total: 0 }),
  applyMove: (s, m) => (m.add === 1 || m.add === 2 ? { ...s, total: s.total + m.add } : null),
  isCompleted: (s) => s.total >= s.target,
  solve: (s) => ({ add: 2 }),
};

describe('GameSession snapshots', () => {
  it('restores the puzzle, moves, restarts and undo position exactly', () => {
    const session = new GameSession(countGame);
    session.move({ add: 2 });
    session.move({ add: 1 });
    session.restart();
    session.move({ add: 2 });
    session.undo(); // back to the restart, with a redo available

    const copy = new GameSession(countGame, { target: 9 });
    expect(copy.restore(JSON.parse(JSON.stringify(session.snapshot())))).toBe(true);

    expect(copy.gameId).toBe(session.gameId);
    expect(copy.state).toEqual({ target: 5, total: 0 });
    expect(copy.canRedo).toBe(true);
    copy.redo();
    expect(copy.state.total).toBe(2);
    copy.undo();
    copy.undo();
    expect(copy.state.total).toBe(3); // before the restart
  });

  it('refuses a snapshot it cannot replay, leaving the session as it was', () => {
    const session = new GameSession(countGame, { target: 9 });
    session.move({ add: 1 });
    const before = session.snapshot();

    const bad = { ...before, moves: [{ add: 7 }], position: 1 }; // an illegal move
    expect(session.restore(bad)).toBe(false);
    expect(session.restore({ ...before, params: '0' })).toBe(false); // invalid params
    expect(session.restore({ ...before, position: 5 })).toBe(false); // past the end
    expect(session.snapshot()).toEqual(before);
  });
});
