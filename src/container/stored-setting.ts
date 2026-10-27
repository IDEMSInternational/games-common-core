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

/** Forgets a remembered value, if storage is available. */
export function removeStored(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Nothing stored anyway.
  }
}

/** Typed arrays that stored data may contain (games' states and moves use them). */
const TYPED_ARRAYS = {
  Int8Array,
  Uint8Array,
  Int16Array,
  Uint16Array,
  Int32Array,
  Uint32Array,
  Float32Array,
  Float64Array,
};
type TypedArrayName = keyof typeof TYPED_ARRAYS;

/**
 * Remembers any plain data as JSON. Typed arrays (e.g. Int8Array), which
 * JSON can't represent, are written in a form readStoredJson turns back
 * into the same kind of array.
 */
export function writeStoredJson(key: string, value: unknown): void {
  writeStored(
    key,
    JSON.stringify(value, (_, v: unknown) =>
      ArrayBuffer.isView(v) && !(v instanceof DataView)
        ? { $typedArray: v.constructor.name, values: Array.from(v as Int8Array) }
        : v,
    ),
  );
}

/** Reads data remembered with writeStoredJson, or null if none or unreadable. */
export function readStoredJson<T>(key: string): T | null {
  const text = readStored(key);
  if (!text) return null;
  try {
    return JSON.parse(text, (_, v: { $typedArray?: string; values?: number[] } | null) => {
      const name = v?.$typedArray as TypedArrayName | undefined;
      return name && name in TYPED_ARRAYS ? TYPED_ARRAYS[name].from(v!.values ?? []) : v;
    }) as T;
  } catch {
    return null;
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
