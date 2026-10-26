import { Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { convertTo18, extractRecordIdFromUrl } from '../utils/salesforceId';

export class LeadDetailPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async getLeadId18(): Promise<string> {
    // Salesforce sometimes redirects to the shorthand /lightning/r/<Id>/view form, omitting "Lead/".
    await this.page.waitForURL(/\/lightning\/r\/(?:Lead\/)?[a-zA-Z0-9]{15,18}\/view/);
    return convertTo18(extractRecordIdFromUrl(this.page.url()));
  }

  async editStatus(newStatus: string): Promise<void> {
    await this.page.getByText('Status', { exact: true }).locator('..').getByRole('button').click();
    await this.selectCombobox('Status', newStatus);
    await this.page.keyboard.press('Enter');
    await this.getToastMessage();
  }

  async clickConvert(): Promise<void> {
    const convertButton = this.page.getByRole('button', { name: 'Convert', exact: true });
    if (await convertButton.isVisible().catch(() => false)) {
      await convertButton.click();
    } else {
      // The action can be tucked under the overflow menu depending on the page layout.
      await this.page.getByRole('button', { name: 'Show more actions' }).click();
      await this.page.getByRole('menuitem', { name: 'Convert' }).click();
    }
    await this.waitForLightningReady();
  }
}
