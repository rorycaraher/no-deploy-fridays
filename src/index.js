const core = require('@actions/core');
const { getConfig } = require('./config');
const { gatherHolidays } = require('./holidays');
const { evaluate } = require('./schedule');
const { checkForceLabel } = require('./force-label');

const REASON_MESSAGES = {
  holiday: 'Today is a configured holiday.',
  'last-working-day': 'Today is the last working day of the week.',
  'calendar-fetch-error': 'The holidays calendar could not be fetched, and on-calendar-error is "block".',
};

async function resolveLabelForce(config) {
  if (!config.githubToken) return { forced: false, pullNumber: null };

  const [owner, repo] = (process.env.GITHUB_REPOSITORY || '').split('/');
  const sha = process.env.GITHUB_SHA;

  try {
    return await checkForceLabel({
      token: config.githubToken,
      owner,
      repo,
      sha,
      label: config.forceLabel,
    });
  } catch (err) {
    core.warning(`no-deploy-fridays: could not check for force-label "${config.forceLabel}": ${err.message}`);
    return { forced: false, pullNumber: null };
  }
}

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

    // Skip the label lookup entirely when force is already true — no need to spend an API call.
    const labelForce = config.force ? { forced: false, pullNumber: null } : await resolveLabelForce(config);

    if (config.force || labelForce.forced) {
      const sources = [];
      if (config.force) sources.push('force input');
      if (labelForce.forced) sources.push(`"${config.forceLabel}" label on PR #${labelForce.pullNumber}`);

      core.warning(
        `no-deploy-fridays: bypassing block (was ${result.blocked ? 'blocked' : 'not blocked'}${
          result.reason ? `, reason: ${result.reason}` : ''
        }) — forced via ${sources.join(' and ')}.`
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
