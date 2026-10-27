import { expect, Response } from '@playwright/test';
import { BasePage } from './BasePage';

export class ConvertLeadPage extends BasePage {
  private getDialog() {
    return this.page.getByRole('dialog', { name: 'Convert Lead' });
  }

  private getGroup(name: 'Account' | 'Contact') {
    return this.getDialog().getByRole('group', { name, exact: true });
  }

  /**
   * The Convert Lead modal's Account panel is a radio choice ("Create New Account" / "Choose
   * Existing Account") plus an "Account Search" lookup combobox. Typing opens a typeahead
   * listbox with an actual record `option` (its accessible name is exactly the Account name) if
   * one matches - this is the real signal of an existing match. The separate "X Account
   * Matches"/"Duplicate records list" panel is a standard-Duplicate-Rule feature that is NOT
   * configured in this org (observed to always read "0 Account Matches", even when a genuine
   * match exists and is shown in the typeahead), so it is not used for detection.
   *
   * The typeahead is backed by Salesforce's SOSL search index, which can lag well behind
   * just-created records (observed: still un-indexed after 90+ seconds). Pass `expectMatch: true`
   * (when the caller has reason to believe the Account should already be indexed, e.g. it's hours
   * old) to retry the search for up to `maxWaitMs` instead of giving up after a single pass.
   */
  async resolveAccount(
    companyName: string,
    options: { expectMatch?: boolean; maxWaitMs?: number } = {},
  ): Promise<boolean> {
    const { expectMatch = false, maxWaitMs = 90_000 } = options;
    const group = this.getGroup('Account');
    await this.waitForToastToClear();
    // The radio input itself is visually hidden behind its styled label, which intercepts
    // pointer clicks - click the label text instead of calling .check() on the input.
    await group.getByText('Choose Existing Account', { exact: true }).click();
    const searchBox = group.getByRole('combobox', { name: 'Account Search' });
    // Exact match distinguishes the real record option from the always-present
    // "Search for matching accounts '<name>' in Account" suggestion, whose accessible name
    // merely contains the company name as a quoted substring.
    const matchOption = group.getByRole('option', { name: companyName, exact: true });

    const checkForMatch = async (): Promise<boolean> => {
      await searchBox.fill('');
      await searchBox.fill(companyName);
      return matchOption.first().isVisible({ timeout: 10_000 }).catch(() => false);
    };

    let hasMatch: boolean;
    if (expectMatch) {
      hasMatch = await expect
        .poll(checkForMatch, { timeout: maxWaitMs, intervals: [3_000] })
        .toBe(true)
        .then(() => true, () => false);
    } else {
      hasMatch = await checkForMatch();
    }

    if (hasMatch) {
      await matchOption.first().click();
      return false;
    }
    await group.getByText('Create New Account', { exact: true }).click();
    return true;
  }

  /**
   * The Contact panel has no manual search box - Salesforce auto-detects matches against the
   * Lead's name/email and reports "X Contact Matches detected". Selects the first match if one
   * is found, otherwise leaves "Create New Contact" selected. Returns true if a new Contact will
   * be created.
   */
  async resolveContact(fullName: string): Promise<boolean> {
    const group = this.getGroup('Contact');
    const matchStatus = group.getByText(/^\d+ Contact Matches? detected/i).first();
    const matchStatusText = (await matchStatus.textContent().catch(() => null))?.trim() ?? '0 Contact Matches detected';
    const hasMatch = !/^0 Contact Matches/i.test(matchStatusText);
    if (hasMatch) {
      await group.getByText('Choose Existing Contact', { exact: true }).click();
      const match = group.getByRole('link', { name: fullName, exact: false }).first();
      if (await match.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await match.click();
      }
      return false;
    }
    return true;
  }

