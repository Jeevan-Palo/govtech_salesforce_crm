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

  /** Toasts (e.g. "Lead ... was created") can linger far longer than expected and intercept
   *  clicks on elements beneath them - proactively dismiss via the toast's close button rather
   *  than passively waiting, since they don't reliably auto-dismiss within a useful timeout. */
  async waitForToastToClear(): Promise<void> {
    const closeButton = this.page.locator('.slds-notify_toast button.toastClose, .slds-notify_toast button[title="Close"]');
    const count = await closeButton.count().catch(() => 0);
    for (let i = 0; i < count; i += 1) {
      await closeButton.first().click({ timeout: 2_000 }).catch(() => {});
    }
    await this.page
      .locator('div.toastMessage, span.toastMessage')
      .first()
      .waitFor({ state: 'hidden', timeout: 5_000 })
      .catch(() => {});
  }

  /** Lightning comboboxes render as a trigger button plus a listbox of role="option" items. */
  async selectCombobox(label: string, optionText: string): Promise<void> {
    try {
      await this.page.getByRole('combobox', { name: label }).click();
    } catch {
      // The form can re-render mid-interaction (e.g. an async duplicate-rule check), detaching
      // the trigger button; retry once against the freshly-rendered element.
      await this.page.getByRole('combobox', { name: label }).click();
    }
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

  /**
   * Reads a Lightning record-detail field's label+value text by its visible label.
   * Returns the whole field container's text (not just the value) since the rendered
   * value markup varies by field type (plain text, mailto/tel link, formatted number, etc.).
   */
  async getFieldValueByLabel(label: string): Promise<string> {
    const field = this.page
      .locator('records-record-layout-item, lightning-field, records-highlights-details-item')
      .filter({ has: this.page.getByText(label, { exact: true }) })
      .first();
    const text = await field.textContent();
    return text?.trim() ?? '';
  }
}
