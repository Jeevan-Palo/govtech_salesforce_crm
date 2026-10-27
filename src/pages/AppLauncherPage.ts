import { expect, Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class AppLauncherPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async openApp(appName: string): Promise<void> {
    // No-op if we're already in the target app - re-launching it via the App Launcher search
    // is flaky (the search box/option list behave differently once the app is already active).
    const currentApp = await this.page.getByRole('heading', { level: 1 }).first().textContent().catch(() => null);
    if (currentApp?.trim() === appName) return;

    await this.page.getByRole('button', { name: 'App Launcher' }).click();
    await this.page.getByPlaceholder('Search apps and items...').fill(appName);
    // Exact match - a substring match can hit the wrong app (e.g. "Sales" also matches "Salesforce Chatter").
    const option = this.page.getByRole('option', { name: appName, exact: true }).first();
    // The search-results list re-renders asynchronously after typing (slower on WebKit); wait for
    // the option to actually settle rather than guessing how long that takes.
    await expect(option).toBeVisible({ timeout: 20_000 });
    await option.click();
    await this.waitForLightningReady();
  }
}
