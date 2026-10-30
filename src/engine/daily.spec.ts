import { addDays, dailyPuzzle, daysBetween, localDay, weekdayOf, weekOf } from './daily';

describe('daily puzzles', () => {
  const schedule = {
    firstDay: '2026-10-26',
    week: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
  };

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

  it('knows the weekdays and weeks, Monday first', () => {
    expect(weekdayOf('2026-10-26')).toBe(0); // a Monday
    expect(weekdayOf('2026-11-01')).toBe(6);
    expect(weekOf('2026-10-30')).toEqual([
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
    ]);
    expect(weekOf('2026-11-01')[0]).toBe('2026-10-26');
  });

  it('numbers the puzzles from the first day, and follows the weekly schedule', () => {
    expect(dailyPuzzle('slant', schedule, '2026-10-25')).toBeNull();
    expect(dailyPuzzle('slant', schedule, '2026-10-26')).toEqual({
      date: '2026-10-26',
      number: 1,
      weekday: 0,
      params: 'mon',
      seed: 'slant daily 2026-10-26',
    });
    const later = dailyPuzzle('slant', schedule, '2027-01-03')!;
    expect([later.number, later.params]).toEqual([70, 'sun']);
  });

  it('rejects anything but a date', () => {
    expect(() => addDays('30/10/2026', 1)).toThrow();
  });
});
