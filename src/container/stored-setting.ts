import { WritableSignal, effect, signal } from '@angular/core';

/*
 * Settings remembered on this device. Storage can be unavailable (private
 * browsing, blocked site data); settings then simply aren't remembered.
 */

/** Reads a remembered value, or null if there is none (or no storage). */
export function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Remembers a value, if storage is available. */
export function writeStored(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Not remembered; see above.
  }
}

/**
 * A signal holding an on/off setting that is remembered on this device,
 * e.g. a game's Lock switch. Must be created in an injection context
 * (e.g. a component field).
 */
export function storedSetting(key: string, initial = false): WritableSignal<boolean> {
  const stored = readStored(key);
  const setting = signal(stored === null ? initial : stored === '1');
  effect(() => writeStored(key, setting() ? '1' : '0'));
  return setting;
}
