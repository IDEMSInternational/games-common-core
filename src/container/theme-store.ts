import { Injectable, computed, effect, signal } from '@angular/core';
import { readStored, writeStored } from './stored-setting';

/** The player's choice, once they've made one: 'dark' or 'light'. */
const KEY = 'theme';

/**
 * Light or dark theme. Until the player chooses with the switch in the ☰
 * menu, it follows the phone's setting (and changes with it); once they
 * choose, their choice is remembered. Applied as data-theme on the page's
 * root element, which theme.scss styles.
 */
@Injectable({ providedIn: 'root' })
export class ThemeStore {
  private readonly chosen = signal(readStored(KEY));
  private readonly systemDark = signal(false);

  /** True when the dark theme is showing. */
  readonly dark = computed(() => {
    const chosen = this.chosen();
    return chosen === 'dark' || chosen === 'light' ? chosen === 'dark' : this.systemDark();
  });

  constructor() {
    const media = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
    if (media) {
      this.systemDark.set(media.matches);
      media.addEventListener?.('change', (event) => this.systemDark.set(event.matches));
    }
    this.apply(); // straight away, so the first screen is already in the right theme
    effect(() => this.apply());
  }

  setDark(dark: boolean): void {
    const theme = dark ? 'dark' : 'light';
    this.chosen.set(theme);
    writeStored(KEY, theme);
  }

  private apply(): void {
    document.documentElement.dataset['theme'] = this.dark() ? 'dark' : 'light';
  }
}
