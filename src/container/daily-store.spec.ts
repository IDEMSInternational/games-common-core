import { AppHarness, SAMPLE_PAGE } from './testing/app-harness';

/** Friday 30 October 2026, 10am: daily puzzle #7 (Easy 6×6, Medium 7×7, Hard 10×10). */
const FRIDAY = new Date(2026, 9, 30, 10, 0);

/** The daily puzzles, from the home page. */
describe('Daily puzzles', () => {
  const app = new AppHarness({ now: FRIDAY });
  beforeEach(() => app.start());
  afterEach(() => app.stop());

  const daily = () => app.screens.daily()!;
  /** The clock on screen moves on four times a second (in real time; only Date is faked). */
  async function clockShows(ms: number): Promise<void> {
    await app.wait(300);
    expect(daily().elapsed()).toBe(ms);
  }

  it("opens on the home page, with today's daily puzzle and free play", () => {
    expect(app.text('h1')).toBe('Sample');
    expect(app.text('puzzle-home .what')).toBe('#7 · Friday');
    expect(app.text('puzzle-home .status')).toBe('Not played yet');
    // The last 7 days, from Saturday, the day of puzzle #1.
    const days = Array.from(app.element.querySelectorAll('.days li'), (li) => {
      const button = li.querySelector('button');
      return button ? `${button.textContent!.trim()} ${button.className.trim()}` : 'none';
    });
    expect(days).toEqual(['S new', 'S new', 'M new', 'T new', 'W new', 'T new', 'F new today']);
    expect(app.element.querySelector('sample-board')).toBeNull();
  });

  it('asks for the level when a daily puzzle is opened', async () => {
    await app.play(0);
    expect(app.text('.chooser h2')).toBe("Today's puzzle #7");
    const levels = Array.from(app.element.querySelectorAll('.chooser .level'), (b) =>
      Array.from(b.querySelectorAll('span'), (span) => span.textContent!.trim()).join(' / '),
    );
    expect(levels).toEqual([
      'Easy / 6×6 / not played yet',
      'Medium / 7×7 / not played yet',
      'Hard / 10×10 / not played yet',
    ]);

    await app.click('.chooser .cancel');
    expect(app.element.querySelector('.chooser')).toBeNull();

    await app.click('.days li:nth-child(4) button'); // Tuesday
    expect(app.text('.chooser h2')).toBe("Tuesday's puzzle #4");
    await app.click('.chooser .level', 1);
    expect(app.text('h1')).toBe('Daily puzzle #4');
    expect(app.text('.mode-bar span')).toBe('Tuesday · Medium · 6×6');
  });

  it('goes to a game and back, as browser history', async () => {
    app.screens.openTimed();
    await app.stable();
    expect(app.text('h1')).toBe('Timed play');

    await app.goHome();
    expect(app.element.querySelector('puzzle-home')).toBeTruthy();
  });

  it('plays the daily puzzle against a clock that starts at the first touch', async () => {
    app.screens.openDaily('2026-10-30', 2);
    await app.stable();
    expect(app.text('h1')).toBe('Daily puzzle #7');
    expect(app.text('.mode-bar span')).toBe('Friday · Hard · 10×10');
    expect(app.texts('.action-bar button')).toEqual(['Undo', 'Redo', 'Restart']); // no Solve
    expect(app.element.querySelector('puzzle-shell select')).toBeNull();

    app.later(30); // looking, not touching yet
    expect(app.text('.clock')).toBe('⏱ 0:00');
    app.element.querySelector('.board-area')!.dispatchEvent(new Event('pointerdown'));
    app.later(65);
    await app.stable();
    await clockShows(65_000);

    // Restart doesn't reset the clock.
    daily().move({ kind: 'set', at: 0, on: true });
    daily().restart();
    app.later(5);
    await clockShows(70_000);
  });

  it('stops the clock away from the puzzle, and keeps the time of each level', async () => {
    app.screens.openDaily('2026-10-30', 0);
    await app.stable();
    daily().touch();
    app.later(20);

    await app.goHome(); // the clock stops
    expect(app.text('puzzle-home .status')).toBe('Easy: 0:20 so far');
    // In progress: nothing shows on the day's circle.
    expect(
      app.element.querySelector('.days li:nth-child(7) button')!.getAttribute('style'),
    ).not.toContain('--brand');
    app.later(600);
    app.screens.openDaily('2026-10-30', 0);
    await app.stable();
    app.later(1);
    await clockShows(21_000);

    app.screens.startTutorial(); // the clock stops
    await app.stable();
    app.later(300);
    app.screens.endTutorial();
    await app.stable();
    await clockShows(21_000);

    // Another level has its own puzzle and clock.
    await app.goHome();
    app.screens.openDaily('2026-10-30', 1);
    await app.stable();
    expect(daily().elapsed()).toBe(0);
    daily().touch();
    app.later(5);

    // Closing the app there, and opening it again (on the home page).
    history.replaceState(null, '');
    await app.open();
    expect(app.text('puzzle-home .status')).toBe('Easy: 0:21 so far · Medium: 0:05 so far');
  });

  it('keeps the time of a solved puzzle, the streaks, and shares the result', async () => {
    // Thursday's solved on the day, at the Easy and Hard levels.
    localStorage.setItem(
      'sample.daily.results',
      JSON.stringify({
        '2026-10-29.low': { time: 1000, onDay: true },
        '2026-10-29.high': { time: 1000, onDay: true },
      }),
    );
    app.screens.openDaily('2026-10-30', 0);
    await app.stable();
    daily().touch();
    app.later(192);
    app.solve(daily());
    await app.stable();

    expect(daily().result()).toEqual({ time: 192_000, onDay: true });
    expect(daily().celebrate()).toBe(true);
    expect(app.text('.clock')).toBe('Solved in 3:12');
    expect(daily().canUndo()).toBe(false); // the solved board stays
    const solved = daily().state();
    daily().move({ kind: 'set', at: 0, on: false });
    expect(daily().state()).toBe(solved);

    const writeText = app.clipboard();
    await app.click('.mode-bar button');
    await vi.waitFor(() => expect(app.text('.mode-bar .shared')).toBe('Copied, ready to paste'));
    expect(writeText).toHaveBeenCalledWith(
      `Sample daily puzzle #7, Easy (Friday, 6×6)\nSolved in 3:12\n🔥 2-day streak at Easy\n${SAMPLE_PAGE}`,
    );

    await app.goHome();
    expect(app.text('puzzle-home .status')).toBe('Easy: solved in 3:12');
    // One streak at a time, the next each time the home page opens. Hard's
    // is still on: today's Hard puzzle can still be solved.
    const shown = [app.text('.streak')];
    for (let i = 0; i < 2; i++) {
      app.screens.openTimed();
      await app.goHome();
      shown.push(app.text('.streak'));
    }
    expect(shown[0]).not.toBe(shown[1]);
    expect(new Set(shown)).toEqual(new Set(['🔥 Easy: 2 days', '🔥 Hard: 1 day']));
    expect(app.element.querySelectorAll('.streak').length).toBe(1);
    const friday = app.element.querySelector('.days li:nth-child(7) button') as HTMLElement;
    expect(friday.className).toContain('solved');
    expect(friday.getAttribute('style')).toMatch(
      /var\(--brand\) 0(deg)? 120deg, var\(--surface\) 120deg 240deg/,
    ); // Easy's third

    // Opened again: the finished board, still solved.
    await app.open();
    app.screens.openDaily('2026-10-30', 0);
    await app.stable();
    expect(daily().completed()).toBe(true);
    expect(app.text('.clock')).toBe('Solved in 3:12');

    // Days later, with none solved since: the streaks are over.
    vi.setSystemTime(new Date(2026, 10, 3, 9, 0));
    history.replaceState(null, '');
    await app.open();
    expect(app.element.querySelector('.streak')).toBeNull();
  });

  it('lets the last 7 days be played, without sharing or the streak', async () => {
    app.screens.openDaily('2026-10-27', 2);
    await app.stable();
    expect(app.text('h1')).toBe('Daily puzzle #4');
    expect(app.text('.mode-bar span')).toBe('Tuesday · Hard · 9×9');
    daily().touch();
    app.later(100);
    app.solve(daily());
    await app.stable();

    expect(daily().result()).toEqual({ time: 100_000, onDay: false });
    expect(app.element.querySelector('.mode-bar button')).toBeNull(); // no Share
    expect(app.text('.mode-bar .shared')).toContain("doesn't count for your streak");
    await app.goHome();
    const tuesday = app.element.querySelector('.days li:nth-child(4) button') as HTMLElement;
    expect(tuesday.className).toContain('late');
    // Hard's third: not filled, but its edge is orange.
    expect(tuesday.getAttribute('style')).toMatch(
      /var\(--surface\) 240deg 360deg\) padding-box, .*var\(--brand\) 240deg 360deg\) border-box/,
    );
    expect(app.element.querySelector('.streak')).toBeNull();
  });

  it("can't open days still to come, or more than 7 days ago", async () => {
    app.screens.openDaily('2026-10-31', 0);
    await app.stable();
    expect(app.element.querySelector('puzzle-home')).toBeTruthy();

    vi.setSystemTime(new Date(2026, 10, 2, 9, 0)); // the next Monday
    await app.open();
    app.screens.openDaily('2026-10-26', 0);
    await app.stable();
    expect(app.element.querySelector('puzzle-home')).toBeTruthy();
    expect(app.element.querySelector('.days button')?.getAttribute('aria-label')).toBe(
      'Tuesday, puzzle #4: Not played yet',
    );
  });

  it('moves on to the next puzzle at midnight', async () => {
    vi.setSystemTime(new Date(2026, 9, 31, 0, 1));
    await app.open();
    expect(app.text('puzzle-home .what')).toBe('#8 · Saturday');
  });
});