  /**
   * Clicking Convert replaces the modal's content in place with a "Your lead has been converted"
   * confirmation screen - it does NOT auto-navigate to the new Opportunity. Record IDs are read
   * directly off that screen's record links (keyed by their stable 3-char Id prefix: 001=Account,
   * 003=Contact, 006=Opportunity) as the primary signal, since it's independent of the Aura
   * payload's shape. The underlying conversion call is a Lightning/Aura action - it POSTs to
   * `/aura?...ui-lead-runtime-components-controllers.LeadConvertDesktop.convertLeadServer=1` and
   * replies with `{"actions":[{"returnValue":{accountId,contactId,opportunityId,isPersonAccount,
   * hasError}}]}` (captured from this org, see NOTES.md Part B) - `leadConvertResult` below is
   * that `returnValue` object, parsed out for the API-bonus assertions.
   */
  async convertAndCaptureResponse(): Promise<Record<string, unknown>> {
    const convertButton = this.getDialog().getByRole('button', { name: 'Convert', exact: true });
    await expect(convertButton).toBeEnabled({ timeout: 20_000 });

    const responsePromise = this.page
      .waitForResponse((res: Response) => /convertLeadServer/i.test(res.url()), { timeout: 10_000 })
      .catch(() => null);

    await convertButton.click();
    const confirmation = this.page
      .getByRole('dialog')
      .filter({ has: this.page.getByRole('heading', { name: 'Your lead has been converted' }) });
    // Observed to occasionally run right up against (and past) 45s on this org - the Convert
    // action creates Account+Contact+Opportunity synchronously server-side, so it's the heaviest
    // single action in this suite; give it more headroom than a typical Lightning render wait.
    await confirmation.getByRole('heading', { name: 'Your lead has been converted' }).waitFor({
      state: 'visible',
      timeout: 60_000,
    });
    // The confirmation cards (Account/Contact/Opportunity links) render asynchronously after the heading.
    await confirmation
      .getByRole('link')
      .first()
      .waitFor({ state: 'visible', timeout: 15_000 })
      .catch(() => {});

    const response = await responsePromise;
    let rawNetworkPayload: Record<string, unknown> | null = null;
    if (response) {
      try {
        rawNetworkPayload = (await response.json()) as Record<string, unknown>;
      } catch {
        try {
          rawNetworkPayload = JSON.parse(await response.text()) as Record<string, unknown>;
        } catch {
          rawNetworkPayload = null;
        }
      }
    }
    const actions = rawNetworkPayload?.actions as { returnValue?: Record<string, unknown> }[] | undefined;
    const leadConvertResult = actions?.[0]?.returnValue ?? null;

    const ids = await this.waitForConvertedIds();
    return {
      success: true,
      accountId: ids.accountId,
      contactId: ids.contactId,
      opportunityId: ids.opportunityId,
      ...(rawNetworkPayload ? { rawNetworkPayload } : {}),
      ...(leadConvertResult ? { leadConvertResult } : {}),
    };
  }

  private async extractConvertedIds(): Promise<{ accountId?: string; contactId?: string; opportunityId?: string }> {
    const confirmation = this.page
      .getByRole('dialog')
      .filter({ has: this.page.getByRole('heading', { name: 'Your lead has been converted' }) });
    const hrefs = await confirmation.getByRole('link').evaluateAll((anchors) =>
      anchors.map((a) => a.getAttribute('href') ?? ''),
    );
    const findId = (prefix: string) => {
      for (const href of hrefs) {
        const match = href.match(/\/lightning\/r\/([a-zA-Z0-9]{15,18})\/view/);
        if (match && match[1].startsWith(prefix)) return match[1];
      }
      return undefined;
    };
    return { accountId: findId('001'), contactId: findId('003'), opportunityId: findId('006') };
  }

  /** The confirmation cards render progressively, so poll briefly until the Opportunity link (if any) shows up. */
  private async waitForConvertedIds(): Promise<{ accountId?: string; contactId?: string; opportunityId?: string }> {
    let ids: { accountId?: string; contactId?: string; opportunityId?: string } = {};
    await expect
      .poll(
        async () => {
          ids = await this.extractConvertedIds();
          return Boolean(ids.opportunityId);
        },
        { timeout: 10_000, intervals: [500] },
      )
      .toBe(true)
      .catch(() => {});
    return ids;
  }

  /** Navigates from the "Your lead has been converted" confirmation screen to the new Opportunity. */
  async goToConvertedOpportunity(): Promise<void> {
    const confirmation = this.page
      .getByRole('dialog')
      .filter({ has: this.page.getByRole('heading', { name: 'Your lead has been converted' }) });
    const links = confirmation.getByRole('link');
    const count = await links.count();
    for (let i = 0; i < count; i += 1) {
      const href = await links.nth(i).getAttribute('href');
      if (href && /\/lightning\/r\/006[a-zA-Z0-9]{15}\/view/.test(href)) {
        await links.nth(i).click();
        await this.page.waitForURL(/\/lightning\/r\/(?:Opportunity\/)?[a-zA-Z0-9]{15,18}\/view/);
        await this.waitForLightningReady();
        return;
      }
    }
    throw new Error('Could not find the Opportunity link on the lead conversion confirmation screen.');
  }

  /** Dismisses the "Your lead has been converted" confirmation screen without navigating away. */
  async closeConversionConfirmation(): Promise<void> {
    await this.page.getByRole('button', { name: 'Cancel and close' }).click();
  }
}

