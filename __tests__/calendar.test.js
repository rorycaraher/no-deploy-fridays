const fs = require('fs');
const path = require('path');
const { fetchCalendarHolidays } = require('../src/calendar');

const ICS_FIXTURE = fs.readFileSync(path.join(__dirname, 'fixtures', 'holidays.ics'), 'utf8');

function mockFetchOk(body) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    text: () => Promise.resolve(body),
  });
}

describe('fetchCalendarHolidays', () => {
  beforeEach(() => {
    // Fixes "now" so the +/-400 day RRULE expansion window is deterministic.
    jest.useFakeTimers().setSystemTime(new Date('2026-06-01T00:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
    delete global.fetch;
  });

  test('treats a single all-day event as one holiday date', async () => {
    mockFetchOk(ICS_FIXTURE);

    const dates = await fetchCalendarHolidays('https://example.com/holidays.ics');

    expect(dates.has('2026-07-04')).toBe(true);
  });

  test('expands a multi-day all-day event, treating DTEND as exclusive', async () => {
    mockFetchOk(ICS_FIXTURE);

    const dates = await fetchCalendarHolidays('https://example.com/holidays.ics');

    expect(dates.has('2026-11-26')).toBe(true);
    expect(dates.has('2026-11-27')).toBe(true);
    expect(dates.has('2026-11-28')).toBe(true);
    expect(dates.has('2026-11-29')).toBe(false);
  });

  test('ignores timed (non-all-day) events even when holiday-related', async () => {
    mockFetchOk(ICS_FIXTURE);

    const dates = await fetchCalendarHolidays('https://example.com/holidays.ics');

    expect(dates.has('2026-08-15')).toBe(false);
  });

  test('expands a yearly RRULE within the +/-400 day window and excludes occurrences outside it', async () => {
    mockFetchOk(ICS_FIXTURE);

    const dates = await fetchCalendarHolidays('https://example.com/holidays.ics');

    expect(dates.has('2026-01-01')).toBe(true);
    expect(dates.has('2027-01-01')).toBe(true);
    expect(dates.has('2028-01-01')).toBe(false);
  });

  test('throws with the HTTP status when the calendar fetch responds non-OK', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404 });

    await expect(fetchCalendarHolidays('https://example.com/holidays.ics')).rejects.toThrow(
      'HTTP 404'
    );
  });
});
