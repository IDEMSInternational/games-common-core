import { addDays, availableDays } from '../engine/daily';
import { SessionSnapshot } from '../engine/game-session';
import { readStoredJson, removeStored, writeStoredJson } from './stored-setting';

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
 * cleared).
 */
export class DailyRecords {
  private readonly resultsKey: string;
  private readonly savePrefix: string;

  constructor(gameId: string) {
    this.resultsKey = `${gameId}.daily.results`;
    this.savePrefix = `${gameId}.daily.`;
  }

  results(): Readonly<Record<string, DailyResult>> {
    return readStoredJson<Record<string, DailyResult>>(this.resultsKey) ?? {};
  }

  addResult(date: string, result: DailyResult): void {
    writeStoredJson(this.resultsKey, { ...this.results(), [date]: result });
  }

  game<Move>(date: string): DailySave<Move> | null {
    return readStoredJson<DailySave<Move>>(this.savePrefix + date);
  }

  saveGame<Move>(date: string, save: DailySave<Move>): void {
    writeStoredJson(this.savePrefix + date, save);
  }

  status(date: string): DayStatus {
    const result = this.results()[date];
    if (result) return result.onDay ? 'solved' : 'late';
    return this.game(date)?.started ? 'started' : 'new';
  }

  /**
   * Days in a row with the puzzle solved on its day, up to today (or up to
   * yesterday while today's is still to do).
   */
  streak(today: string): number {
    const results = this.results();
    let day = results[today]?.onDay ? today : addDays(today, -1);
    let streak = 0;
    while (results[day]?.onDay) {
      streak++;
      day = addDays(day, -1);
    }
    return streak;
  }

  /** Forgets the games that can no longer be played (their results are kept). */
  clearOldGames(today: string): void {
    const oldest = availableDays(today)[0];
    try {
      const old = Object.keys(localStorage).filter((key) => {
        const date = key.startsWith(this.savePrefix) ? key.slice(this.savePrefix.length) : '';
        return /^\d{4}-\d{2}-\d{2}$/.test(date) && date < oldest;
      });
      old.forEach(removeStored);
    } catch {
      // No storage: nothing to clear.
    }
  }
}
