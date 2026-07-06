const core = require('@actions/core');

const WEEKDAY_NUMBERS = {
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
  sun: 7,
};

function parseWorkDays(raw) {
  const names = raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (names.length === 0) {
    throw new Error('work-days must contain at least one weekday');
  }

  return names.map((name) => {
    const isoWeekday = WEEKDAY_NUMBERS[name];
    if (!isoWeekday) {
      throw new Error(
        `Invalid work-days entry "${name}". Use one of: mon, tue, wed, thu, fri, sat, sun`
      );
    }
    return { name, isoWeekday };
  });
}

function parseBoolean(raw, inputName) {
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  throw new Error(`Invalid ${inputName} value "${raw}". Use "true" or "false"`);
}

function parseOnCalendarError(raw) {
  const normalized = raw.trim().toLowerCase();
  if (normalized !== 'block' && normalized !== 'allow') {
    throw new Error(`Invalid on-calendar-error value "${raw}". Use "block" or "allow"`);
  }
  return normalized;
}

function getConfig() {
  const timezone = core.getInput('timezone', { required: true });

  return {
    timezone,
    workDays: parseWorkDays(core.getInput('work-days') || 'mon,tue,wed,thu,fri'),
    holidays: core.getInput('holidays') || '',
    holidaysFile: core.getInput('holidays-file') || '',
    holidaysCalendarUrl: core.getInput('holidays-calendar-url') || '',
    onCalendarError: parseOnCalendarError(core.getInput('on-calendar-error') || 'block'),
    failOnBlock: parseBoolean(core.getInput('fail-on-block') || 'true', 'fail-on-block'),
    force: parseBoolean(core.getInput('force') || 'false', 'force'),
  };
}

module.exports = { getConfig, parseWorkDays, WEEKDAY_NUMBERS };
