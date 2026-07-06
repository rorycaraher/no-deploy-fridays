const path = require('path');
const { parseInlineHolidays, parseHolidaysFile, gatherHolidays } = require('../src/holidays');

jest.mock('../src/calendar');
const { fetchCalendarHolidays } = require('../src/calendar');

describe('parseInlineHolidays', () => {
  test('splits on commas', () => {
    expect(parseInlineHolidays('2026-01-01, 2026-12-25')).toEqual(['2026-01-01', '2026-12-25']);
  });

  test('splits on newlines', () => {
    expect(parseInlineHolidays('2026-01-01\n2026-12-25\n')).toEqual(['2026-01-01', '2026-12-25']);
  });

  test('returns an empty array for empty input', () => {
    expect(parseInlineHolidays('')).toEqual([]);
  });
});

describe('parseHolidaysFile', () => {
  test('parses a JSON array file', () => {
    const file = path.join(__dirname, 'fixtures', 'holidays.json');
    expect(parseHolidaysFile(file)).toEqual(['2026-12-25', '2026-01-01']);
  });

  test('parses a YAML array file', () => {
    const file = path.join(__dirname, 'fixtures', 'holidays.yaml');
    expect(parseHolidaysFile(file)).toEqual(['2026-11-26', '2026-11-27']);
  });

  test('returns an empty array when no path given', () => {
    expect(parseHolidaysFile('')).toEqual([]);
  });
});

describe('gatherHolidays', () => {
  beforeEach(() => {
    fetchCalendarHolidays.mockReset();
  });

  test('merges inline, file, and calendar sources', async () => {
    fetchCalendarHolidays.mockResolvedValue(new Set(['2026-07-04']));

    const config = {
      holidays: '2026-01-01',
      holidaysFile: path.join(__dirname, 'fixtures', 'holidays.yaml'),
      holidaysCalendarUrl: 'https://example.com/holidays.ics',
      onCalendarError: 'block',
    };

    const { dates, calendarError } = await gatherHolidays(config);

    expect(calendarError).toBeNull();
    expect(dates).toEqual(new Set(['2026-01-01', '2026-11-26', '2026-11-27', '2026-07-04']));
  });

  test('fails closed (returns calendarError) when calendar fetch fails and on-calendar-error=block', async () => {
    fetchCalendarHolidays.mockRejectedValue(new Error('network down'));

    const config = {
      holidays: '2026-01-01',
      holidaysFile: '',
      holidaysCalendarUrl: 'https://example.com/holidays.ics',
      onCalendarError: 'block',
    };

    const { dates, calendarError } = await gatherHolidays(config);

    expect(calendarError).not.toBeNull();
    expect(calendarError.message).toBe('network down');
    // dates gathered so far are still returned, but the caller is expected to
    // treat calendarError as an overriding "blocked" signal regardless.
    expect(dates.has('2026-01-01')).toBe(true);
  });

  test('drops the calendar source and continues when on-calendar-error=allow', async () => {
    fetchCalendarHolidays.mockRejectedValue(new Error('network down'));

    const config = {
      holidays: '2026-01-01',
      holidaysFile: '',
      holidaysCalendarUrl: 'https://example.com/holidays.ics',
      onCalendarError: 'allow',
    };

    const { dates, calendarError } = await gatherHolidays(config);

    expect(calendarError).toBeNull();
    expect(dates).toEqual(new Set(['2026-01-01']));
  });
});
