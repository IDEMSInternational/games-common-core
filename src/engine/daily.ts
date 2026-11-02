/*
 * Daily puzzles: each day, a puzzle at each of three levels for each
 * game, the same for everyone, made from the date alone (no server, works
 * offline). Days are the player's own calendar days, written
 * "2026-10-30"; new puzzles come at their midnight.
 *
 * The rule in dailyPuzzle (date and level → number, parameters and seed) is a
 * promise to players: changing it would change puzzles already played
 * and give players on different versions different puzzles. Each game
 * pins a few dates to their puzzles in its tests.
 */

/** The levels of the daily puzzles, so every player finds one to enjoy. */
export const DAILY_LEVELS = ['Low', 'Medium', 'High'];

/** The puzzles of a game's week: which puzzle settings on which day, at each level. */
export interface DailySchedule<Params> {
  /** The day of puzzle #1. */
  readonly firstDay: string;
  /** For each level (Low, Medium, High), the parameters for each day of the week, Monday first. */
  readonly levels: readonly (readonly Params[])[];
}

export interface DailyPuzzle<Params> {
  readonly date: string;
  /** Puzzle #1 is on the schedule's first day. */
  readonly number: number;
  /** 0 is Monday, 6 is Sunday. */
  readonly weekday: number;
  /** 0 is Low, 1 Medium, 2 High. */
  readonly level: number;
  readonly params: Params;
  readonly seed: string;
}

export const WEEKDAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The day it is now where the player is, e.g. "2026-10-30". */
export function localDay(now = new Date()): string {
  return format(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

/** The day `days` days after `date` (before it, if negative). */
export function addDays(date: string, days: number): string {
  return format(parse(date) + days * DAY_MS);
}

/** How many days `to` is after `from` (negative if before). */
export function daysBetween(from: string, to: string): number {
  return Math.round((parse(to) - parse(from)) / DAY_MS);
}

/** 0 for Monday … 6 for Sunday. */
export function weekdayOf(date: string): number {
  return (new Date(parse(date)).getUTCDay() + 6) % 7;
}

/** How many days' puzzles can be played: today's and the six before. */
export const AVAILABLE_DAYS = 7;

/** The days whose puzzles can be played on `today`, oldest first, ending with today. */
export function availableDays(today: string): string[] {
  return Array.from({ length: AVAILABLE_DAYS }, (_, i) => addDays(today, i - AVAILABLE_DAYS + 1));
}

/**
 * The daily puzzle of `gameId` on `date` at `level`, or null before the
 * first day. Its seed generates the same puzzle on every device. All
 * three levels of a day share its number.
 */
export function dailyPuzzle<Params>(
  gameId: string,
  schedule: DailySchedule<Params>,
  date: string,
  level: number,
): DailyPuzzle<Params> | null {
  const number = daysBetween(schedule.firstDay, date) + 1;
  if (number < 1) return null;
  const weekday = weekdayOf(date);
  const params = schedule.levels[level][weekday];
  const seed = `${gameId} daily ${date} ${DAILY_LEVELS[level].toLowerCase()}`;
  return { date, number, weekday, level, params, seed };
}

/** Milliseconds since 1970 at the start of `date`, counted in UTC so every day is 24 hours. */
function parse(date: string): number {
  const match = DATE.exec(date);
  if (!match) throw new Error(`Not a date: ${date}`);
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function format(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}
