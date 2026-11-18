import { NEXT_PUZZLE_MS } from './clock-store';
import { AppHarness, SAMPLE_PAGE } from './testing/app-harness';

/** The ladder, in a game without difficulties. */
describe('Ladder', () => {
  const app = new AppHarness({ now: new Date(2026, 10, 2, 10, 0) });
  beforeEach(() => app.start());
  afterEach(() => app.stop());

  const ladder = () => app.screens.ladder()!;
  /** Solves the size on screen after `seconds`, as a player's move, and waits for the next. */
  async function climb(seconds: number): Promise<void> {
    ladder().touch();
    app.later(seconds);
    app.solve(ladder());
    app.later(100); // while the solved puzzle shows: not counted
    await app.wait(NEXT_PUZZLE_MS + 50);
    await app.stable();
  }
  async function playFromChallenges(): Promise<void> {
    app.screens.openChallenges();
    await app.stable();
    await app.play(2);
  }

  it('is the third challenge, straight up the ladder from the smallest size', async () => {
    app.screens.openChallenges();
    await app.stable();
    expect(app.texts('puzzle-home h2')).toEqual(['Beat the clock', 'Timed play', 'Ladder']);
    await app.play(2);

    expect(app.text('h1')).toBe('Ladder');
    expect(app.text('.mode-bar .rungs')).toBe('4×4');
    expect(app.element.querySelectorAll('.rungs li').length).toBe(7); // 4×4 to 10×10
    expect(app.element.querySelector('.rungs li')!.className).toBe('current');
    expect(app.text('.mode-bar .clock')).toBe('⏱ 0:00');
    expect(app.texts('.action-bar button')).toEqual(['Undo', 'Redo', 'Restart']); // no Solve
  });

  it('times the climb through every size, smallest first, with a best time', async () => {
    await playFromChallenges();
    app.later(20); // not touched yet
    const sizes: string[] = [];
    for (let rung = 0; rung < 7; rung++) {
      sizes.push(ladder().label());
      expect(ladder().rung()).toBe(rung);
      expect(app.element.querySelectorAll('.rungs li.done').length).toBe(rung);
      await climb(10);
    }
    expect(sizes).toEqual(['4×4', '5×5', '6×6', '7×7', '8×8', '9×9', '10×10']);

    expect(ladder().result()).toBe(70_000);
    expect(app.text('.mode-bar .clock')).toBe('Climbed in 1:10');
    expect(app.text('.mode-bar .shared')).toBe('A new best time!');
    expect(ladder().celebration()).toBe('big');
    expect(ladder().canUndo()).toBe(false); // the last board stays

    const writeText = app.clipboard();
    await app.click('.mode-bar .row button'); // Share
    await vi.waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(writeText).toHaveBeenCalledWith(
      `Sample, Ladder: 7 sizes climbed in 1:10, a new best time!\n${SAMPLE_PAGE}`,
    );

    // Again, slower: no new best, nothing to share.
    await app.click('.mode-bar button'); // Play again
    expect(ladder().rung()).toBe(0);
    expect(ladder().elapsed()).toBe(0);
    for (let rung = 0; rung < 7; rung++) await climb(20);
    expect(app.text('.mode-bar .shared')).toBe('Your best time: 1:10');
    expect(ladder().celebration()).toBe('normal');
    expect(app.element.querySelector('.mode-bar .row button')).toBeNull();

    await app.goHome();
    app.screens.openChallenges();
    await app.stable();
    expect(app.text('puzzle-home .card:nth-of-type(3) .status')).toBe('Your best time: 1:10');
  }, 30_000); // real pauses between sizes

  it('can be continued later, or started again', async () => {
    await playFromChallenges();
    await climb(15);
    await climb(15);
    ladder().touch();
    app.later(5);
    await app.goHome(); // the clock stops
    app.later(600);

    // Closing the app, and opening it again.
    history.replaceState(null, '');
    await app.open();
    await playFromChallenges();
    expect(app.text('.chooser .level .size')).toBe('Size 3 of 7');
    expect(app.text('.chooser .level .state')).toBe('0:35 so far');
    expect(app.texts('.chooser button.primary')).toEqual(['Start again']);
    await app.click('.chooser .level'); // Continue
    expect(ladder().rung()).toBe(2);
    expect(ladder().label()).toBe('6×6');
    expect(ladder().elapsed()).toBe(35_000);

    // Starting again forgets the unfinished ladder.
    await app.goHome();
    await app.play(2);
    await app.click('.chooser button.primary'); // Start again
    expect(ladder().rung()).toBe(0);
    expect(ladder().elapsed()).toBe(0);
  }, 15_000);
});

/** The ladder in a game with difficulties (Easy and Hard): it asks for one first. */
describe('Ladder, with difficulties', () => {
  const app = new AppHarness({ withDifficulties: true });
  beforeEach(() => app.start());
  afterEach(() => app.stop());

  async function openSheet(): Promise<void> {
    app.screens.openChallenges();
    await app.stable();
    await app.play(2);
  }

  it('asks for Easy or Hard, then climbs every size at it', async () => {
    localStorage.setItem('sample.ladder.best', JSON.stringify({ 1: 754_000 }));
    await openSheet();
    expect(app.text('.chooser p')).toBe('Choose a difficulty');
    expect(app.texts('.chooser .level .name')).toEqual(['Easy', 'Hard']);
    expect(app.texts('.chooser .level .state')).toEqual([
      'No best time yet',
      'Your best time: 12:34',
    ]);

    await app.click('.chooser .level', 1); // Hard
    const ladder = app.screens.ladder()!;
    expect(app.text('h1')).toBe('Ladder');
    expect(ladder.difficultyName).toBe('Hard');
    expect(ladder.label()).toBe('4×4 Hard');
    expect(app.element.querySelectorAll('.rungs li').length).toBe(7); // 4×4 to 10×10
  });

  it('offers to continue the unfinished ladder, or start again at either difficulty', async () => {
    app.screens.openLadder(0, true);
    await app.stable();
    await app.goHome();
    await openSheet();
    expect(app.text('.chooser .level .size')).toBe('Easy · Size 1 of 7');
    expect(app.text('.chooser p')).toBe('Or start again');
    expect(app.texts('.chooser .level .name')).toEqual(['Continue', 'Easy', 'Hard']);
  });
});
