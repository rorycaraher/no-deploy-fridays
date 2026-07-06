const ical = require('node-ical');

const WINDOW_DAYS = 400;

function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function datesBetween(start, end) {
  const dates = [];
  const cur = new Date(start);
  while (cur < end) {
    dates.push(toISODate(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

function expandEvent(event, windowStart, windowEnd) {
  const dates = [];

  if (event.rrule) {
    const durationMs =
      event.start && event.end ? event.end.getTime() - event.start.getTime() : 24 * 60 * 60 * 1000;
    const occurrences = event.rrule.between(windowStart, windowEnd, true);
    for (const occStart of occurrences) {
      const occEnd = new Date(occStart.getTime() + durationMs);
      dates.push(...datesBetween(occStart, occEnd));
    }
    return dates;
  }

  if (event.start && event.end) {
    dates.push(...datesBetween(event.start, event.end));
  } else if (event.start) {
    dates.push(toISODate(event.start));
  }

  return dates;
}

async function fetchCalendarHolidays(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch holidays calendar: HTTP ${response.status}`);
  }
  const text = await response.text();
  const parsed = ical.parseICS(text);

  const now = new Date();
  const windowStart = new Date(now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const dates = new Set();
  for (const key of Object.keys(parsed)) {
    const event = parsed[key];
    if (event.type !== 'VEVENT') continue;
    // Only treat all-day events as holidays; skip timed events (e.g. "Holiday observance webinar").
    if (event.datetype && event.datetype !== 'date') continue;

    for (const d of expandEvent(event, windowStart, windowEnd)) {
      dates.add(d);
    }
  }

  return dates;
}

module.exports = { fetchCalendarHolidays };
