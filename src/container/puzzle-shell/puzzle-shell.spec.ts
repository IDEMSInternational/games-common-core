import { AppHarness } from '../testing/app-harness';

/** The size menu in free play (timed play has the same one). */
describe('Size menu', () => {
  const app = new AppHarness();
  beforeEach(async () => {
    await app.start();
    await app.play(1); // free play
  });
  afterEach(() => app.stop());

  const menu = () => app.element.querySelector<HTMLSelectElement>('puzzle-shell select')!;
  const items = () => Array.from(menu().options, (o) => o.textContent!.trim());
  const shown = () => menu().selectedOptions[0].textContent!.trim();
  const form = () => app.element.querySelector<HTMLFormElement>('.custom-form');
  const fields = () =>
    Array.from(form()!.querySelectorAll<HTMLInputElement>('input'), (input) => input.value);

  /** Picks the menu item with this text, as the player does. */
  async function choose(text: string): Promise<void> {
    const option = Array.from(menu().options).find((o) => o.textContent!.trim() === text)!;
    menu().value = option.value;
    menu().dispatchEvent(new Event('change'));
    await app.stable();
  }

  async function createCustom(w: number, h: number): Promise<void> {
    await choose('Custom…');
    const [width, height] = Array.from(form()!.querySelectorAll<HTMLInputElement>('input'));
    width.value = String(w);
    height.value = String(h);
    form()!.dispatchEvent(new Event('submit', { cancelable: true }));
    await app.stable();
  }

  it('lists the sizes, then Custom…', () => {
    const sizes = ['4×4', '5×5', '6×6', '7×7', '8×8', '9×9', '10×10'];
    expect(items()).toEqual([...sizes, 'Custom…']);
    expect(form()).toBeNull();
  });

  it('shows a custom puzzle by its size, so Custom… can be chosen again', async () => {
    await createCustom(5, 8);
    expect(form()).toBeNull();
    expect(app.screens.session.gameId()).toMatch(/^5x8#/);
    expect(shown()).toBe('5×8');
    expect(items().slice(-2)).toEqual(['5×8', 'Custom…']);

    // Custom… again: the form opens, filled in with the size being played.
    await choose('Custom…');
    expect(fields()).toEqual(['5', '8']);

    // Back to the custom puzzle, as Cancel: the form closes, the puzzle stays.
    const game = app.screens.session.gameId();
    await choose('5×8');
    expect(form()).toBeNull();
    expect(app.screens.session.gameId()).toBe(game);

    // Another custom size, then a listed one: the custom item goes.
    await createCustom(6, 9);
    expect(shown()).toBe('6×9');
    await choose('7×7');
    expect(shown()).toBe('7×7');
    expect(items()).not.toContain('6×9');
  });
});
