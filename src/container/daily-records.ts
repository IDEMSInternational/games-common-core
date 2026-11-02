import { DAILY_LEVEL_KEYS, addDays, availableDays } from '../engine/daily';
import { SessionSnapshot } from '../engine/game-session';
import { readStoredJson, removeStored, storedKeys, writeStoredJson } from './stored-setting';

/** A solved daily puzzle. */
export interface DailyResult {
  /** Time taken, in milliseconds. */
  readonly time: number;
  /** Solved on the puzzle's own day (only these count for the streak). */
  readonly onDay: boolean;
}

/** A daily puzzle being played, or played: the game and the time so far. */
export interface DailySave<Move> {
  readonly snapshot: SessionSnapshot<Move>;
  /** Milliseconds on the clock. */
  readonly elapsed: number;
  /** The clock started (at the first touch on the board). */
  readonly started: boolean;
}

/** Where a day's puzzle is at, for the home page. */
export type DayStatus = 'solved' | 'late' | 'started' | 'new';

/**
 * The player's daily puzzles, remembered on this device: every result
 * (small, kept for the streak) and the games of the days that can still
 * be played (so a solved puzzle can be looked at again; older ones are
 * cleared). Each day has a puzzle at each level.
 */
export class DailyRecords {
  private readonly resultsKey: string;
  private readonly savePrefix: string;

  constructor(gameId: string) {
    this.resultsKey = `${gameId}.daily.results`;
    this.savePrefix = `${gameId}.daily.`;
  }

  /** Every result, by day and level ("2026-10-30.low"). */
  results(): Readonly<Record<string, DailyResult>> {
    return readStoredJson<Record<string, DailyResult>>(this.resultsKey) ?? {};
  }

  result(date: string, level: number): DailyResult | null {
    return this.results()[key(date, level)] ?? null;
  }

  addResult(date: string, level: number, result: DailyResult): void {
    writeStoredJson(this.resultsKey, { ...this.results(), [key(date, level)]: result });
  }

  game<Move>(date: string, level: number): DailySave<Move> | null {
    return readStoredJson<DailySave<Move>>(this.savePrefix + key(date, level));
  }

  saveGame<Move>(date: string, level: number, save: DailySave<Move>): void {
    writeStoredJson(this.savePrefix + key(date, level), save);
  }

  status(date: string, level: number): DayStatus {
    const result = this.result(date, level);
    if (result) return result.onDay ? 'solved' : 'late';
    return this.game(date, level)?.started ? 'started' : 'new';
  }

  /**
   * Days in a row with the puzzle at `level` solved on its day, up to
   * today (or up to yesterday while today's is still to do).
   */
  streak(today: string, level: number): number {
    const results = this.results();
    const onDay = (date: string) => results[key(date, level)]?.onDay === true;
    let day = onDay(today) ? today : addDays(today, -1);
    let streak = 0;
    while (onDay(day)) {
      streak++;
      day = addDays(day, -1);
    }
    return streak;
  }

  /** Forgets the games that can no longer be played (their results are kept). */
  clearOldGames(today: string): void {
    const oldest = availableDays(today)[0];
    const old = storedKeys().filter((key) => {
      const date = key.startsWith(this.savePrefix)
        ? key.slice(this.savePrefix.length, this.savePrefix.length + 10)
        : '';
      return /^\d{4}-\d{2}-\d{2}$/.test(date) && date < oldest;
    });
    old.forEach(removeStored);
  }
}

/** "2026-10-30.low" */
function key(date: string, level: number): string {
  return `${date}.${DAILY_LEVEL_KEYS[level]}`;
}
