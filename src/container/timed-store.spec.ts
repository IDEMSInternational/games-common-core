import { AppHarness, SAMPLE_PAGE } from './testing/app-harness';

/** Timed play, from the Challenges page. */
describe('Timed play', () => {
  const app = new AppHarness({ now: new Date(2026, 10, 2, 10, 0) });
  beforeEach(() => app.start());
  afterEach(() => app.stop());

  const timed = () => app.screens.timed;
  /** Solves the puzzle on screen after `seconds`, as a player's move. */
  async function solveIn(seconds: number): Promise<void> {
    timed().touch();
    app.later(seconds);
    app.solve(timed());
    await app.stable();
  }

  it('is in Challenges, with the size menu and no Solve', async () => {
    await app.play(2); // Challenges
    await app.play(1);
    expect(app.text('h1')).toBe('Timed play');
    expect(app.element.querySelector('puzzle-shell select')).toBeTruthy();
    expect(app.text('.mode-bar span')).toBe('No best time yet');
    expect(app.text('.mode-bar .clock')).toBe('⏱ 0:00');
    expect(app.texts('.action-bar button')).toEqual(['Undo', 'Redo', 'Restart']);
  });

  it('times each puzzle from the first touch, and keeps the best time for each size', async () => {
    app.screens.openTimed();
    await app.stable();
    app.later(20); // not touched yet
    timed().touch();
    app.later(10);
    await app.wait(300);
    expect(timed().elapsed()).toBe(10_000);

    app.later(55);
    app.solve(timed());
    await app.stable();
    expect(app.text('.mode-bar .clock')).toBe('Solved in 1:05');
    expect(app.text('.mode-bar .shared')).toBe('A new best time for 7×7!');
    expect(timed().canUndo()).toBe(false); // the solved board stays

    const writeText = app.clipboard();
    await app.click('.mode-bar button'); // Share
    await vi.waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(writeText).toHaveBeenCalledWith(
      `Sample, timed play: 7×7 solved in 1:05, a new best time!\n${SAMPLE_PAGE}`,
    );

    timed().newGame(); // the clock starts again
    await app.stable();
    expect(timed().elapsed()).toBe(0);
    expect(app.text('.mode-bar span')).toBe('Best: 1:05');
    await solveIn(80);
    expect(app.text('.mode-bar .shared')).toBe('Your best time: 1:05');
    expect(app.element.querySelector('.mode-bar button')).toBeNull(); // nothing to share

    timed().newGame();
    await solveIn(50);
    expect(app.text('.mode-bar .shared')).toBe('A new best time for 7×7!');

    timed().newGame(2); // 6×6: its own best time
    await app.stable();
    expect(app.text('.mode-bar span')).toBe('No best time yet');
  });

  it('continues the puzzle in progress after a reload', async () => {
    app.screens.openTimed();
    await app.stable();
    timed().newGame(1); // 5×5
    timed().touch();
    app.later(30);
    expect(timed().label()).toBe('5×5');

    await app.goHome(); // the clock stops
    app.later(600);
    history.replaceState(null, '');
    await app.open();
    app.screens.openTimed();
    await app.stable();
    expect(timed().label()).toBe('5×5');
    expect(timed().elapsed()).toBe(30_000);
  });

  it('shows one best time at a time in Challenges, the next each time', async () => {
    app.screens.openChallenges();
    app.screens.openTimed();
    await app.stable();
    await solveIn(65); // 7×7
    timed().newGame(1);
    await solveIn(12); // 5×5

    const shown: string[] = [];
    for (let i = 0; i < 3; i++) {
      await app.goHome(); // back to Challenges
      shown.push(app.text('puzzle-home .card:nth-of-type(2) .status')!);
      app.screens.openTimed();
      await app.stable();
    }
    expect(shown[0]).not.toBe(shown[1]);
    expect(shown[0]).toBe(shown[2]);
    expect(new Set(shown)).toEqual(
      new Set(['Your best time for 5×5: 0:12', 'Your best time for 7×7: 1:05']),
    );
  });
});
