# Project Guidelines

This project implements the requirements in
[GovTech - QA - Assesment Testv1.pdf](../GovTech%20%20-%20QA%20-%20Assesment%20Testv1.pdf) —
treat it as the source of truth for what Part A/B/C require before changing
test scope or coverage.

## Playwright CLI gotchas (not obvious from the code/config)

- `--project=setup` only matches `*.setup.ts` (see `testMatch` in
  `playwright.config.ts`). It will **never** run a `.spec.ts` file, even one
  under `tests/setup/` or `tests/adhoc/` — target those explicitly instead,
  e.g. `npx playwright test tests/adhoc/otp-imap-check.spec.ts --project=chromium`.
- Passing `--reporter=<X>` on the CLI **replaces** the configured `reporter`
  array for that run entirely — the HTML report and `test-results/results.json`
  will NOT regenerate unless the CLI reporter flag is omitted.
- Switching `SF_USERNAME`/`SF_BASE_URL` in `.env` to a different Salesforce
  org requires switching `STORAGE_STATE_PATH` to that org's own cache file in
  the *same* edit, or the new org's session silently overwrites the old
  org's cache.
- A visible red/failed step inside an otherwise green/passed test (e.g. in a
  trace or HTML report) is not necessarily a real failure — check whether
  the surrounding code in that page object intentionally catches that
  action's rejection as part of a retry (see `LeadFormPage.fill()`/
  `openNewLeadForm()`) before concluding it's a regression.
- `OTP_IMAP_*` only works with providers that still allow Basic Auth IMAP
  (e.g. Gmail with an App Password). Any Microsoft-hosted mailbox
  (Outlook.com/Hotmail or Microsoft 365/Exchange Online) rejects it outright
  and requires OAuth2 — don't spend time debugging IMAP timeouts against a
  Microsoft address, switch providers instead.
