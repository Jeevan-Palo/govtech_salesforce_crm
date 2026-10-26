import { Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class AppLauncherPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async openApp(appName: string): Promise<void> {
    await this.page.getByRole('button', { name: 'App Launcher' }).click();
    await this.page.getByPlaceholder('Search apps and items...').fill(appName);
    await this.page.getByRole('option', { name: appName, exact: false }).first().click();
    await this.waitForLightningReady();
  }
}
