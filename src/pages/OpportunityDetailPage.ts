import { expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class OpportunityDetailPage extends BasePage {
  async assertOwner(expectedOwner: string): Promise<void> {
    expect(await this.getFieldValueByLabel('Opportunity Owner')).toContain(expectedOwner);
  }

  async assertStage(expectedStage: string): Promise<void> {
    // Stage is driven by the Lightning Path component (listbox "Path Options" of option stages),
    // same as Lead Status - not a plain highlights-panel field.
    const selectedOption = this.page.getByRole('listbox', { name: 'Path Options' }).getByRole('option', { selected: true });
    await expect(selectedOption).toHaveText(new RegExp(expectedStage, 'i'));
  }
}
