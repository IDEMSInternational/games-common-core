import { AppHarness, SAMPLE_PAGE } from '../testing/app-harness';

/** The records page. */
describe('Records page', () => {
  const app = new AppHarness({ now: new Date(2026, 9, 30, 10, 0) }); // Friday 30 October
  beforeEach(async () => {
    await app.start(false);
    const solved = { time: 60_000, onDay: true };
    localStorage.setItem(
      'sample.daily.results',
      JSON.stringify({
        // Easy: 3 days in a row, a gap, then today; Hard: today.
        '2026-10-24.low': solved,
        '2026-10-25.low': solved,
        '2026-10-26.low': solved,
        '2026-10-30.low': solved,
        '2026-10-30.high': solved,
        '2026-10-29.medium': { time: 60_000, onDay: false }, // late: no streak
      }),
    );
    localStorage.setItem('sample.clock.records', JSON.stringify({ 'medium/5': 7, 'low/1': 1 }));
    localStorage.setItem(
      'sample.timed.best',
      JSON.stringify({ '7x7': { label: '7×7', time: 65_000 } }),
    );
    await app.open();
  });
  afterEach(() => app.stop());

  /** Each record as "label | value | detail". */
  const rows = () =>
    Array.from(app.element.querySelectorAll('puzzle-records li'), (li) =>
      Array.from(li.querySelectorAll('.record span'), (s) => s.textContent!.trim()).join(' | '),
    );
  const row = (n: number) => app.element.querySelectorAll('puzzle-records li')[n];

  it('opens with 🏆, on the home and Challenges pages, and lists the records by mode', async () => {
    expect(app.element.querySelector('button.trophy')).toBeTruthy();
    app.screens.openChallenges();
    await app.stable();
    await app.click('button.trophy');

    expect(app.text('h1')).toBe('Your records');
    expect(app.element.querySelector('button.trophy')).toBeNull();
    expect(app.texts('puzzle-records h2')).toEqual([
      'Daily puzzles',
      'Beat the clock',
      'Timed play',
      'Ladder',
    ]);
    expect(rows()).toEqual([
      'Easy: best streak | 3 days | Now: 1 day',
      'Hard: best streak | 1 day | Now: 1 day',
      'Easy, 1 min | 1 puzzle',
      'Medium, 5 min | 7 puzzles',
      '7×7 | 1:05',
    ]);
    expect(app.text('puzzle-records section:last-child .none')).toBe('No records yet');

    // Back to where it was opened from.
    const popped = new Promise((resolve) =>
      window.addEventListener('popstate', resolve, { once: true }),
    );
    await app.click('button.back');
    await popped;
    await app.stable();
    expect(app.text('h1')).toBe('Challenges');
  });

  it('asks before deleting a record: no keeps it, yes deletes it', async () => {
    app.screens.openRecords();
    await app.stable();
    async function remove(n: number): Promise<void> {
      (row(n).querySelector('[aria-label^="Delete"]') as HTMLButtonElement).click();
      await app.stable();
    }

    await remove(3); // Medium, 5 min
    expect(app.text('puzzle-records .confirm h2')).toBe('Do you want to delete this record?');
    expect(app.text('#delete-what')).toBe('Medium, 5 min: 7 puzzles');
    await app.click('puzzle-records .confirm .buttons button:last-child'); // No
    expect(app.element.querySelector('puzzle-records .confirm')).toBeNull();
    expect(rows()).toContain('Medium, 5 min | 7 puzzles');

    await remove(3);
    await app.click('puzzle-records .confirm .delete'); // Yes
    expect(rows()).not.toContain('Medium, 5 min | 7 puzzles');
    expect(JSON.parse(localStorage.getItem('sample.clock.records')!)).toEqual({ 'low/1': 1 });

    // A daily level: its results go, so its streaks start again.
    await remove(0);
    expect(app.text('#delete-what')).toContain('its streaks start again');
    await app.click('puzzle-records .confirm .delete');
    expect(rows()[0]).toBe('Hard: best streak | 1 day | Now: 1 day');
    expect(Object.keys(JSON.parse(localStorage.getItem('sample.daily.results')!))).toEqual([
      '2026-10-30.high',
      '2026-10-29.medium',
    ]);

    await remove(2); // 7×7
    await app.click('puzzle-records .confirm .delete');
    expect(app.screens.timedBest()).toBeNull();
    expect(app.text('puzzle-records section:nth-child(3) .none')).toBe('No records yet');
  });

  it('shares any record', async () => {
    app.screens.openRecords();
    await app.stable();
    const writeText = app.clipboard();
    const share = (n: number) =>
      (row(n).querySelector('[aria-label^="Share"]') as HTMLButtonElement).click();

    share(0);
    await vi.waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(writeText).toHaveBeenLastCalledWith(
      `Sample daily puzzles: my best streak at Easy is 3 days 🔥\n${SAMPLE_PAGE}`,
    );
    await app.stable();
    expect(app.text('puzzle-records li [role=status]')).toBe('Copied, ready to paste');

    share(2);
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledTimes(2));
    expect(writeText).toHaveBeenLastCalledWith(
      `Sample, Beat the clock (Easy): my record is 1 puzzle in 1 minute\n${SAMPLE_PAGE}`,
    );
    share(4);
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledTimes(3));
    expect(writeText).toHaveBeenLastCalledWith(
      `Sample, timed play: my best time for 7×7 is 1:05\n${SAMPLE_PAGE}`,
    );
  });
});
