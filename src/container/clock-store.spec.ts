import { NEXT_PUZZLE_MS } from './clock-store';
import { AppHarness, SAMPLE_PAGE } from './testing/app-harness';

/** Beat the clock, from the Challenges page. */
describe('Beat the clock', () => {
  const app = new AppHarness({ now: new Date(2026, 10, 2, 10, 0) });
  beforeEach(() => app.start());
  afterEach(() => app.stop());

  const clock = () => app.screens.clock()!;
  const solve = () => app.solve(clock());
  /** Opens Beat the clock's sheet, from the Challenges page. */
  async function openSheet(): Promise<void> {
    app.screens.openChallenges();
    await app.stable();
    await app.play(0);
  }

  it('is chosen in Challenges, with a difficulty and a time limit', async () => {
    await app.play(2); // Challenges
    await app.play(0);
    expect(app.texts('.chooser .times button')).toEqual(['1 min', '2 min', '5 min', '10 min']);
    expect(app.texts('.chooser .difficulty button')).toEqual(['Easy', 'Medium', 'Hard']);
    expect(app.text('.chooser .chosen')).toBe('Medium'); // to start with
    expect(app.text('.chooser .custom-toggle')).toBe('Custom size ›');

    // Hard, for 3 minutes (Other).
    await app.click('.chooser .difficulty button', 2);
    expect(app.text('.chooser .chosen')).toBe('Hard');
    (app.element.querySelector('.chooser .custom input') as HTMLInputElement).value = '3';
    app.element.querySelector('.chooser form.custom')!.dispatchEvent(new Event('submit'));
    await app.stable();
    expect(app.text('h1')).toBe('Beat the clock');
    expect(app.text('.mode-bar .clock')).toBe('⏱ 3:00');
    expect(app.text('.mode-bar span')).toMatch(/^(9×9|10×10) · Solved: 0$/); // the Hard daily puzzles' sizes
    expect(app.texts('.action-bar button')).toEqual(['Undo', 'Redo', 'Restart']); // no Solve, no skipping

    // The sheet remembers the difficulty.
    await app.goHome();
    await app.play(0);
    expect(app.text('.chooser .chosen')).toBe('Hard');
  });

  it('plays a custom size, every puzzle that size', async () => {
    await openSheet();
    await app.click('.chooser .custom-toggle');
    expect(app.text('.chooser .chosen')).toBe('Custom size ›');
    const [width, height] = Array.from(
      app.element.querySelectorAll<HTMLInputElement>('.chooser .custom-size input'),
    );
    expect([width.value, height.value]).toEqual(['6', '6']); // from Medium's sizes

    width.value = '0';
    await app.click('.chooser .times button', 1);
    expect(app.text('.chooser .error')).toBe('Width must be a whole number from 4 to 25');
    expect(app.screens.screen().name).toBe('challenges');

    width.value = '7';
    height.value = '9';
    await app.click('.chooser .times button', 1); // 2 min
    expect(clock().choiceLabel).toBe('7×9');
    expect(app.text('.mode-bar .clock')).toBe('⏱ 2:00');
    for (let i = 0; i < 3; i++) {
      expect(clock().label()).toBe('7×9');
      clock().playAgain();
    }

    // Opening the sheet again: the custom size, as last played.
    await app.goHome();
    await app.play(0);
    expect(app.text('.chooser .chosen')).toBe('Custom size ›');
    const inputs = Array.from(
      app.element.querySelectorAll<HTMLInputElement>('.chooser .custom-size input'),
    );
    expect(inputs.map((input) => input.value)).toEqual(['7', '9']);
  });

  it('counts down from the first touch, and stops between puzzles', async () => {
    app.screens.openClock(5, 'medium', true);
    await app.stable();
    app.later(30); // not touched yet
    expect(clock().remaining()).toBe(300_000);

    clock().touch();
    app.later(60);
    await app.wait(300);
    expect(clock().remaining()).toBe(240_000);

    solve();
    expect(clock().solved()).toBe(1);
    expect(clock().celebrate()).toBe(true);
    app.later(100); // while the solved puzzle shows: not counted
    await app.wait(NEXT_PUZZLE_MS + 100);
    expect(clock().completed()).toBe(false); // the next puzzle
    app.later(10);
    await app.wait(300);
    expect(clock().remaining()).toBe(230_000);
  });

  it('deals the puzzles in fair sets: each size once per set, in random order', async () => {
    app.screens.openClock(5, 'medium', true);
    await app.stable();
    clock().touch();
    const sizes = [clock().label()];
    for (let i = 0; i < 5; i++) {
      solve();
      await app.wait(NEXT_PUZZLE_MS + 50);
      sizes.push(clock().label());
    }
    expect(sizes.slice(0, 3).sort()).toEqual(['6×6', '7×7', '8×8']);
    expect(sizes.slice(3, 6).sort()).toEqual(['6×6', '7×7', '8×8']);

    // Continued later, the set carries on where it was.
    await app.goHome();
    const left = JSON.parse(localStorage.getItem('sample.clock.run')!).bag as number[];
    expect(left.length).toBe(0); // the second set is used up
  }, 15_000); // five real pauses between puzzles

  it("picks puzzles at random from the difficulty's daily puzzle sizes", async () => {
    const sizes = async (choice: string) => {
      app.screens.openClock(5, choice, true);
      await app.stable();
      const seen = new Set<string>();
      for (let i = 0; i < 30; i++) {
        seen.add(clock().label());
        clock().playAgain();
      }
      await app.goHome();
      return [...seen].sort();
    };
    expect(await sizes('low')).toEqual(['5×5', '6×6', '7×7']);
    expect(await sizes('medium')).toEqual(['6×6', '7×7', '8×8']);
    expect(await sizes('high')).toEqual(['10×10', '9×9']);
  });

  it('keeps the record for each difficulty and time limit when the time is up', async () => {
    app.screens.openClock(5, 'medium', true);
    await app.stable();
    clock().touch();
    solve();
    await app.wait(NEXT_PUZZLE_MS + 100);
    app.later(301);
    await app.wait(400);
    await app.stable();

    expect(clock().finished()).toBe(true);
    expect(app.text('.mode-bar .clock')).toBe("Time's up! Solved: 1");
    expect(app.text('.mode-bar .shared')).toBe('A new record for Medium, 5 minutes!');
    expect(clock().canUndo()).toBe(false);

    const writeText = app.clipboard();
    await app.click('.mode-bar .row button'); // Share
    await vi.waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(writeText).toHaveBeenCalledWith(
      `Sample, Beat the clock (Medium): 1 puzzle solved in 5 minutes, a new record!\n${SAMPLE_PAGE}`,
    );

    await app.click('.mode-bar button'); // Play again
    expect(clock().solved()).toBe(0);
    expect(clock().remaining()).toBe(300_000);
    expect(clock().record).toBe(1);

    await app.goHome();
    app.screens.openChallenges();
    await app.stable();
    expect(app.text('puzzle-home .card:nth-of-type(1) .status')).toBe(
      'Your record for Medium, 5 min: 1 puzzle',
    );
    await app.goHome();

    // Hard has its own records.
    app.screens.openClock(5, 'high', true);
    await app.stable();
    expect(clock().record).toBe(0);
    await app.goHome();

    // Not a new record: nothing to share.
    app.screens.openClock(5, 'medium', true);
    await app.stable();
    clock().touch();
    app.later(301);
    await app.wait(400);
    await app.stable();
    expect(app.text('.mode-bar .shared')).toBe('Your record for Medium, 5 minutes: 1');
    expect(app.element.querySelectorAll('.mode-bar button').length).toBe(1); // Play again
  });

  it('shows one record at a time, the next each time Challenges opens', async () => {
    // A record from before difficulties (by minutes alone) counts as Medium.
    localStorage.setItem(
      'sample.clock.records',
      JSON.stringify({ 5: 3, 'low/10': 7, 'custom:7x9/2': 12 }),
    );
    const shown: string[] = [];
    for (let i = 0; i < 4; i++) {
      app.screens.openChallenges();
      await app.stable();
      shown.push(app.text('puzzle-home .card:nth-of-type(1) .status')!);
      await app.goHome();
    }
    expect(shown).toEqual([
      'Your record for Medium, 5 min: 3 puzzles',
      'Your record for 7×9, 2 min: 12 puzzles',
      'Your record for Easy, 10 min: 7 puzzles',
      'Your record for Medium, 5 min: 3 puzzles',
    ]);
    app.screens.openChallenges();
    await app.stable();
    expect(app.element.querySelectorAll('puzzle-home .card:nth-of-type(1) .status').length).toBe(1);
  });

  it('can be continued later, or started again', async () => {
    app.screens.openClock(10, 'medium', true);
    await app.stable();
    clock().touch();
    app.later(30);
    solve();
    await app.goHome(); // the clock stops
    app.later(600);

    // Closing the app, and opening it again.
    history.replaceState(null, '');
    await app.open();
    await openSheet();
    expect(app.text('.chooser .level .size')).toBe('Medium · 10 min');
    expect(app.text('.chooser .level .state')).toBe('Solved: 1, 9:30 left');
    await app.click('.chooser .level'); // Continue
    expect(clock().minutes).toBe(10);
    expect(clock().solved()).toBe(1);
    expect(clock().remaining()).toBe(570_000);
    expect(clock().completed()).toBe(false); // a new puzzle after the solved one

    // Starting again forgets the unfinished run.
    await app.goHome();
    app.screens.openClock(10, 'medium', true);
    await app.stable();
    expect(clock().solved()).toBe(0);
    expect(clock().remaining()).toBe(600_000);
  });
});
