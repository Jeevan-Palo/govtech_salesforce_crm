import { Page, expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { env } from '../config/env';
import { fetchLatestVerificationCode } from '../utils/otpMailReader';
import { logger } from '../utils/logger';

// Salesforce's classic login form; these field ids are stable across orgs.
const VERIFICATION_CODE_INPUT = '#tc, input[name="emc"], #emc';

export class LoginPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async goto(): Promise<void> {
    await this.page.goto(env.baseURL);
  }

  async login(username: string, password: string): Promise<void> {
    await this.page.locator('#username').fill(username);
    await this.page.locator('#password').fill(password);
    await this.page.locator('#Login').click();
  }

  async isVerificationChallengePresented(): Promise<boolean> {
    return this.page
      .locator(VERIFICATION_CODE_INPUT)
      .first()
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
  }

  /** Reads the OTP from the configured mailbox and submits it; throws if automation is disabled. */
  async completeVerificationChallenge(requestedAt: Date): Promise<void> {
    if (!env.otp.enabled) {
      throw new Error(
        'Salesforce requested an email verification code but OTP_AUTOMATION_ENABLED=false. ' +
          'Enter the code manually once, or configure OTP_IMAP_* to automate it (see README).',
      );
    }

    const code = await fetchLatestVerificationCode(requestedAt);
    await this.page.locator(VERIFICATION_CODE_INPUT).first().fill(code);

    const rememberDevice = this.page.locator('#rememberUn, input[name="save"]').first();
    if (await rememberDevice.isVisible().catch(() => false)) {
      await rememberDevice.check().catch(() => {});
    }

    await this.page.locator('#verify, button:has-text("Verify")').first().click();
    logger.info('Submitted Salesforce email verification code');
  }

  async assertLoggedIn(): Promise<void> {
    await expect(
      this.page.getByRole('button', { name: /App Launcher/i }).or(this.page.getByPlaceholder('Search...')),
    ).toBeVisible({ timeout: 30_000 });
  }
}
