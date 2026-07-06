const core = require('@actions/core');
const { getConfig } = require('./config');
const { gatherHolidays } = require('./holidays');
const { evaluate } = require('./schedule');

const REASON_MESSAGES = {
  holiday: 'Today is a configured holiday.',
  'last-working-day': 'Today is the last working day of the week.',
  'calendar-fetch-error': 'The holidays calendar could not be fetched, and on-calendar-error is "block".',
};

async function run() {
  try {
    const config = getConfig();
    const { dates: holidays, calendarError } = await gatherHolidays(config);

    let result;
    if (calendarError) {
      core.warning(`no-deploy-fridays: ${calendarError.message}`);
      result = { blocked: true, reason: 'calendar-fetch-error' };
    } else {
      result = evaluate({
        timezone: config.timezone,
        workDays: config.workDays,
        holidays,
      });
    }

    core.setOutput('is-blocked', String(result.blocked));
    core.setOutput('reason', result.reason);

    if (config.force) {
      core.warning(
        `no-deploy-fridays: force=true — bypassing block (was ${result.blocked ? 'blocked' : 'not blocked'}${
          result.reason ? `, reason: ${result.reason}` : ''
        }).`
      );
      return;
    }

    if (!result.blocked) {
      core.info('no-deploy-fridays: deploy allowed.');
      return;
    }

    const message = `Deploy blocked: ${REASON_MESSAGES[result.reason] || result.reason}`;
    if (config.failOnBlock) {
      core.setFailed(message);
    } else {
      core.warning(message);
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();

module.exports = { run };
