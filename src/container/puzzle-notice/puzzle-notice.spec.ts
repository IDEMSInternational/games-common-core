import { AppHarness } from '../testing/app-harness';

/** The first launch: the splash, the welcome notice and the tutorial. */
describe('First launch', () => {
  const app = new AppHarness({ firstLaunch: true });
  beforeEach(() => app.start());
  afterEach(() => app.stop());

  it("starts with the tutorial, on the game's board, behind the IDEMS Games splash", () => {
    expect(app.element.querySelector('puzzle-tutorial sample-board svg')).toBeTruthy();
    expect(app.element.querySelectorAll('sample-board .cell').length).toBe(16);
    expect(app.element.querySelector('puzzle-splash img')?.getAttribute('src')).toBe(
      'studio/idems-games-logo.jpg',
    );
  });

  it('shows the welcome notice on first launch only, with the terms and privacy policy', async () => {
    expect(app.text('puzzle-notice h2')).toBe('Welcome to Sample');
    expect(app.texts('puzzle-notice summary')).toEqual(['Terms and Conditions', 'Privacy Policy']);
    expect(app.text('puzzle-notice')).toContain(
      'At the moment, the apps do not collect any personal information.',
    );

    await app.click('puzzle-notice button');
    expect(app.element.querySelector('puzzle-notice .notice')).toBeNull();

    await app.open(); // opening the app again
    expect(app.element.querySelector('puzzle-notice .notice')).toBeNull();
  });
});
