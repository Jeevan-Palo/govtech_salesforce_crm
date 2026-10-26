import { Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { LeadData } from '../data/testDataFactory';

export class LeadFormPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  /** Scoped to avoid matching the unrelated hidden popover dialogs (deal-risk-insights, etc.) also on the page. */
  private getDialog() {
    return this.page.getByRole('dialog', { name: 'New Lead' });
  }

  async openNewLeadForm(): Promise<void> {
    await this.page.getByRole('link', { name: 'Leads' }).click();
    await this.waitForLightningReady();
    await this.page.getByRole('button', { name: 'New', exact: true }).click();
    await this.getDialog().waitFor({ state: 'visible' });
  }

  async fill(lead: LeadData): Promise<void> {
    const dialog = this.getDialog();
    // Required fields render their label with a leading "*" (e.g. "*Last Name"), so match it optionally.
    const byLabel = (label: string) => dialog.getByLabel(new RegExp(`^\\*?${label}$`));
    await byLabel('First Name').fill(lead.firstName);
    await byLabel('Last Name').fill(lead.lastName);
    await byLabel('Company').fill(lead.company);
    await byLabel('Email').fill(lead.email);
    await byLabel('Phone').fill(lead.phone);
    await byLabel('Title').fill(lead.title);
    await this.selectCombobox('Lead Source', lead.leadSource);
  }

  async save(): Promise<void> {
    await this.getDialog().getByRole('button', { name: 'Save', exact: true }).click();
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
