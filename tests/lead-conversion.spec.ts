import { test, expect } from './fixtures/base-fixtures';
import { createLeadData } from '@src/data/testDataFactory';
import { findRecordIdByName } from '@src/utils/salesforceApi';
import * as fs from 'fs';
import * as path from 'path';

const STATE_DIR = path.join(__dirname, '..', '.test-state');

function readState(file: string): Record<string, string> | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(STATE_DIR, file), 'utf-8'));
  } catch {
    return null;
  }
}

function writeState(file: string, state: Record<string, string>): void {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(path.join(STATE_DIR, file), JSON.stringify(state, null, 2));
}

/**
 * Resolves whether a fixed-identity fixture record already exists, preferring the live org
 * (immediately consistent SOQL, works on a fresh clone/CI with no local state - see
 * src/utils/salesforceApi.ts) and only falling back to a local, project-scoped, gitignored
 * state file when the org isn't reachable that way (no SF_SECURITY_TOKEN configured). Each
 * Playwright project gets its own state file/key so Chromium and WebKit never share - let alone
 * race on writing - the same file or the same fixed-identity Account/Contact.
 */
async function resolveExistingId(
  sobject: 'Account' | 'Contact',
  name: string,
  stateFile: string,
  stateKey: string,
): Promise<string | null> {
  const fromApi = await findRecordIdByName(sobject, name);
  if (fromApi !== undefined) return fromApi;
  return readState(stateFile)?.[stateKey] ?? null;
}

