import { Page } from '@playwright/test';

export class BasePage {
  constructor(protected readonly page: Page) {}

  /** Lightning record/list pages render progressively; wait for the spinner overlay to clear. */
  async waitForLightningReady(): Promise<void> {
    await this.page
      .locator('.slds-spinner_container')
      .first()
      .waitFor({ state: 'hidden', timeout: 30_000 })
      .catch(() => {});
  }

  async getToastMessage(): Promise<string> {
    const toast = this.page.locator('div.toastMessage, span.toastMessage').first();
    await toast.waitFor({ state: 'visible', timeout: 15_000 });
    return (await toast.textContent())?.trim() ?? '';
  }

  /** Lightning comboboxes render as a trigger button plus a listbox of role="option" items. */
  async selectCombobox(label: string, optionText: string): Promise<void> {
    await this.page.getByRole('combobox', { name: label }).click();
    await this.page.getByRole('option', { name: optionText, exact: false }).first().click();
  }

  /**
   * Account/Contact lookup fields render a typeahead listbox. Returns true if an existing
   * record was found and selected, false if the field was left to default to "New <object>".
   */
  async fillLookupAndSelect(label: string, searchText: string, exactOptionText?: string): Promise<boolean> {
    const input = this.page.getByRole('combobox', { name: label });
    await input.fill(searchText);
    const option = this.page.getByRole('option', { name: exactOptionText ?? searchText, exact: false }).first();
    try {
      await option.waitFor({ state: 'visible', timeout: 5_000 });
      await option.click();
      return true;
    } catch {
      return false;
    }
  }

  /** Reads a Lightning record-detail field's displayed value by its visible label. */
  async getFieldValueByLabel(label: string): Promise<string> {
    const field = this.page
      .locator('records-record-layout-item, lightning-field, records-highlights-details-item')
      .filter({ has: this.page.getByText(label, { exact: true }) })
      .first();
    const text = await field.locator('.slds-form-element__static, lightning-formatted-text').first().textContent();
    return text?.trim() ?? '';
  }
}
