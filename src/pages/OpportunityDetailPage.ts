import { expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { extractRecordIdFromUrl } from '../utils/salesforceId';

export class OpportunityDetailPage extends BasePage {
  /** Raw Id straight out of the record URL - used to cross-check against the conversion API response. */
  async getOpportunityId(): Promise<string> {
    await this.page.waitForURL(/\/lightning\/r\/(?:Opportunity\/)?[a-zA-Z0-9]{15,18}\/view/);
    return extractRecordIdFromUrl(this.page.url());
  }

  async assertOwner(expectedOwner: string): Promise<void> {
    expect(await this.getFieldValueByLabel('Opportunity Owner')).toContain(expectedOwner);
  }

  /** Confirms conversion linked the Opportunity to the correct Account, not just "an" Account. */
  async assertAccountName(expectedAccountName: string): Promise<void> {
    expect(await this.getFieldValueByLabel('Account Name')).toContain(expectedAccountName);
  }

  async assertStage(expectedStage: string): Promise<void> {
    // Stage is driven by the Lightning Path component (listbox "Path Options" of option stages),
    // same as Lead Status - not a plain highlights-panel field.
    const selectedOption = this.page.getByRole('listbox', { name: 'Path Options' }).getByRole('option', { selected: true });
    await expect(selectedOption).toHaveText(new RegExp(expectedStage, 'i'));
  }
}
