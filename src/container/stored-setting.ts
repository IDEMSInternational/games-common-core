import { WritableSignal, effect, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

/*
 * Settings and progress remembered on this device.
 *
 * In the Android and iOS apps they live in the app's own settings storage
 * (SharedPreferences, UserDefaults), through Capacitor's Preferences:
 * unlike the web view's storage, the system never clears it to free space,
 * and it is included in the phone's backups. It's read once when the app
 * starts (loadStorage), then kept in memory, so reading stays instant;
 * writes go to memory and on to the device.
 *
 * In a browser, and until loadStorage has run, the browser's localStorage
 * is used. Storage can be unavailable there (private browsing, blocked
 * site data); settings then simply aren't remembered.
 */

/** The values in the app's storage, once loaded (in the apps only). */
let appValues: Map<string, string> | null = null;

/** Set once web storage has been copied into the app's storage. */
const MIGRATED = 'storage.migrated';

/** What loadStorage needs from Capacitor (replaceable in tests). */
export interface AppStorage {
  readonly isApp: boolean;
  readonly preferences: Pick<typeof Preferences, 'keys' | 'get' | 'set' | 'remove'>;
}

/**
 * Loads the app's storage into memory: call once, before the app starts
 * (see each game's app.config.ts). The first time, it brings over what
 * earlier versions kept in web storage. In a browser it does nothing.
 */
export async function loadStorage(
  storage: AppStorage = { isApp: Capacitor.isNativePlatform(), preferences: Preferences },
): Promise<void> {
  if (!storage.isApp) return;
  const { preferences } = storage;
  try {
    const values = new Map<string, string>();
    const { keys } = await preferences.keys();
    for (const key of keys) {
      const { value } = await preferences.get({ key });
      if (value !== null) values.set(key, value);
    }
    if (!values.has(MIGRATED)) {
      for (const [key, value] of webEntries()) {
        if (values.has(key)) continue;
        values.set(key, value);
        await preferences.set({ key, value });
      }
      values.set(MIGRATED, '1');
      await preferences.set({ key: MIGRATED, value: '1' });
    }
    appValues = values;
    write = (key, value) => {
      const done = value === null ? preferences.remove({ key }) : preferences.set({ key, value });
      done.catch(() => {}); // still in memory for this session
    };
  } catch {
    // The app's storage isn't working: carry on with web storage.
  }
}

/** Back to web storage only, as before loadStorage (for tests). */
export function unloadStorage(): void {
  appValues = null;
}

/** Saves a value (or null: removes it) to the app's storage. */
let write: (key: string, value: string | null) => void = () => {};

/** Reads a remembered value, or null if there is none (or no storage). */
export function readStored(key: string): string | null {
  if (appValues) return appValues.get(key) ?? null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Remembers a value, if storage is available. */
export function writeStored(key: string, value: string): void {
  if (appValues) {
    appValues.set(key, value);
    return write(key, value);
  }
  try {
    localStorage.setItem(key, value);
  } catch {
    // Not remembered; see above.
  }
}

/** Forgets a remembered value, if storage is available. */
export function removeStored(key: string): void {
  if (appValues) {
    appValues.delete(key);
    return write(key, null);
  }
  try {
    localStorage.removeItem(key);
  } catch {
    // Nothing stored anyway.
  }
}

/** The keys of every remembered value. */
export function storedKeys(): string[] {
  if (appValues) return [...appValues.keys()];
  return webEntries().map(([key]) => key);
}

/** Everything in web storage. */
function webEntries(): [string, string][] {
  try {
    return Object.keys(localStorage).map((key) => [key, localStorage.getItem(key) ?? '']);
  } catch {
    return [];
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
