import { test as setup, chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { LoginPage } from '@src/pages/LoginPage';
import { env, requireCredentials } from '@src/config/env';
import { logger } from '@src/utils/logger';

const storageStatePath = path.resolve(env.storageStatePath);

/** The cache must never be assumed valid: cookies expire, passwords change, orgs tighten policy. */
async function isExistingSessionValid(): Promise<boolean> {
  if (!fs.existsSync(storageStatePath)) return false;

  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ storageState: storageStatePath });
    const page = await context.newPage();
    await page.goto(env.baseURL);
    // Fail fast here - if the cache is stale we want to leave the bulk of the test
    // timeout budget for a real login + OTP flow, not burn it waiting on a dead session.
    return await new LoginPage(page)
      .assertLoggedIn(8_000)
      .then(() => true)
      .catch(() => false);
  } finally {
    await browser.close();
  }
}

setup('authenticate', async ({ page }) => {
  setup.setTimeout(120_000);

  // Named so the report always shows whether this run hit the cached-session fast path or a
  // real login - without this, Part C.b's OTP step below only ever appears on a cache miss.
  const cachedSessionValid = await setup.step('Check cached session validity', isExistingSessionValid);
  if (cachedSessionValid) {
    logger.info('Cached storageState is still valid; skipping interactive login.');
    return;
  }

  requireCredentials();
  const loginPage = new LoginPage(page);
  const requestedAt = new Date();

  await loginPage.goto();
  await loginPage.login(env.username, env.password);

  await setup.step('Part C.b - automate the email verification (OTP) challenge, see README.md', async () => {
    if (await loginPage.isVerificationChallengePresented()) {
      logger.info('Email verification challenge detected, attempting automated retrieval.');
      await loginPage.completeVerificationChallenge(requestedAt);
    }
  });

  await loginPage.assertLoggedIn();

  fs.mkdirSync(path.dirname(storageStatePath), { recursive: true });
  await page.context().storageState({ path: storageStatePath });
  logger.info(`Cached authenticated session to ${storageStatePath}`);
});
