import { test, expect } from './fixtures/base-fixtures';
import { createLeadData } from '@src/data/testDataFactory';
import * as fs from 'fs';
import * as path from 'path';

const DUPLICATE_MATCH_STATE_FILE = path.join(__dirname, '..', '.test-state', 'duplicate-match.json');
// Fixed (not randomized) identity reused across test runs - see note below on why. Email is also
// fixed, since Contact duplicate-detection matches on name+email and a per-run random email would
// never match the Contact created by an earlier (bootstrap) run.
const DUPLICATE_MATCH_IDENTITY = {
  company: 'QA Automation DupMatch Co',
  firstName: 'QaAutomation',
  lastName: 'DupMatchContact',
  email: 'qaautomation.dupmatchcontact@example-test.com',
};

function readDuplicateMatchState(): { accountId: string } | null {
  try {
    return JSON.parse(fs.readFileSync(DUPLICATE_MATCH_STATE_FILE, 'utf-8'));
  } catch {
    return null;
  }
}

function writeDuplicateMatchState(state: { accountId: string }): void {
  fs.mkdirSync(path.dirname(DUPLICATE_MATCH_STATE_FILE), { recursive: true });
  fs.writeFileSync(DUPLICATE_MATCH_STATE_FILE, JSON.stringify(state, null, 2));
}


test.describe('Part B - Lead to Opportunity Conversion', () => {
  test('creates a new Account and Contact when neither exists, and converts to an Opportunity', async ({
    appLauncherPage,
    leadFormPage,
    leadDetailPage,
    convertLeadPage,
    opportunityPage,
    uniqueLead,
  }) => {
    await appLauncherPage.openApp('Sales');
    await leadFormPage.openNewLeadForm();
    await leadFormPage.fill(uniqueLead);
    await leadFormPage.save();

    await leadDetailPage.clickConvert();
    const willCreateAccount = await convertLeadPage.resolveAccount(uniqueLead.company);
    const willCreateContact = await convertLeadPage.resolveContact(`${uniqueLead.firstName} ${uniqueLead.lastName}`);
    expect(willCreateAccount).toBe(true);
    expect(willCreateContact).toBe(true);

    const conversionResponse = await convertLeadPage.convertAndCaptureResponse();
    // Bonus (Part B API validation): assert on the real Lightning/Aura `convertLeadServer`
    // response shape captured from this org (see NOTES.md) - a Database.LeadConvertResult-like
    // object with accountId/contactId/opportunityId/hasError/isPersonAccount fields.
    const leadConvertResult = (conversionResponse as Record<string, unknown>).leadConvertResult as
      | Record<string, unknown>
      | undefined;
    expect(leadConvertResult?.hasError).toBe(false);
    expect(String(leadConvertResult?.opportunityId ?? '')).toMatch(/^006[a-zA-Z0-9]{15}$/);
    expect(conversionResponse).toHaveProperty('success', true);
    expect(String((conversionResponse as Record<string, unknown>).opportunityId ?? '')).toMatch(
      /^006[a-zA-Z0-9]{15}$/,
    );

    await convertLeadPage.goToConvertedOpportunity();
    await opportunityPage.assertStage('Prospecting');
  });

  test('links to the existing Account and Contact when a matching one already exists', async ({
    appLauncherPage,
    leadFormPage,
    leadDetailPage,
    convertLeadPage,
  }) => {
    test.setTimeout(120_000);
    // NOTE on test design: Salesforce's "Account Search"/"Contact Matches" duplicate-detection in
    // the Convert Lead dialog is backed by an asynchronous search index that can lag well beyond
    // any practical in-test wait (observed to still be un-indexed 90+ seconds, and likely up to
    // ~15 minutes, after the record is created - a documented Salesforce platform behavior, not a
    // bug in this suite). Creating the "existing" Account/Contact fresh within the same test run
    // can therefore never reliably exercise the match path. Instead, this test reuses a FIXED
    // (non-randomized) Lead identity across runs, persisted to a local state file: the first-ever
    // run seeds the Account/Contact (and is expected to hit the "create new" path, since nothing
    // can be indexed yet), and every subsequent run - once enough wall-clock time has passed
    // since that first run - should find and link to the now-indexed existing record.
    const priorState = readDuplicateMatchState();
    const lead = createLeadData(DUPLICATE_MATCH_IDENTITY);

    await appLauncherPage.openApp('Sales');
    await leadFormPage.openNewLeadForm();
    await leadFormPage.fill(lead);
    await leadFormPage.save();
    await leadDetailPage.clickConvert();
    const willCreateAccount = await convertLeadPage.resolveAccount(lead.company, { expectMatch: Boolean(priorState) });
    const willCreateContact = await convertLeadPage.resolveContact(`${lead.firstName} ${lead.lastName}`);
    const conversionResponse = await convertLeadPage.convertAndCaptureResponse();
    const accountId = String((conversionResponse as Record<string, unknown>).accountId ?? '');
    expect(accountId).toMatch(/^001[a-zA-Z0-9]{15}$/);

    writeDuplicateMatchState({ accountId });

    if (priorState) {
      expect(willCreateAccount).toBe(false);
      expect(willCreateContact).toBe(false);
      expect(accountId).toBe(priorState.accountId);
    } else {
      console.log(
        '[lead-conversion] Bootstrap run: seeded the duplicate-match fixture for the first time. ' +
          'Re-run this test after Salesforce\'s search index catches up (minutes to ~15+) to ' +
          'validate the "links to existing Account/Contact" path.',
      );
    }
  });
});
