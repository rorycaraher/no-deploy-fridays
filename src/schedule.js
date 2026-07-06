const { DateTime } = require('luxon');

/**
 * Computes, for the work-week cycle containing `today`, the date of each
 * configured work day. The cycle is anchored to the *last* entry in
 * workDays (the normal end of the week) rather than a fixed Mon-Sun frame,
 * so non-Mon-Fri weeks (e.g. Sun-Thu) resolve correctly.
 */
function resolveWorkDayDates(today, workDays) {
  const anchorWeekday = workDays[workDays.length - 1].isoWeekday;
  const daysUntilAnchor = (anchorWeekday - today.weekday + 7) % 7;
  const upcomingAnchorDate = today.plus({ days: daysUntilAnchor });

  return workDays.map((day) => {
    const offset = (anchorWeekday - day.isoWeekday + 7) % 7;
    const date = upcomingAnchorDate.minus({ days: offset });
    return { ...day, date, dateISO: date.toISODate() };
  });
}

function findLastWorkingDay(resolvedWorkDays, holidays) {
  for (let i = resolvedWorkDays.length - 1; i >= 0; i -= 1) {
    if (!holidays.has(resolvedWorkDays[i].dateISO)) {
      return resolvedWorkDays[i].dateISO;
    }
  }
  return null;
}

function evaluate({ now, timezone, workDays, holidays }) {
  const today = DateTime.fromJSDate(now || new Date(), { zone: timezone });
  if (!today.isValid) {
    throw new Error(`Invalid timezone "${timezone}": ${today.invalidReason}`);
  }

  const todayISO = today.toISODate();

  if (holidays.has(todayISO)) {
    return { blocked: true, reason: 'holiday' };
  }

  const resolvedWorkDays = resolveWorkDayDates(today, workDays);
  const lastWorkingDayISO = findLastWorkingDay(resolvedWorkDays, holidays);

  if (lastWorkingDayISO === todayISO) {
    return { blocked: true, reason: 'last-working-day' };
  }

  return { blocked: false, reason: '' };
}

module.exports = { evaluate, resolveWorkDayDates, findLastWorkingDay };
