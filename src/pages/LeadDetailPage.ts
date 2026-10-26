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

  /**
   * Lead Status is driven by the Lightning "Path" component: a `listbox "Path Options"` of
   * `option`s plus a "Mark as Current Status" confirm button - not a simple inline-edit field.
   * See NOTES.md (Part C.a) for why role-based locators are used here instead of CSS/data-*
   * selectors against this component's dynamically-regenerated markup.
   */
  async editStatus(newStatus: string): Promise<void> {
    await this.page.getByRole('option', { name: newStatus, exact: true }).click();
    await this.page.getByRole('button', { name: 'Mark as Current Status' }).click();
    await this.getToastMessage();
  }

  async openDetailsTab(): Promise<void> {
    await this.page.getByRole('tab', { name: 'Details' }).click();
  }

  async clickConvert(): Promise<void> {
    await this.waitForToastToClear();
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
