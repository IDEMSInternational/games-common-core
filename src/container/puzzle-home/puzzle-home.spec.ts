import { AppHarness } from '../testing/app-harness';

/** The home page, free play and the Challenges page. */
describe('Home page', () => {
  const app = new AppHarness({ now: new Date(2026, 10, 2, 10, 0) });
  beforeEach(() => app.start());
  afterEach(() => app.stop());

  const headings = () => app.texts('puzzle-home h2');
  async function back(): Promise<void> {
    const popped = new Promise((resolve) =>
      window.addEventListener('popstate', resolve, { once: true }),
    );
    await app.click('button.back');
    await popped;
    await app.stable();
  }

  it('has daily puzzles, free play and Challenges', () => {
    expect(app.text('h1')).toBe('Sample');
    expect(headings()).toEqual(['Daily puzzles', 'Free play', 'Challenges']);
  });

  it('opens free play: any size, with Solve', async () => {
    await app.play(1);
    expect(app.text('h1')).toBe('Free play');
    expect(app.element.querySelector('puzzle-shell select')).toBeTruthy();
    expect(app.element.querySelector('.mode-bar')).toBeNull(); // no clock
    expect(app.texts('.action-bar button')).toEqual(['Undo', 'Redo', 'Restart', 'Solve']);

    await app.click('.action-bar button', 3);
    expect(app.screens.session.completed()).toBe(true);
    expect(app.screens.session.celebrate()).toBe(false); // solved with Solve: no fireworks

    await back();
    expect(headings()).toEqual(['Daily puzzles', 'Free play', 'Challenges']);
  });

  it('opens Challenges: Beat the clock, timed play and the ladder, each coming back to it', async () => {
    await app.play(2);
    expect(app.text('h1')).toBe('Challenges');
    expect(headings()).toEqual(['Beat the clock', 'Timed play', 'Ladder']);
    expect(app.element.querySelector('puzzle-menu')).toBeNull(); // the ☰ menu is on the home page

    await app.play(1);
    expect(app.text('h1')).toBe('Timed play');
    await back();
    expect(app.text('h1')).toBe('Challenges');

    await back();
    expect(app.text('h1')).toBe('Sample');
  });
});
