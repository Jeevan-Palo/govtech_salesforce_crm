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

  /** Raw, un-converted Id segment straight out of the URL - used to assert the actual generated
   *  Id's own shape (18 chars, "00Q" Lead prefix) instead of a converter's output, since
   *  convertTo18() is a no-op pass-through for already-18-char ids and can't meaningfully fail. */
  async getRawLeadId(): Promise<string> {
    await this.page.waitForURL(/\/lightning\/r\/(?:Lead\/)?[a-zA-Z0-9]{15,18}\/view/);
    return extractRecordIdFromUrl(this.page.url());
  }

  /**
   * Lead Status is driven by the Lightning "Path" component: a `listbox "Path Options"` of
   * `option`s plus a "Mark as Current Status" confirm button - not a simple inline-edit field.
   * See NOTES.md (Part C.a) for why role-based locators are used here instead of CSS/data-*
   * selectors against this component's dynamically-regenerated markup.
   */
  async editStatus(newStatus: string): Promise<void> {
    // On WebKit the post-save toast can sit over the Path component long enough to intercept
    // clicks on its options before it naturally clears.
    await this.waitForToastToClear();
    await this.page.getByRole('option', { name: newStatus, exact: true }).click();
    await this.page.getByRole('button', { name: 'Mark as Current Status' }).click();
    // Best-effort confirmation only - its return value is unused and, on WebKit, this toast can
    // fail to render in time at all. The actual state change is verified by the caller polling
    // the Details tab field afterward, so a missing toast here must not fail the whole action.
    await this.getToastMessage().catch(() => '');
  }

  async openDetailsTab(): Promise<void> {
    await this.page.getByRole('tab', { name: 'Details' }).click();
  }

  async clickConvert(): Promise<void> {
    await this.waitForToastToClear();
    const convertButton = this.page.getByRole('button', { name: 'Convert', exact: true });
    const moreActionsButton = this.page.getByRole('button', { name: 'Show more actions' });
    // Whether Convert sits directly on the ribbon or is tucked under the overflow menu depends on
    // the page layout, but EITHER can also simply not be rendered yet (the ribbon loads
    // asynchronously) - a single immediate isVisible() check races against that render and can
    // wrongly conclude "must be the overflow case" before either button exists, then time out
    // waiting for the wrong one. Wait for whichever one actually appears first instead.
    await convertButton.or(moreActionsButton).first().waitFor({ state: 'visible', timeout: 30_000 });
    if (await convertButton.isVisible().catch(() => false)) {
      await convertButton.click();
    } else {
      await moreActionsButton.click();
      await this.page.getByRole('menuitem', { name: 'Convert' }).click();
    }
    await this.waitForLightningReady();
  }
}
