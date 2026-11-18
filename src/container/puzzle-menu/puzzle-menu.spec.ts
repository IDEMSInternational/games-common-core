import { AppHarness } from '../testing/app-harness';

/** The ☰ menu: the studio pages and Game options. */
describe('☰ menu', () => {
  const app = new AppHarness({ now: new Date(2026, 9, 30, 10, 0) }); // Friday, puzzle #7
  beforeEach(() => app.start());
  afterEach(() => app.stop());

  const pages = () => app.element.querySelectorAll('puzzle-menu nav button');
  const back = () => app.click('puzzle-menu header .icon'); // back to the list
  async function openMenu(): Promise<void> {
    await app.click('puzzle-menu .opener');
  }
  async function openOptions(): Promise<void> {
    await openMenu();
    await app.click('puzzle-menu nav button'); // the first
  }
  const boxes = () =>
    Array.from(app.element.querySelectorAll<HTMLInputElement>('puzzle-menu .tick input'));
  const todayCircle = () =>
    app.element.querySelector('.days li:nth-child(7) button')!.getAttribute('style');

  it('has the studio pages, the version, and closes with Escape', async () => {
    await openMenu();
    expect(app.texts('puzzle-menu nav button')).toEqual([
      'Game options',
      'Announcements',
      'Acknowledgements',
      'Other IDEMS Games',
      'Licence',
      'Terms and Conditions',
      'Privacy Policy',
    ]);
    expect(app.text('puzzle-menu .version')).toBe('Sample version 1.2.3');

    (pages()[2] as HTMLButtonElement).click(); // Acknowledgements
    await app.stable();
    expect(app.text('puzzle-menu .page')).toContain("Simon Tatham's Portable Puzzle Collection");
    const link = app.element.querySelector('puzzle-menu .link-card') as HTMLAnchorElement;
    expect(link.href).toBe('https://www.chiark.greenend.org.uk/~sgtatham/puzzles/');
    expect(link.textContent).toContain('chiark.greenend.org.uk/~sgtatham/puzzles');

    await back();
    (pages()[6] as HTMLButtonElement).click(); // Privacy Policy
    await app.stable();
    expect(app.texts('puzzle-menu .page h3')).toContain('Changes, including future research');
    expect(app.text('puzzle-menu .page')).toContain('games@idems.international');

    const panel = app.element.querySelector('puzzle-menu .panel')!;
    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await app.stable();
    expect(app.element.querySelector('puzzle-menu nav')).toBeTruthy(); // back to the list
    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await app.stable();
    expect(app.element.querySelector('puzzle-menu .panel')).toBeNull(); // closed
  });

  it("shows the licence, with the original collection's notice, and the other software's", async () => {
    await openMenu();
    (pages()[4] as HTMLButtonElement).click();
    await app.stable();
    expect(app.text('puzzle-menu .page')).toContain(
      'Sample is © 2026 IDEMS International, and it is open source.',
    );
    const repos = Array.from(
      app.element.querySelectorAll<HTMLAnchorElement>('puzzle-menu .link-card'),
      (a) => a.href,
    );
    expect(repos).toEqual([
      'https://github.com/IDEMSInternational/sample',
      'https://github.com/IDEMSInternational/games-common-core',
    ]);
    const licence = app.text('puzzle-menu .page section blockquote');
    expect(licence).toContain('Copyright (c) 2026 IDEMS International.');
    expect(licence).toContain(
      "Parts of this software are ports of Simon Tatham's Portable Puzzle Collection, which carries this notice:",
    );
    const inline = app.element.querySelector(
      'puzzle-menu .page section blockquote a',
    ) as HTMLAnchorElement;
    expect(inline.href).toBe('https://www.chiark.greenend.org.uk/~sgtatham/puzzles/');
    expect(licence).toContain('This software is copyright (c) 2004-2024 Simon Tatham.');
    expect(licence).toContain('Ben Harris and Anders Höglund.');
    expect(licence).toContain('THE SOFTWARE IS PROVIDED "AS IS"');
    const others = app.text('puzzle-menu .page');
    expect(others).toContain('Angular: Copyright (c) 2010-2026 Google LLC.');
    expect(others).toContain('AndroidX libraries: The Android Open Source Project.');
    expect(others).toContain('END OF TERMS AND CONDITIONS'); // the whole Apache License
    const accordions = Array.from(app.element.querySelectorAll('puzzle-menu details'), (d) => [
      d.querySelector('summary')!.textContent!.trim(),
      (d as HTMLDetailsElement).open,
    ]);
    expect(accordions).toEqual([
      ['Other open-source software', false],
      ['Apache License', false],
    ]);
  });

  describe('Game options', () => {
    it('has the dark theme switch and the daily levels, all ticked to start with', async () => {
      await openOptions();
      expect(app.text('puzzle-menu h2')).toBe('Game options');
      expect(app.texts('puzzle-menu .options h3')).toEqual([
        'Appearance',
        'Playing',
        'Daily puzzles',
        'Your progress',
      ]);
      expect(app.text('puzzle-menu .options puzzle-switch')).toBe('Dark theme');
      await app.click('puzzle-menu .options puzzle-switch input');
      expect(document.documentElement.dataset['theme']).toBe('dark');
      await app.click('puzzle-menu .options puzzle-switch input');

      expect(app.texts('puzzle-menu .tick')).toEqual(['Easy', 'Medium', 'Hard']);
      expect(boxes().map((box) => box.checked)).toEqual([true, true, true]);
    });

    it('has Show mistakes, the same setting as on the game screens, and no game-specific switches', async () => {
      await openOptions();
      const switches = () =>
        Array.from(app.element.querySelectorAll<HTMLElement>('puzzle-menu .setting'));
      expect(switches().map((s) => s.querySelector('puzzle-switch')!.textContent!.trim())).toEqual([
        'Show mistakes',
      ]);
      expect(switches()[0].querySelector('.hint')!.textContent).toBe(
        'Rule-breaking pieces are shown in red',
      );

      (switches()[0].querySelector('input') as HTMLInputElement).click();
      await app.stable();
      // One setting for every mode.
      expect(app.screens.session.showMistakes()).toBe(true);
      expect(app.screens.timed.showMistakes()).toBe(true);

      app.screens.openTimed();
      await app.stable();
      const onScreen = Array.from(
        app.element.querySelectorAll('puzzle-shell puzzle-switch input'),
        (i) => [i.parentElement!.textContent!.trim(), (i as HTMLInputElement).checked],
      );
      expect(onScreen).toEqual([['Show mistakes', true]]);
    });

    it('resets the records, after asking, keeping the settings', async () => {
      localStorage.setItem(
        'sample.daily.results',
        JSON.stringify({ '2026-10-30.low': { time: 60_000, onDay: true } }),
      );
      localStorage.setItem('sample.clock.records', JSON.stringify({ 'medium/5': 4 }));
      localStorage.setItem('sample.ladder.best', JSON.stringify({ 0: 300_000 }));
      localStorage.setItem(
        'sample.timed.best',
        JSON.stringify({ '7x7': { label: '7×7', time: 50_000 } }),
      );
      localStorage.setItem('sample.daily.levels', JSON.stringify([true, false, true]));
      await app.open();
      expect(app.text('.streak')).toBe('🔥 Easy: 1 day');

      await openOptions();
      const reset = () => app.element.querySelector('puzzle-menu .reset') as HTMLButtonElement;
      expect(reset().textContent!.trim()).toBe('Reset my records…');
      reset().click();
      await app.stable();
      expect(app.text('puzzle-menu .options [role=alert]')).toContain("It can't be undone.");
      await app.click('puzzle-menu .confirm button:last-child'); // Cancel
      expect(localStorage.getItem('sample.clock.records')).not.toBeNull();

      reset().click();
      await app.stable();
      await app.click('puzzle-menu .confirm .primary');
      expect(app.text('puzzle-menu .options [role=status]')).toBe(
        'Your records have been deleted.',
      );
      for (const key of ['daily.results', 'clock.records', 'ladder.best', 'timed.best']) {
        expect(localStorage.getItem(`sample.${key}`)).toBeNull();
      }
      expect(localStorage.getItem('sample.daily.levels')).toBe('[true,false,true]'); // a setting
      expect(app.element.querySelector('.streak')).toBeNull();
      expect(app.text('puzzle-home .status')).toBe('Not played yet');
      expect(app.screens.clockRecord()).toBeNull();
      expect(app.screens.ladderBest()).toBeNull();
      expect(app.screens.timedBest()).toBeNull();
    });

    it('plays only the levels ticked: the chooser, the circles and the streaks follow', async () => {
      expect(todayCircle()).toMatch(/0deg 120deg, .* 120deg 240deg, .* 240deg 360deg/); // thirds

      await openOptions();
      boxes()[0].click(); // Easy off: halves
      await app.stable();
      expect(todayCircle()).toMatch(/0deg 180deg, .* 180deg 360deg/);
      boxes()[1].click(); // Medium off: Hard only, a whole circle
      await app.stable();
      expect(todayCircle()).toMatch(/var\(--surface\) 0deg 360deg/);
      expect(boxes().map((box) => [box.checked, box.disabled])).toEqual([
        [false, false],
        [false, false],
        [true, true], // the last one ticked stays
      ]);

      await app.click('puzzle-menu header .icon:last-child'); // close
      await app.play(0); // today's
      expect(app.texts('.chooser .level .name')).toEqual(['Hard']);

      // Solving Hard is all the day's levels played: the big show, and a whole circle.
      await app.click('.chooser .level');
      const daily = app.screens.daily()!;
      app.solve(daily);
      expect(daily.celebration()).toBe('big');
      await app.goHome();
      expect(todayCircle()).toMatch(/var\(--brand\) 0deg 360deg/);
      expect(app.text('puzzle-home .status')).toMatch(/^Hard: solved in/);
      expect(app.text('.streak')).toBe('🔥 Hard: 1 day');

      // Remembered; Easy back on: its streak isn't shown while off, and is again now.
      await app.open();
      expect(app.screens.dailyLevels()).toEqual([false, false, true]);
      app.screens.setDailyLevel(2, false); // the last one: refused
      expect(app.screens.dailyLevels()).toEqual([false, false, true]);
      app.screens.setDailyLevel(0, true);
      await app.stable();
      expect(todayCircle()).toMatch(/0deg 180deg, .* 180deg 360deg/);
    });
  });
});
