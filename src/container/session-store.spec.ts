import { TestBed } from '@angular/core/testing';
import { SessionStore } from './session-store';
import { AppHarness } from './testing/app-harness';

/** Free play's puzzle, kept on the device between visits. */
describe('Free play session', () => {
  const app = new AppHarness();
  beforeEach(() => app.start(false));
  afterEach(() => app.stop());

  /** A puzzle session as free play keeps it (opening the app again: another one). */
  const newSession = () => TestBed.runInInjectionContext(() => new SessionStore(app.game));
  const fill = (at: number) => ({ kind: 'set' as const, at, on: true });

  it('starts in the size played last time, and remembers new choices', () => {
    localStorage.setItem('sample.size', '5x8');
    const session = newSession();
    expect(session.gameId()).toMatch(/^5x8#/);

    session.newGame(5); // the 9×9 preset
    expect(localStorage.getItem('sample.size')).toBe('9x9');
  });

  it('continues the game in progress after a reload, undo history included', () => {
    const first = newSession();
    first.move(fill(0));
    first.move(fill(5));
    first.undo();

    // "Reopen the app": a new session reads what the first one saved.
    const second = newSession();
    expect(second.gameId()).toBe(first.gameId());
    expect(second.state().cells).toBe('1' + '0'.repeat(48));
    expect(second.canRedo()).toBe(true);
    second.redo();
    expect(second.state().cells[5]).toBe('1');
  });

  it('forgets a finished puzzle, keeping only its size, so a reload starts a new one', () => {
    const first = newSession();
    first.newGame(1); // 5×5
    first.solve();
    expect(first.completed()).toBe(true);
    expect(localStorage.getItem('sample.game')).toBeNull();

    const second = newSession();
    expect(second.gameId()).toMatch(/^5x5#/);
    expect(second.gameId()).not.toBe(first.gameId());
    expect(second.completed()).toBe(false);
    expect(second.canUndo()).toBe(false);
  });

  it('starts a new puzzle if the saved game is unreadable', () => {
    localStorage.setItem(
      'sample.game',
      '{"params":"7x7","moves":[{"kind":"nonsense"}],"position":1}',
    );
    const session = newSession();
    expect(session.gameId()).toMatch(/^7x7#\d+$/);
    expect(session.canUndo()).toBe(false);
  });

  it('ignores a remembered size that is no longer valid', () => {
    localStorage.setItem('sample.size', '0x0');
    expect(newSession().gameId()).toMatch(/^7x7#/);
  });

  it('celebrates a puzzle the player solves, but not one solved with Solve', () => {
    const session = newSession();

    // With the Solve button: solved, but no celebration.
    session.solve();
    expect(session.completed()).toBe(true);
    expect(session.celebrate()).toBe(false);

    // Undo, then complete the same answer as a player's move: celebration.
    const answer = session.state().cells;
    session.undo();
    session.move({ kind: 'solve', cells: answer });
    expect(session.celebrate()).toBe(true);

    // Any later action ends it.
    session.undo();
    expect(session.celebrate()).toBe(false);
  });
});
