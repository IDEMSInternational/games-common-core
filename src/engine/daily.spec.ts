import { addDays, availableDays, dailyPuzzle, daysBetween, localDay, weekdayOf } from './daily';

describe('daily puzzles', () => {
  const week = (level: string) => ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((d) => `${level} ${d}`);
  const schedule = { firstDay: '2026-10-26', levels: [week('low'), week('medium'), week('high')] };

  it('takes the day from the local calendar', () => {
    expect(localDay(new Date(2026, 9, 30, 23, 59))).toBe('2026-10-30');
    expect(localDay(new Date(2026, 9, 31, 0, 0))).toBe('2026-10-31');
  });

  it('counts days across months, years and clock changes', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2); // UK clocks change on the 25th
    expect(daysBetween('2026-10-26', '2026-10-24')).toBe(-2);
  });

  it('knows the weekdays, Monday first', () => {
    expect(weekdayOf('2026-10-26')).toBe(0); // a Monday
    expect(weekdayOf('2026-11-01')).toBe(6);
  });

  it("offers today's puzzle and the six before", () => {
    expect(availableDays('2026-11-01')).toEqual([
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
    ]);
  });

  it('numbers the puzzles from the first day, and follows the weekly schedule at each level', () => {
    expect(dailyPuzzle('slant', schedule, '2026-10-25', 0)).toBeNull();
    expect(dailyPuzzle('slant', schedule, '2026-10-26', 0)).toEqual({
      date: '2026-10-26',
      number: 1,
      weekday: 0,
      level: 0,
      params: 'low mon',
      seed: 'slant daily 2026-10-26 low',
    });
    const later = dailyPuzzle('slant', schedule, '2027-01-03', 2)!;
    expect([later.number, later.params, later.seed]).toEqual([70, 'high sun', 'slant daily 2027-01-03 high']);
  });

  it('rejects anything but a date', () => {
    expect(() => addDays('30/10/2026', 1)).toThrow();
  });
});
