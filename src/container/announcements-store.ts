import { Injectable, computed, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { localDay } from '../engine/daily';
import { readStored, readStoredJson, writeStored, writeStoredJson } from './stored-setting';

/** Where the announcements are published (the games-data repository, on GitHub Pages). */
export const ANNOUNCEMENTS_URL = 'https://idemsinternational.github.io/games-data/announcements.json';

/** Check for news at most this often. */
const CHECK_EVERY_MS = 24 * 60 * 60 * 1000;
/** Give up on a slow download after this long; the copy kept from last time is shown meanwhile. */
const TIMEOUT_MS = 8000;

const CACHE_KEY = 'announcements.cache';
const CHECKED_KEY = 'announcements.checked';
const SEEN_KEY = 'announcements.seen';

/** An announcement as published (see the games-data repository's README). */
export interface Announcement {
  readonly id: string;
  /** YYYY-MM-DD: shown from this day. */
  readonly date: string;
  /** YYYY-MM-DD: the last day it shows, if any. */
  readonly until?: string;
  /** The game it announces, which doesn't show it. */
  readonly about?: string;
  readonly title: string;
  readonly text: string;
  readonly links?: { readonly android?: string; readonly ios?: string };
}

/** An announcement to show: its store link is the one for this device. */
export interface ShownAnnouncement {
  readonly id: string;
  readonly date: string;
  readonly title: string;
  readonly text: string;
  readonly link: { readonly url: string; readonly label: string } | null;
}

const isDay = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
const isText = (value: unknown): value is string => typeof value === 'string' && value.trim() !== '';
const isLink = (value: unknown): value is string => typeof value === 'string' && value.startsWith('https://');

/** The announcements that can be read from downloaded data; anything malformed is skipped. */
export function parseAnnouncements(data: unknown): Announcement[] {
  const list = (data as { announcements?: unknown } | null)?.announcements;
  if (!Array.isArray(list)) return [];
  return list.flatMap((item): Announcement[] => {
    if (typeof item !== 'object' || item === null) return [];
    const { id, date, until, about, title, text, links } = item as Record<string, unknown>;
    if (!isText(id) || !isDay(date) || !isText(title) || !isText(text)) return [];
    if (until !== undefined && !isDay(until)) return [];
    const { android, ios } = (typeof links === 'object' && links !== null ? links : {}) as Record<string, unknown>;
    return [
      {
        id,
        date,
        ...(until !== undefined ? { until } : {}),
        ...(typeof about === 'string' ? { about } : {}),
        title,
        text,
        links: { ...(isLink(android) ? { android } : {}), ...(isLink(ios) ? { ios } : {}) },
      },
    ];
  });
}

/**
 * IDEMS's announcements (mostly new games), for the ☰ menu's
 * Announcements page. They're downloaded when the app opens, at most once
 * a day and never holding anything up; the last copy is kept, so the page
 * works offline. Nothing about the player is sent. Announcements already
 * opened are remembered, so only new ones get the orange dot.
 */
@Injectable({ providedIn: 'root' })
export class AnnouncementsStore {
  private readonly all = signal<readonly Announcement[]>(parseAnnouncements(readStoredJson(CACHE_KEY)));
  private readonly seen = signal<readonly string[]>(readStoredJson<string[]>(SEEN_KEY) ?? []);
  private readonly gameId = signal<string | null>(null);
  private readonly today = signal(localDay());

  /** The announcements showing now in this game, newest first. */
  readonly current = computed((): ShownAnnouncement[] => {
    const today = this.today();
    const platform = Capacitor.getPlatform();
    return this.all()
      .filter((a) => a.date <= today && (!a.until || today <= a.until) && a.about !== this.gameId())
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((a) => ({ id: a.id, date: a.date, title: a.title, text: a.text, link: storeLink(a, platform) }));
  });
  /** True while there's an announcement the player hasn't opened the page to see. */
  readonly unseen = computed(() => this.current().some((a) => !this.seen().includes(a.id)));

  /** Shows the announcements for this game, checking for news if it's been a day. */
  load(gameId: string): void {
    this.gameId.set(gameId);
    this.today.set(localDay());
    const checked = Number(readStored(CHECKED_KEY)) || 0;
    if (Date.now() - checked >= CHECK_EVERY_MS) void this.download();
  }

  /** The player opened the Announcements page: the current ones are seen. */
  markSeen(): void {
    const ids = new Set(this.all().map((a) => a.id));
    // Keep only ids still published, so the list doesn't grow for ever.
    const seen = [...new Set([...this.seen(), ...this.current().map((a) => a.id)])].filter((id) => ids.has(id));
    this.seen.set(seen);
    writeStoredJson(SEEN_KEY, seen);
  }

  private async download(): Promise<void> {
    if (typeof fetch !== 'function') return;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(ANNOUNCEMENTS_URL, { cache: 'no-cache', signal: controller.signal });
      if (!response.ok) return;
      const all = parseAnnouncements(await response.json());
      this.all.set(all);
      writeStoredJson(CACHE_KEY, { announcements: all });
      writeStored(CHECKED_KEY, String(Date.now()));
    } catch {
      // Offline, or a bad file: keep what we had, and try again next time.
    } finally {
      clearTimeout(timer);
    }
  }
}

/** The store page for this device: the App Store on iPhones, Google Play elsewhere. */
function storeLink(announcement: Announcement, platform: string): ShownAnnouncement['link'] {
  const { android, ios } = announcement.links ?? {};
  if (platform === 'ios') return ios ? { url: ios, label: 'Get it on the App Store' } : null;
  return android ? { url: android, label: 'Get it on Google Play' } : null;
}
