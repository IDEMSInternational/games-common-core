import {
  AppStorage,
  loadStorage,
  readStored,
  removeStored,
  storedKeys,
  unloadStorage,
  writeStored,
} from './stored-setting';

/** The apps' storage (Capacitor Preferences), faked in memory. */
function fakeApp(initial: Record<string, string> = {}) {
  const saved = new Map(Object.entries(initial));
  const storage: AppStorage = {
    isApp: true,
    preferences: {
      keys: async () => ({ keys: [...saved.keys()] }),
      get: async ({ key }) => ({ value: saved.get(key) ?? null }),
      set: async ({ key, value }) => void saved.set(key, value),
      remove: async ({ key }) => void saved.delete(key),
    },
  };
  return { saved, storage };
}

/** The storage shared by every game. */
describe('Stored progress', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => unloadStorage());

  it('in a browser, uses web storage', async () => {
    await loadStorage({ ...fakeApp().storage, isApp: false });
    writeStored('sample.size', '9x9');
    expect(localStorage.getItem('sample.size')).toBe('9x9');
  });

  it("in the apps, keeps everything in the app's storage", async () => {
    const { saved, storage } = fakeApp({ 'storage.migrated': '1', 'sample.lock': '1' });
    await loadStorage(storage);
    expect(readStored('sample.lock')).toBe('1');

    writeStored('sample.size', '9x9');
    removeStored('sample.lock');
    await Promise.resolve();
    expect(saved.get('sample.size')).toBe('9x9');
    expect(saved.has('sample.lock')).toBe(false);
    expect(localStorage.length).toBe(0); // web storage not used
    expect(storedKeys().sort()).toEqual(['sample.size', 'storage.migrated']);
  });

  it('brings over what web storage held, once', async () => {
    localStorage.setItem('sample.daily.results', '{"2026-10-30.low":{"time":1,"onDay":true}}');
    localStorage.setItem('sample.lock', '0');
    const { saved, storage } = fakeApp({ 'sample.lock': '1' }); // the app's own value wins
    await loadStorage(storage);
    expect(readStored('sample.daily.results')).toContain('2026-10-30.low');
    expect(readStored('sample.lock')).toBe('1');
    expect(saved.get('sample.daily.results')).toContain('2026-10-30.low');

    // Later: web storage is no longer read.
    localStorage.setItem('sample.size', '5x5');
    unloadStorage();
    await loadStorage(storage);
    expect(readStored('sample.size')).toBeNull();
  });

  it("carries on with web storage if the app's storage fails", async () => {
    const { storage } = fakeApp();
    await loadStorage({
      ...storage,
      preferences: { ...storage.preferences, keys: () => Promise.reject(new Error('broken')) },
    });
    writeStored('sample.size', '9x9');
    expect(localStorage.getItem('sample.size')).toBe('9x9');
  });
});
