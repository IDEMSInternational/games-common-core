import { Injectable, computed, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { GAMES_DATA, downloadDaily } from './games-data';
import BUILT_IN from './games.json';
import { gamePage } from './share';
import { readStoredJson, writeStoredJson } from './stored-setting';

/** Where the list of IDEMS Games is published (the games-data repository, on GitHub Pages). */
const FILE = 'games.json';
export const GAMES_URL = GAMES_DATA + FILE;

const CACHE_KEY = 'games.cache';
const CHECKED_KEY = 'games.checked';

/** A game as published in games.json (see the games-data repository's README). */
export interface IdemsGame {
  readonly id: string;
  readonly name: string;
  /** One line about the puzzle. */
  readonly summary: string;
  /** Its store pages, once it's in that store. */
  readonly stores: { readonly android?: string; readonly ios?: string };
}

/** A game to show in the list: where a tap takes this phone, and whether that's its store. */
export interface ShownGame {
  readonly id: string;
  readonly name: string;
  readonly summary: string;
  readonly icon: string;
  readonly url: string;
  /** False while the game isn't in this phone's store: the tap opens its page, which says "Coming soon". */
  readonly inStore: boolean;
}

const isText = (value: unknown): value is string => typeof value === 'string' && value.trim() !== '';
const isLink = (value: unknown): value is string => typeof value === 'string' && value.startsWith('https://');
const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** The games that can be read from published data, or null if it isn't a list of games at all. */
export function parseGames(data: unknown): IdemsGame[] | null {
  const list = (data as { games?: unknown } | null)?.games;
  if (!Array.isArray(list)) return null;
  return list.flatMap((item): IdemsGame[] => {
    if (typeof item !== 'object' || item === null) return [];
    const { id, name, summary, stores } = item as Record<string, unknown>;
    if (typeof id !== 'string' || !ID.test(id) || !isText(name) || !isText(summary)) return [];
    const { android, ios } = (typeof stores === 'object' && stores !== null ? stores : {}) as Record<string, unknown>;
    return [
      {
        id,
        name,
        summary,
        stores: { ...(isLink(android) ? { android } : {}), ...(isLink(ios) ? { ios } : {}) },
      },
    ];
  });
}

/**
 * The other IDEMS Games, for the ☰ menu's Other IDEMS Games page, so a
 * new game reaches every app without a new release of it. Downloaded from
 * games-data when the app opens, at most once a day and never holding
 * anything up; the last copy is kept, and until the first download the app
 * uses the copy it was built with (games.json here). Nothing about the
 * player is sent.
 */
@Injectable({ providedIn: 'root' })
export class GamesStore {
  private readonly all = signal<readonly IdemsGame[]>(
    parseGames(readStoredJson(CACHE_KEY)) ?? parseGames(BUILT_IN) ?? [],
  );
  private readonly gameId = signal<string | null>(null);

  /**
   * The other games, in the published order: a tap opens the game in this
   * phone's store once it's there, and its page otherwise.
   */
  readonly others = computed((): ShownGame[] => {
    const platform = Capacitor.getPlatform();
    return this.all()
      .filter((game) => game.id !== this.gameId())
      .map((game) => {
        const store = platform === 'ios' ? game.stores.ios : platform === 'android' ? game.stores.android : undefined;
        return {
          id: game.id,
          name: game.name,
          summary: game.summary,
          icon: `${gamePage(game.id)}icon.png`,
          url: store ?? gamePage(game.id),
          // In a browser (not a phone), the page offers whichever stores have it.
          inStore: platform === 'web' ? Boolean(game.stores.android || game.stores.ios) : Boolean(store),
        };
      });
  });

  /** Shows the games other than this one, checking for a new list if it's been a day. */
  load(gameId: string): void {
    this.gameId.set(gameId);
    void this.download();
  }

  private async download(): Promise<void> {
    const games = parseGames(await downloadDaily(FILE, CHECKED_KEY));
    if (!games) return; // not due, offline, or not a list of games: keep what we had
    this.all.set(games);
    writeStoredJson(CACHE_KEY, { games });
  }
}
