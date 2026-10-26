import { Page, expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { env } from '../config/env';
import { fetchLatestVerificationCode } from '../utils/otpMailReader';
import { logger } from '../utils/logger';

export class LoginPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async goto(): Promise<void> {
    await this.page.goto(env.baseURL);
  }

  async login(username: string, password: string): Promise<void> {
    await this.page.locator('#username').fill(username);

    // Some orgs use a progressive login: username submits first and only then
    // reveals the password field, instead of showing both fields together.
    const passwordField = this.page.locator('#password');
    if (!(await passwordField.isVisible().catch(() => false))) {
      await this.page.getByRole('button', { name: /log in/i }).click();
      await passwordField.waitFor({ state: 'visible', timeout: 15_000 });
    }

    await passwordField.fill(password);
    await this.page.getByRole('button', { name: /log in/i }).click();
  }

  async isVerificationChallengePresented(): Promise<boolean> {
    return this.page
      .getByRole('textbox', { name: 'Verification Code' })
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
  }

  /** Reads the OTP from the configured mailbox and submits it; pauses for manual entry if IMAP isn't configured. */
  async completeVerificationChallenge(requestedAt: Date): Promise<void> {
    const imapConfigured = env.otp.enabled && env.otp.imapHost && env.otp.imapUser && env.otp.imapPassword;

    if (!imapConfigured) {
      logger.warn(
        'OTP_IMAP_* is not configured (or OTP_AUTOMATION_ENABLED=false). Pausing in the Playwright ' +
          'Inspector - read the code from your inbox, enter it, click Verify, then click Resume.',
      );
      await this.page.pause();
      return;
    }

    const code = await fetchLatestVerificationCode(requestedAt);
    await this.page.getByRole('textbox', { name: 'Verification Code' }).fill(code);

    const rememberDevice = this.page.getByRole('checkbox', { name: "Don't ask again" });
    if (await rememberDevice.isVisible().catch(() => false)) {
      await rememberDevice.check().catch(() => {});
    }

    await this.page.getByRole('button', { name: 'Verify', exact: true }).click();
    logger.info('Submitted Salesforce email verification code');
  }

  async assertLoggedIn(timeout = 30_000): Promise<void> {
    await expect(
      this.page.getByRole('button', { name: /App Launcher/i }).or(this.page.getByPlaceholder('Search...')),
    ).toBeVisible({ timeout });
  }
}
