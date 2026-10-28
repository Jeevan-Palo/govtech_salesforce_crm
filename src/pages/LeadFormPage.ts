import { expect, Page } from '@playwright/test';
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

  // Required fields render their label with a leading "*" (e.g. "*Last Name"), so match it optionally.
  private byLabel(label: string) {
    return this.getDialog().getByLabel(new RegExp(`^\\*?${label}$`));
  }

  async openNewLeadForm(): Promise<void> {
    // Clicking the top-nav "Leads" link can stall well past a generous timeout if a lingering
    // toast/spinner from a prior action intercepts it (observed live: a 15s+ click timeout that
    // then resolves on its own shortly after) - navigate to the Leads list URL directly instead,
    // which sidesteps any overlay entirely rather than fighting it with a retried click.
    const leadsListUrl = new URL('/lightning/o/Lead/home', this.page.url()).toString();
    await this.page.goto(leadsListUrl);
    await this.waitForLightningReady();

    // Salesforce occasionally throws an uncaught LWC error ("Toast: please provide at least the
    // 'label' property to show the toast") while initializing the quick-create panel - likely a
    // platform-side duplicate-detection toast with a missing label - which crashes and unmounts
    // the whole "New Lead" modal within ~1s of it opening. Detect this and retry.
    const dialog = this.getDialog();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      // A prior save's confirmation toast can still be covering the "New" button long enough to
      // intercept this click (more so now that fillOnce() fills many more fields, so saves take
      // longer) - re-clear it on every attempt instead of assuming the earlier clear sufficed.
      await this.waitForToastToClear();
      const clicked = await this.page
        .getByRole('button', { name: 'New', exact: true })
        .click({ timeout: 15_000 })
        .then(() => true, () => false);
      if (!clicked) continue;
      const appeared = await dialog.waitFor({ state: 'visible', timeout: 15_000 }).then(
        () => true,
        () => false,
      );
      if (!appeared) continue;
      // Resolves as soon as the crash-and-unmount happens, instead of always blocking 1.5s.
      const crashed = await dialog.waitFor({ state: 'hidden', timeout: 1_500 }).then(
        () => true,
        () => false,
      );
      if (!crashed) return;
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
    const byLabel = (label: string) => this.byLabel(label);
    await this.selectCombobox('Salutation', lead.salutation);
    await byLabel('First Name').fill(lead.firstName);
    await byLabel('Last Name').fill(lead.lastName);
    await byLabel('Company').fill(lead.company);
    // Filling Company/Last Name with values matching an existing record can trigger an async
    // duplicate-rule check that re-renders the form, detaching elements mid-interaction; wait for
    // the committed value to settle rather than guessing how long that re-render takes.
    await expect(byLabel('Company')).toHaveValue(lead.company, { timeout: 10_000 });
    // That same duplicate-rule check can also pop the inline "Similar Records Exist" warning
    // (normally handled right before Save) this early - confirmed live, it renders directly on
    // top of the Rating field's dropdown listbox, silently blocking the option click below.
    await this.dismissInlineDuplicateWarning();
    await byLabel('Title').fill(lead.title);
    await byLabel('Email').fill(lead.email);
    await byLabel('Phone').fill(lead.phone);
    await byLabel('Mobile').fill(lead.mobile);
    await byLabel('Fax').fill(lead.fax);
    await byLabel('Website').fill(lead.website);
    await this.selectCombobox('Lead Source', lead.leadSource);
    await this.selectCombobox('Industry', lead.industry);
    await this.selectCombobox('Rating', lead.rating);
    await byLabel('Annual Revenue').fill(lead.annualRevenue);
    await byLabel('No. of Employees').fill(lead.numberOfEmployees);
    await byLabel('Street').fill(lead.street);
    await byLabel('City').fill(lead.city);
    await byLabel('Zip/Postal Code').fill(lead.zipPostalCode);
    await byLabel('Description').fill(lead.description);
  }

  /**
   * Salesforce's real-time duplicate check can show an inline "Similar Records Exist" warning
   * popover anchored directly above the dialog's action bar, overlapping and blocking clicks on
   * the Save button - dismiss it first if present rather than letting the click time out.
   */
  private async dismissInlineDuplicateWarning(): Promise<void> {
    const closeButton = this.page.getByRole('button', { name: 'Close error dialog' });
    if (await closeButton.isVisible().catch(() => false)) {
      await closeButton.click().catch(() => {});
    }
  }

  async save(): Promise<void> {
    const dialog = this.getDialog();
    const saveButton = dialog.getByRole('button', { name: 'Save', exact: true });
    await this.dismissInlineDuplicateWarning();
    await saveButton.click();

    // Salesforce's real-time duplicate check can pop a "Similar Records Exist" info dialog on the
    // first Save click without actually saving the Lead - a second Save click proceeds past it.
    // Distinguish this from a real validation-error block by waiting specifically for that dialog.
    const similarRecordsDialog = this.page.getByRole('dialog', { name: 'Similar Records Exist' }).first();
    const hasSimilarRecords = await similarRecordsDialog
      .waitFor({ state: 'visible', timeout: 3_000 })
      .then(() => true, () => false);
    if (hasSimilarRecords) {
      // While this warning is open, the whole underlying "New Lead" dialog (including its own
      // Save button) is hidden from the accessibility tree - confirmed live: dialog.isVisible()
      // and even a page-level "Save" button lookup both resolve to nothing while it's showing.
      // Close it via its own icon button first (an SVG <path> inside intercepts a plain click,
      // hence force: true) to restore access, then the real Save button becomes clickable again.
      // The warning can also auto-dismiss itself mid-click (observed: "element was detached from
      // the DOM, retrying"), so swallow a failed click here too - either way the dialog ends up
      // gone, and the explicit wait below confirms that before retrying Save.
      await similarRecordsDialog
        .getByRole('button', { name: 'Close error dialog' })
        .click({ force: true, timeout: 10_000 })
        .catch(() => {});
      await similarRecordsDialog.waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {});
      await saveButton.click({ timeout: 10_000 }).catch(() => {});
    }
    // Real save can take a few seconds; swallowed on timeout since the modal legitimately stays
    // open for validation-error negative-path tests.
    await dialog.waitFor({ state: 'hidden', timeout: 20_000 }).catch(() => {});
  }

  /**
   * Save exactly once and report the hard "Similar Records Exist" block dialog, without ever
   * clicking through it - unlike save(), which clicks through to let happy-path tests proceed.
   * Clicking through here would dismiss the dialog that IS the evidence a duplicate-rule test
   * is asserting on, and the Lead is correctly never created while this dialog is blocking.
   */
  async saveExpectingDuplicateBlock(): Promise<{ blocked: boolean; dialogText: string | null }> {
    const dialog = this.getDialog();
    await this.dismissInlineDuplicateWarning();
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();

    const similarRecordsDialog = this.page.getByRole('dialog', { name: 'Similar Records Exist' }).first();
    const blocked = await similarRecordsDialog
      .waitFor({ state: 'visible', timeout: 10_000 })
      .then(() => true, () => false);
    if (!blocked) {
      return { blocked: false, dialogText: null };
    }
    return { blocked: true, dialogText: await similarRecordsDialog.textContent() };
  }

  /**
   * Reads the invalid-field names straight from Salesforce's own inline validation-summary
   * popover ("We hit a snag." / "Review the following fields") - the actual accessible error
   * banner a screen-reader user would hear, not a CSS error class. Each listed field is a real
   * link (clicking it focuses that field), so this also proves this is the full set of fields
   * actually in error, not just that an error appeared somewhere on the page.
   */
  async getInvalidFieldNames(): Promise<string[]> {
    const banner = this.page.getByRole('dialog', { name: 'We hit a snag.' });
    await banner.waitFor({ state: 'visible', timeout: 10_000 });
    return banner.getByRole('link').allTextContents();
  }

  async getDuplicateWarningText(): Promise<string | null> {
    const banner = this.page.getByText(/possible duplicate/i).first();
    if (await banner.isVisible({ timeout: 5_000 }).catch(() => false)) {
      return banner.textContent();
    }
    return null;
  }
}
