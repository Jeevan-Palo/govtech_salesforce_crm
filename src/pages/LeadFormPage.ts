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
    await this.waitForToastToClear();
    await this.page.getByRole('link', { name: 'Leads' }).click();
    await this.waitForLightningReady();

    // Salesforce occasionally throws an uncaught LWC error ("Toast: please provide at least the
    // 'label' property to show the toast") while initializing the quick-create panel - likely a
    // platform-side duplicate-detection toast with a missing label - which crashes and unmounts
    // the whole "New Lead" modal within ~1s of it opening. Detect this and retry.
    const dialog = this.getDialog();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await this.page.getByRole('button', { name: 'New', exact: true }).click();
      const appeared = await dialog.waitFor({ state: 'visible', timeout: 15_000 }).then(
        () => true,
        () => false,
      );
      if (!appeared) continue;
      await this.page.waitForTimeout(1_500);
      if (await dialog.isVisible().catch(() => false)) {
        return;
      }
    }
    throw new Error('"New Lead" modal kept closing unexpectedly after multiple attempts.');
  }

  async fill(lead: LeadData): Promise<void> {
    try {
      await this.fillOnce(lead);
    } catch (error) {
      // The "New Lead" quick-create modal intermittently disappears mid-fill in this org
      // (observed to happen at an unpredictable point, unrelated to any specific field) with no
      // record actually saved. Re-open the form and retry once rather than failing the whole test.
      if (await this.getDialog().isVisible().catch(() => false)) {
        throw error;
      }
      await this.openNewLeadForm();
      await this.fillOnce(lead);
    }
  }

  private async fillOnce(lead: LeadData): Promise<void> {
    const dialog = this.getDialog();
    // Required fields render their label with a leading "*" (e.g. "*Last Name"), so match it optionally.
    const byLabel = (label: string) => dialog.getByLabel(new RegExp(`^\\*?${label}$`));
    await byLabel('First Name').fill(lead.firstName);
    await byLabel('Last Name').fill(lead.lastName);
    await byLabel('Company').fill(lead.company);
    // Filling Company/Last Name with values matching an existing record can trigger an async
    // duplicate-rule check that re-renders the form, detaching elements mid-interaction.
    await this.page.waitForTimeout(1_500);
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
