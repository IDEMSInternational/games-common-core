import { readStored, writeStored } from './stored-setting';

/**
 * Where IDEMS publishes the games' data, kept apart from their code: the
 * games-data repository, on GitHub Pages (see its README). The apps read
 * the announcements and the list of IDEMS Games from it, and link to each
 * game's page there.
 */
export const GAMES_DATA = 'https://idemsinternational.github.io/games-data/';

/** Check for new data at most this often. */
const CHECK_EVERY_MS = 24 * 60 * 60 * 1000;
/** Give up on a slow download after this long; the copy kept from last time is shown meanwhile. */
const TIMEOUT_MS = 8000;

/**
 * Downloads one of the published files (e.g. "games.json") if it hasn't
 * been downloaded in the last day, as recorded under `checkedKey`: its
 * contents, or null if it wasn't due, or the phone is offline, or the file
 * can't be read. Nothing about the player is sent.
 */
export async function downloadDaily(file: string, checkedKey: string): Promise<unknown | null> {
  const checked = Number(readStored(checkedKey)) || 0;
  if (Date.now() - checked < CHECK_EVERY_MS || typeof fetch !== 'function') return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(GAMES_DATA + file, {
      cache: 'no-cache',
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const data: unknown = await response.json();
    writeStored(checkedKey, String(Date.now()));
    return data;
  } catch {
    return null; // offline, or a bad file: keep what we had, and try again next time
  } finally {
    clearTimeout(timer);
  }
}
