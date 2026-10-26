import { Page } from '@playwright/test';
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
    await this.page.getByRole('option', { name: appName, exact: true }).first().click();
    await this.waitForLightningReady();
  }
}
