const { parseWorkDays } = require('../src/config');

describe('parseWorkDays', () => {
  test('parses a standard Mon-Fri list in order', () => {
    expect(parseWorkDays('mon,tue,wed,thu,fri')).toEqual([
      { name: 'mon', isoWeekday: 1 },
      { name: 'tue', isoWeekday: 2 },
      { name: 'wed', isoWeekday: 3 },
      { name: 'thu', isoWeekday: 4 },
      { name: 'fri', isoWeekday: 5 },
    ]);
  });

  test('parses a Sun-Thu list, preserving wraparound order', () => {
    expect(parseWorkDays('sun,mon,tue,wed,thu')).toEqual([
      { name: 'sun', isoWeekday: 7 },
      { name: 'mon', isoWeekday: 1 },
      { name: 'tue', isoWeekday: 2 },
      { name: 'wed', isoWeekday: 3 },
      { name: 'thu', isoWeekday: 4 },
    ]);
  });

  test('is case-insensitive and trims whitespace', () => {
    expect(parseWorkDays(' Mon , TUE ,wed')).toEqual([
      { name: 'mon', isoWeekday: 1 },
      { name: 'tue', isoWeekday: 2 },
      { name: 'wed', isoWeekday: 3 },
    ]);
  });

  test('throws on an unrecognized weekday name', () => {
    expect(() => parseWorkDays('mon,funday')).toThrow(/Invalid work-days entry/);
  });

  test('throws on an empty list', () => {
    expect(() => parseWorkDays('')).toThrow(/at least one weekday/);
  });
});
