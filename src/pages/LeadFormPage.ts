import { Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { LeadData } from '../data/testDataFactory';

export class LeadFormPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async openNewLeadForm(): Promise<void> {
    await this.page.getByRole('link', { name: 'Leads' }).click();
    await this.waitForLightningReady();
    await this.page.getByRole('button', { name: 'New' }).click();
    await this.page.getByRole('dialog').waitFor({ state: 'visible' });
  }

  async fill(lead: LeadData): Promise<void> {
    const dialog = this.page.getByRole('dialog');
    await dialog.getByLabel('First Name').fill(lead.firstName);
    await dialog.getByLabel('Last Name', { exact: true }).fill(lead.lastName);
    await dialog.getByLabel('Company', { exact: true }).fill(lead.company);
    await dialog.getByLabel('Email', { exact: true }).fill(lead.email);
    await dialog.getByLabel('Phone', { exact: true }).fill(lead.phone);
    await dialog.getByLabel('Title', { exact: true }).fill(lead.title);
    await this.selectCombobox('Lead Source', lead.leadSource);
  }

  async save(): Promise<void> {
    await this.page.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click();
  }

  async getFieldErrorMessages(): Promise<string[]> {
    const errors = this.page.locator('.slds-has-error .slds-form-element__help');
    await errors
      .first()
      .waitFor({ state: 'visible', timeout: 10_000 })
      .catch(() => {});
    return errors.allTextContents();
  }

  async getDuplicateWarningText(): Promise<string | null> {
    const banner = this.page.getByText(/possible duplicate/i).first();
    if (await banner.isVisible({ timeout: 5_000 }).catch(() => false)) {
      return banner.textContent();
    }
    return null;
  }
}
