import { WritableSignal, effect, signal } from '@angular/core';

/**
 * A signal holding an on/off setting that is remembered on this device,
 * e.g. a game's Lock switch. Storage can be unavailable (private browsing,
 * blocked site data); the setting then simply isn't remembered.
 * Must be created in an injection context (e.g. a component field).
 */
export function storedSetting(key: string, initial = false): WritableSignal<boolean> {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(key);
  } catch {
    // Not available; use the initial value.
  }
  const setting = signal(stored === null ? initial : stored === '1');
  effect(() => {
    const value = setting() ? '1' : '0';
    try {
      localStorage.setItem(key, value);
    } catch {
      // Not remembered; see above.
    }
  });
  return setting;
}