test.describe('Part B - Lead to Opportunity Conversion', () => {
  test(
    'creates a new Account and Contact when neither exists, and converts to an Opportunity',
    { tag: '@smoke' },
    async (
      { appLauncherPage, leadFormPage, leadDetailPage, convertLeadPage, opportunityPage, uniqueLead, page },
      testInfo,
    ) => {
      // The extra owner/Account-name/Contact-linkage verification below (on top of the original
      // create+convert flow) comfortably exceeds the default 45s budget.
      test.setTimeout(120_000);
      let leadOwnerName = '';

      await test.step('Create and save the Lead', async () => {
        await appLauncherPage.openApp('Sales');
        await leadFormPage.openNewLeadForm();
        await leadFormPage.fill(uniqueLead);
        await leadFormPage.save();

        // Captured before conversion: Lead Owner carries over to the new Opportunity by default,
        // so this is the one "expected owner" value that's true on any org/user without
        // hardcoding one. getFieldValueByLabel returns the whole field container's text (label +
        // value + inline action links), so strip the label prefix rather than the field's own
        // label text.
        await leadDetailPage.openDetailsTab();
        leadOwnerName = (await leadDetailPage.getFieldValueByLabel('Lead Owner')).replace(/^Lead Owner/, '');
      });

      await test.step('Resolve Account/Contact duplicate matches', async () => {
        await leadDetailPage.clickConvert();
        const willCreateAccount = await convertLeadPage.resolveAccount(uniqueLead.company);
        const willCreateContact = await convertLeadPage.resolveContact(
          `${uniqueLead.firstName} ${uniqueLead.lastName}`,
        );
        expect(willCreateAccount).toBe(true);
        expect(willCreateContact).toBe(true);
      });

      const conversionResponse = await test.step('Convert the Lead and capture the API response', async () => {
        const response = await convertLeadPage.convertAndCaptureResponse();
        // Attach the raw payload so a failing assertion below is immediately explainable from the
        // HTML report, without re-running the test under trace viewer.
        await testInfo.attach('convert-lead-api-response', {
          body: JSON.stringify(response, null, 2),
          contentType: 'application/json',
        });
        return response;
      });

      const { contactId, opportunityId } = await test.step('Assert on the API response shape', async () => {
        // Bonus (Part B API validation): assert on the real Lightning/Aura `convertLeadServer`
        // response shape captured from this org (see NOTES.md) - a Database.LeadConvertResult-like
        // object with accountId/contactId/opportunityId/hasError/isPersonAccount fields.
        const leadConvertResult = (conversionResponse as Record<string, unknown>).leadConvertResult as
          | Record<string, unknown>
          | undefined;
        expect(leadConvertResult?.hasError).toBe(false);
        expect(String(leadConvertResult?.opportunityId ?? '')).toMatch(/^006[a-zA-Z0-9]{15}$/);
        expect(conversionResponse).toHaveProperty('success', true);
        const ids = conversionResponse as { contactId: string; opportunityId: string };
        expect(ids.opportunityId).toMatch(/^006[a-zA-Z0-9]{15}$/);
        expect(ids.contactId).toMatch(/^003[a-zA-Z0-9]{15}$/);

        // The Aura envelope's own action-level status, separate from the returnValue payload itself.
        const rawNetworkPayload = (conversionResponse as Record<string, unknown>).rawNetworkPayload as
          | { actions?: { state?: string }[] }
          | undefined;
        expect(rawNetworkPayload?.actions?.[0]?.state).toBe('SUCCESS');
        return ids;
      });

      await test.step('Verify the converted Opportunity', async () => {
        await convertLeadPage.goToConvertedOpportunity();
        // Confirms the Id the API reported is the same record the UI actually navigated to.
        expect(await opportunityPage.getOpportunityId()).toBe(opportunityId);
        await opportunityPage.assertStage('Prospecting');
        await opportunityPage.assertOwner(leadOwnerName);
        // Confirms conversion linked THIS Lead's Account, not just that "an" Account exists.
        await opportunityPage.assertAccountName(uniqueLead.company);
      });

      await test.step('Verify the converted Contact', async () => {
        // Opportunity has no plain "Contact" field - the converted Contact is linked via
        // OpportunityContactRole instead - so verify the Contact record itself is the right one.
        await page.goto(`/lightning/r/Contact/${contactId}/view`);
        await expect(
          page.getByRole('heading', { level: 1, name: `${uniqueLead.firstName} ${uniqueLead.lastName}` }),
        ).toBeVisible();
      });
    },
  );

  test('links to the existing Account (and creates a new Contact) when a matching Account already exists', async ({
    appLauncherPage,
    leadFormPage,
    leadDetailPage,
    convertLeadPage,
  }, testInfo) => {
    test.setTimeout(120_000);
    // NOTE on test design: Salesforce's "Account Search" duplicate-detection in the Convert Lead
    // dialog is backed by an asynchronous search index that can lag well beyond any practical
    // in-test wait (observed to still be un-indexed 90+ seconds, and likely up to ~15 minutes,
    // after the record is created - a documented Salesforce platform behavior, not a bug in this
    // suite). Creating the "existing" Account fresh within the same test run can therefore never
    // reliably exercise the match path. Instead, this test reuses a FIXED Company name across
    // runs - distinct per Playwright project so Chromium and WebKit never contend for the same
    // Account - and checks whether it already exists via the live org first (see
    // resolveExistingId), not via local state alone, so this also behaves correctly on a fresh
    // clone or in CI once SF_SECURITY_TOKEN is configured there.
    // First/Last name and email stay randomized per run, so this also exercises the
    // "Account exists, Contact doesn't" branch of the convert logic.
    const company = `QA Automation DupMatch Co (${testInfo.project.name})`;
    const stateFile = `duplicate-match.${testInfo.project.name}.json`;
    const existingAccountId = await resolveExistingId('Account', company, stateFile, 'accountId');
    const lead = createLeadData({ company });

    await test.step('Create and save the Lead', async () => {
      await appLauncherPage.openApp('Sales');
      await leadFormPage.openNewLeadForm();
      await leadFormPage.fill(lead);
      await leadFormPage.save();
    });

    const { willCreateAccount, willCreateContact } = await test.step(
      'Resolve Account/Contact duplicate matches',
      async () => {
        await leadDetailPage.clickConvert();
        const account = await convertLeadPage.resolveAccount(company, { expectMatch: Boolean(existingAccountId) });
        const contact = await convertLeadPage.resolveContact(`${lead.firstName} ${lead.lastName}`);
        return { willCreateAccount: account, willCreateContact: contact };
      },
    );
    // We expected the fixture Account to already be indexed but it wasn't - bail out now rather
    // than proceeding to Convert, which would silently create a genuine duplicate Account
    // (observed live on this org) instead of just needing a later retry.
    test.skip(
      Boolean(existingAccountId) && willCreateAccount,
      "Account search index hasn't caught up to the fixture yet - re-run later instead of creating a duplicate.",
    );
    const conversionResponse = await test.step('Convert the Lead and capture the API response', async () => {
      const response = await convertLeadPage.convertAndCaptureResponse();
      await testInfo.attach('convert-lead-api-response', {
        body: JSON.stringify(response, null, 2),
        contentType: 'application/json',
      });
      return response;
    });
    const accountId = String((conversionResponse as Record<string, unknown>).accountId ?? '');
    expect(accountId).toMatch(/^001[a-zA-Z0-9]{15}$/);

    writeState(stateFile, { accountId });

    if (existingAccountId) {
      expect(willCreateAccount).toBe(false);
      expect(accountId).toBe(existingAccountId);
      // Name/email are randomized per run, so the Contact genuinely won't exist yet - this run
      // exercises "Account exists -> link; Contact doesn't -> create" rather than both existing.
      expect(willCreateContact).toBe(true);
    } else {
      console.log(
        '[lead-conversion] Bootstrap run: seeded the duplicate-match fixture for the first time. ' +
          'Re-run this test after Salesforce\'s search index catches up (minutes to ~15+) to ' +
          'validate the "links to existing Account" path.',
      );
    }
  });

  test('links to both an existing Account and an existing Contact when both already exist', async ({
    appLauncherPage,
    leadFormPage,
    leadDetailPage,
    convertLeadPage,
  }, testInfo) => {
    // Account and Contact matches are polled sequentially (resolveAccount then resolveContact),
    // each able to retry up to 90s for SOSL index lag, plus up to 60s for the post-Convert
    // confirmation screen - the worst case comfortably exceeds a 120s budget.
    test.setTimeout(300_000);
    // Mirrors the existing-Account-only test above, but fixes BOTH company and full name across
    // runs (only email is randomized) so that, once indexed, Salesforce resolves an existing
    // match for the Account AND the Contact in the same conversion - the one branch the other two
    // conversion tests don't reach. Varying only email avoids this org's hard, un-bypassable
    // "Similar Records Exist" Lead-level duplicate block, which fires on an exact
    // company+first+last+email match (see LeadFormPage.saveExpectingDuplicateBlock and
    // negative-scenarios.spec.ts).
    //
    // IMPORTANT: Chromium's and WebKit's identities below share NO words with each other, NOR
    // with any word from testDataFactory.ts's LAST_NAMES/COMPANY_MIDDLES/COMPANY_SUFFIXES pools
    // (used to randomly generate every OTHER test's company name). This org's standard Account
    // duplicate rule fuzzy-matches on Name tokens and discounts short/parenthetical suffixes as
    // noise (see testDataFactory.ts's own comment on this) - confirmed via trace, twice, that
    // picking words from those shared pools (even just 2 of 3) eventually collides with some
    // other randomly-generated test Lead's company name and gets "Create New Account" rejected
    // outright with a server-side force:recordDuplicateDetected error (not just a client-side
    // warning). Made-up, uncommon words sidestep this unconditionally.
    const identityByProject: Record<string, { company: string; lastName: string }> = {
      chromium: { company: 'Thistlemoor Quarrybrook Mercantile', lastName: 'Okonkwo' },
      webkit: { company: 'Larkspur Fenwick Atelier', lastName: 'Villanueva' },
    };
    const identity = identityByProject[testInfo.project.name] ?? {
      company: `Fallback Fixture Co ${testInfo.project.name}`,
      lastName: `Fallback${testInfo.project.name}`,
    };
    const company = identity.company;
    const firstName = 'Taylor';
    const lastName = identity.lastName;
    const fullName = `${firstName} ${lastName}`;
    const stateFile = `both-exist-match5.${testInfo.project.name}.json`;
    const [existingAccountId, existingContactId] = await Promise.all([
      resolveExistingId('Account', company, stateFile, 'accountId'),
      resolveExistingId('Contact', fullName, stateFile, 'contactId'),
    ]);
    const lead = createLeadData({ company, firstName, lastName });

    await test.step('Create and save the Lead', async () => {
      await appLauncherPage.openApp('Sales');
      await leadFormPage.openNewLeadForm();
      await leadFormPage.fill(lead);
      await leadFormPage.save();
    });

    const { willCreateAccount, willCreateContact } = await test.step(
      'Resolve Account/Contact duplicate matches',
      async () => {
        await leadDetailPage.clickConvert();
        const account = await convertLeadPage.resolveAccount(company, { expectMatch: Boolean(existingAccountId) });
        const contact = await convertLeadPage.resolveContact(fullName, { expectMatch: Boolean(existingContactId) });
        return { willCreateAccount: account, willCreateContact: contact };
      },
    );
    // Same rationale as the existing-Account-only test above: don't let a too-early re-run fall
    // through to Create New and mint a genuine duplicate Account/Contact just because the search
    // index hasn't caught up yet.
    test.skip(
      (Boolean(existingAccountId) && willCreateAccount) || (Boolean(existingContactId) && willCreateContact),
      "Search index hasn't caught up to the fixture yet - re-run later instead of creating a duplicate.",
    );
    const conversionResponse = await test.step('Convert the Lead and capture the API response', async () => {
      const response = await convertLeadPage.convertAndCaptureResponse();
      await testInfo.attach('convert-lead-api-response', {
        body: JSON.stringify(response, null, 2),
        contentType: 'application/json',
      });
      return response;
    });
    const accountId = String((conversionResponse as Record<string, unknown>).accountId ?? '');
    const contactId = String((conversionResponse as Record<string, unknown>).contactId ?? '');
    expect(accountId).toMatch(/^001[a-zA-Z0-9]{15}$/);
    expect(contactId).toMatch(/^003[a-zA-Z0-9]{15}$/);

    writeState(stateFile, { accountId, contactId });

    if (existingAccountId && existingContactId) {
      expect(willCreateAccount).toBe(false);
      expect(willCreateContact).toBe(false);
      expect(accountId).toBe(existingAccountId);
      expect(contactId).toBe(existingContactId);
    } else {
      console.log(
        '[lead-conversion] Bootstrap run: seeded the both-exist fixture for the first time. ' +
          'Re-run this test after Salesforce\'s search index catches up to validate the ' +
          '"both Account and Contact already exist" path.',
      );
    }
  });
});
