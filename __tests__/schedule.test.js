const { evaluate } = require('../src/schedule');
const { parseWorkDays } = require('../src/config');

const MON_FRI = parseWorkDays('mon,tue,wed,thu,fri');
const SUN_THU = parseWorkDays('sun,mon,tue,wed,thu');

function at(iso, zone = 'UTC') {
  return new Date(iso);
}

describe('evaluate (default Mon-Fri work week)', () => {
  test('blocks on a plain Friday with no holidays', () => {
    // 2026-07-10 is a Friday
    const result = evaluate({
      now: at('2026-07-10T12:00:00Z'),
      timezone: 'UTC',
      workDays: MON_FRI,
      holidays: new Set(),
    });
    expect(result).toEqual({ blocked: true, reason: 'last-working-day' });
  });

  test('does not block a plain Wednesday with no holidays', () => {
    // 2026-07-08 is a Wednesday
    const result = evaluate({
      now: at('2026-07-08T12:00:00Z'),
      timezone: 'UTC',
      workDays: MON_FRI,
      holidays: new Set(),
    });
    expect(result).toEqual({ blocked: false, reason: '' });
  });

  test('blocks on a holiday regardless of weekday', () => {
    // 2026-07-08 is a Wednesday
    const result = evaluate({
      now: at('2026-07-08T12:00:00Z'),
      timezone: 'UTC',
      workDays: MON_FRI,
      holidays: new Set(['2026-07-08']),
    });
    expect(result).toEqual({ blocked: true, reason: 'holiday' });
  });

  test('shifts last-working-day to Thursday when Friday is a holiday', () => {
    // Week of 2026-07-06 (Mon) .. 2026-07-10 (Fri); Friday is a holiday
    const holidays = new Set(['2026-07-10']);

    const thursday = evaluate({
      now: at('2026-07-09T12:00:00Z'),
      timezone: 'UTC',
      workDays: MON_FRI,
      holidays,
    });
    expect(thursday).toEqual({ blocked: true, reason: 'last-working-day' });

    const friday = evaluate({
      now: at('2026-07-10T12:00:00Z'),
      timezone: 'UTC',
      workDays: MON_FRI,
      holidays,
    });
    expect(friday).toEqual({ blocked: true, reason: 'holiday' });
  });

  test('shifts last-working-day to Wednesday when Thu and Fri are both holidays', () => {
    const holidays = new Set(['2026-07-09', '2026-07-10']);

    const wednesday = evaluate({
      now: at('2026-07-08T12:00:00Z'),
      timezone: 'UTC',
      workDays: MON_FRI,
      holidays,
    });
    expect(wednesday).toEqual({ blocked: true, reason: 'last-working-day' });

    const tuesday = evaluate({
      now: at('2026-07-07T12:00:00Z'),
      timezone: 'UTC',
      workDays: MON_FRI,
      holidays,
    });
    expect(tuesday).toEqual({ blocked: false, reason: '' });
  });

  test('does not extend blocking to the prior week because next Monday is a holiday', () => {
    // 2026-07-13 (Mon) is a holiday; the preceding Friday 2026-07-10 should NOT be
    // blocked for that reason (only the plain "last working day" rule applies to it,
    // which already blocks it independently).
    const holidays = new Set(['2026-07-13']);
    const thursday = evaluate({
      now: at('2026-07-09T12:00:00Z'),
      timezone: 'UTC',
      workDays: MON_FRI,
      holidays,
    });
    expect(thursday).toEqual({ blocked: false, reason: '' });
  });
});

describe('evaluate (timezone handling)', () => {
  test('uses the configured timezone, not UTC, to determine the weekday', () => {
    // 2026-07-09T23:30:00Z is Thursday in UTC, but already Friday 09:30 in Sydney (+10).
    const utcResult = evaluate({
      now: at('2026-07-09T23:30:00Z'),
      timezone: 'UTC',
      workDays: MON_FRI,
      holidays: new Set(),
    });
    expect(utcResult).toEqual({ blocked: false, reason: '' });

    const sydneyResult = evaluate({
      now: at('2026-07-09T23:30:00Z'),
      timezone: 'Australia/Sydney',
      workDays: MON_FRI,
      holidays: new Set(),
    });
    expect(sydneyResult).toEqual({ blocked: true, reason: 'last-working-day' });
  });

  test('resolves the correct local date across a DST transition boundary', () => {
    // US spring-forward 2026 happens at 2026-03-08 07:00 UTC (2am -> 3am ET).
    // At 2026-03-08T04:30:00Z it is still 2026-03-07 23:30 in America/New_York (pre-DST, UTC-5).
    const result = evaluate({
      now: at('2026-03-08T04:30:00Z'),
      timezone: 'America/New_York',
      workDays: MON_FRI,
      holidays: new Set(['2026-03-07']),
    });
    expect(result).toEqual({ blocked: true, reason: 'holiday' });
  });
});

describe('evaluate (non-Mon-Fri work week)', () => {
  test('blocks on Thursday, the configured last working day, for a Sun-Thu week', () => {
    // 2026-07-09 is a Thursday
    const result = evaluate({
      now: at('2026-07-09T12:00:00Z'),
      timezone: 'UTC',
      workDays: SUN_THU,
      holidays: new Set(),
    });
    expect(result).toEqual({ blocked: true, reason: 'last-working-day' });
  });

  test('does not block Friday, which is outside the Sun-Thu work week', () => {
    // 2026-07-10 is a Friday
    const result = evaluate({
      now: at('2026-07-10T12:00:00Z'),
      timezone: 'UTC',
      workDays: SUN_THU,
      holidays: new Set(),
    });
    expect(result).toEqual({ blocked: false, reason: '' });
  });

  test('shifts last-working-day to Wednesday when Thursday is a holiday', () => {
    // 2026-07-08 is a Wednesday
    const result = evaluate({
      now: at('2026-07-08T12:00:00Z'),
      timezone: 'UTC',
      workDays: SUN_THU,
      holidays: new Set(['2026-07-09']),
    });
    expect(result).toEqual({ blocked: true, reason: 'last-working-day' });
  });

  test('correctly resolves Sunday as the first work day of the same cycle', () => {
    // 2026-07-05 is a Sunday, in the same Sun-Thu cycle as Thursday 2026-07-09
    const result = evaluate({
      now: at('2026-07-05T12:00:00Z'),
      timezone: 'UTC',
      workDays: SUN_THU,
      holidays: new Set(['2026-07-06', '2026-07-07', '2026-07-08', '2026-07-09']),
    });
    // With Mon-Thu all holidays, Sunday becomes the last remaining working day.
    expect(result).toEqual({ blocked: true, reason: 'last-working-day' });
  });
});
