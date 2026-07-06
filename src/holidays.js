const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { fetchCalendarHolidays } = require('./calendar');

function parseInlineHolidays(raw) {
  if (!raw) return [];
  return raw
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseHolidaysFile(filePath) {
  if (!filePath) return [];

  const resolved = path.resolve(process.env.GITHUB_WORKSPACE || process.cwd(), filePath);
  const content = fs.readFileSync(resolved, 'utf8');
  const parsed = yaml.load(content); // js-yaml parses JSON too, since JSON is a YAML subset

  if (!Array.isArray(parsed)) {
    throw new Error(
      `holidays-file must contain a YAML/JSON array of YYYY-MM-DD dates, got: ${typeof parsed}`
    );
  }

  // js-yaml parses unquoted YYYY-MM-DD entries as native Date objects (YAML 1.1
  // timestamp type), not strings. Normalize those back to their ISO date.
  return parsed.map((entry) =>
    entry instanceof Date ? entry.toISOString().slice(0, 10) : String(entry)
  );
}

async function gatherHolidays(config) {
  const dates = new Set();

  for (const d of parseInlineHolidays(config.holidays)) dates.add(d);
  for (const d of parseHolidaysFile(config.holidaysFile)) dates.add(d);

  if (config.holidaysCalendarUrl) {
    try {
      const calendarDates = await fetchCalendarHolidays(config.holidaysCalendarUrl);
      for (const d of calendarDates) dates.add(d);
    } catch (err) {
      if (config.onCalendarError === 'block') {
        return { dates, calendarError: err };
      }
      // on-calendar-error=allow: drop the failed source, keep whatever other holidays we gathered.
    }
  }

  return { dates, calendarError: null };
}

module.exports = { gatherHolidays, parseInlineHolidays, parseHolidaysFile };
