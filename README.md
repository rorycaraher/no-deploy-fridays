# No Deploy Fridays

A GitHub Action that blocks deployments on the *actual* last working day of the week.

## Why

"Don't deploy on Friday" is easy to say and easy to forget to actually enforce. It also breaks down the moment a holiday shifts the risky day earlier in the week — nobody wants to ship right before a long weekend either, holiday or not. This action makes both rules explicit and automatic.

## What it checks, in order

1. **Is today a configured holiday?** If so, blocked (reason: `holiday`), regardless of weekday.
2. **Is today the last working day of the week?** Computed from your `work-days` list, walking backwards from the normal end of the week and skipping any day that's a holiday. So if Friday is a holiday, Thursday becomes the blocked day instead (reason: `last-working-day`).

This does **not** look ahead into next week — a holiday on the following Monday does not push the block back to Thursday. Only holidays within the current work week shift the last-working-day calculation.

## Usage

```yaml
- name: Block risky deploy days
  uses: rorycaraher/no-deploy-fridays@v0.1.3
  with:
    timezone: 'America/New_York'
    holidays: '2026-12-25,2026-01-01'
```

By default this **fails the step** on a blocked day, which stops the job. To gate a later step instead of failing this one:

```yaml
- name: Check deploy day
  id: gate
  uses: rorycaraher/no-deploy-fridays@v0.1.3
  with:
    timezone: 'America/New_York'
    fail-on-block: 'false'

- name: Deploy
  if: steps.gate.outputs.is-blocked == 'false'
  run: ./deploy.sh
```

### Sourcing holidays from a Google Calendar

Use the public ICS URL from a calendar's "Public URL" sharing setting (not the Google Calendar API):

```yaml
- uses: rorycaraher/no-deploy-fridays@v0.1.3
  with:
    timezone: 'America/New_York'
    holidays-calendar-url: 'https://calendar.google.com/calendar/ical/.../public/basic.ics'
```

All-day events in the feed (including recurring ones) are treated as holidays. `holidays`, `holidays-file`, and `holidays-calendar-url` can all be set together — their dates are merged.

If the calendar can't be fetched, the action **fails closed by default** (treats it as a blocked day) rather than silently allowing a deploy on an unrecognized holiday. Set `on-calendar-error: allow` to instead drop the calendar source and continue with whatever other holidays are configured.

### Sourcing holidays from a file

```yaml
- uses: rorycaraher/no-deploy-fridays@v0.1.3
  with:
    timezone: 'America/New_York'
    holidays-file: '.github/holidays.yaml'
```

```yaml
# .github/holidays.yaml
- '2026-12-25'
- '2026-01-01'
```

### A 4-day or shifted work week

```yaml
# 4-day week
- uses: rorycaraher/no-deploy-fridays@v0.1.3
  with:
    timezone: 'Asia/Dubai'
    work-days: 'mon,tue,wed,thu'

    # shifted: Sunday - Thursday
- uses: rorycaraher/no-deploy-fridays@v0.1.3
  with:
    timezone: 'Asia/Dubai'
    work-days: 'sun,mon,tue,wed,thu'
```

The last entry in `work-days` is treated as the normal end of the week (here, Thursday).

### Emergency override

```yaml
- uses: rorycaraher/no-deploy-fridays@v0.1.3
  with:
    timezone: 'America/New_York'
    github-token: ${{ secrets.GITHUB_TOKEN }}
    force-label: 'force-deploy'
```

When `github-token` is set, the action looks up the pull request(s) associated with the current commit (works even on a `push`-to-main deploy triggered after a PR merge, where the event itself carries no PR data) and bypasses the block if any of them carry the `force-label` label. This requires `pull-requests: read` permission for the token:

```yaml
permissions:
  contents: read
  pull-requests: read
```

`force: true` still works as a direct, explicit override (e.g. from a `workflow_dispatch` input) and doesn't require a token. The two are independent — either one bypasses the block. Any bypass is always logged as a warning, naming which mechanism triggered it — never silent — and the action's outputs still report what *would* have happened.

### Blocking an entire workflow

GitHub Actions doesn't support running a `uses:` action outside of `jobs:`, so there's no literal "top of the workflow" placement. Instead, use a single dedicated gate job that every deploy job depends on via `needs:`. If the gate job fails (the default `fail-on-block: true` behavior), every job that lists it in `needs` is skipped automatically:

```yaml
jobs:
  deploy-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: rorycaraher/no-deploy-fridays@v0.1.3
        with:
          timezone: 'America/New_York'

  deploy:
    needs: deploy-gate
    runs-on: ubuntu-latest
    steps:
      - run: ./deploy.sh

  deploy-staging:
    needs: deploy-gate
    runs-on: ubuntu-latest
    steps:
      - run: ./deploy-staging.sh
```

## Inputs

| Name | Required | Default | Description |
|---|---|---|---|
| `timezone` | yes | — | IANA timezone name (e.g. `America/New_York`) used to determine the current date and weekday. No UTC default — you must pick your team's timezone explicitly. |
| `work-days` | no | `mon,tue,wed,thu,fri` | Comma-separated working weekdays, in chronological order. The last entry is the normal end of the week. |
| `holidays` | no | `''` | Comma or newline separated `YYYY-MM-DD` dates. Merged with the other holiday inputs. |
| `holidays-file` | no | `''` | Path to a JSON or YAML file (relative to the workspace) containing an array of `YYYY-MM-DD` dates. Merged with the other holiday inputs. |
| `holidays-calendar-url` | no | `''` | Public ICS feed URL (e.g. a Google Calendar "Public URL"). All-day events are treated as holidays. Merged with the other holiday inputs. |
| `on-calendar-error` | no | `block` | `block` (fail closed) or `allow` (drop the calendar source) when `holidays-calendar-url` can't be fetched or parsed. |
| `fail-on-block` | no | `true` | Whether to fail the step on a blocked day, versus only emitting outputs. |
| `force` | no | `false` | Bypass the block entirely for this run. Always logged, never silent. |
| `github-token` | no | `''` | Token used to look up the pull request(s) associated with the current commit, to check for `force-label`. Leave unset to disable label-based force-deploy entirely. |
| `force-label` | no | `force-deploy` | PR label that bypasses the block, same as `force: true`, when `github-token` is set and the label is found on a pull request associated with the current commit. |

## Outputs

| Name | Description |
|---|---|
| `is-blocked` | `"true"` or `"false"` — whether today is blocked, before any `force` override. |
| `reason` | `holiday`, `last-working-day`, `calendar-fetch-error`, or `""` when not blocked. |

## Development

```bash
npm ci
npm test          # unit tests
npm run build     # bundles src/ into dist/index.js via @vercel/ncc
```

`dist/index.js` is committed and is what actually runs — GitHub Actions doesn't run `npm install` for JS actions. CI fails if `dist/` is out of sync with `src/`, so always run `npm run build` after changing source and commit the result.

`npm ci`/`npm install` also configures a `pre-push` git hook (via `.githooks/`, wired up through `core.hooksPath`) that rebuilds `dist/` and blocks the push if it doesn't match what's committed — the same check CI runs, just caught before you push instead of after.

## License

MIT
