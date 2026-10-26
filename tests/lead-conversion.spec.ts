import { test, expect } from './fixtures/base-fixtures';
import { createLeadData } from '@src/data/testDataFactory';

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
    // Bonus (Part B API validation): asserting on the Database.LeadConvertResult shape -
    // confirm field names against the actual payload captured from your own org (see NOTES.md).
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
    const seedLead = createLeadData();

    await appLauncherPage.openApp('Sales');
    await leadFormPage.openNewLeadForm();
    await leadFormPage.fill(seedLead);
    await leadFormPage.save();
    await leadDetailPage.clickConvert();
    await convertLeadPage.resolveAccount(seedLead.company);
    await convertLeadPage.resolveContact(`${seedLead.firstName} ${seedLead.lastName}`);
    const firstConversion = await convertLeadPage.convertAndCaptureResponse();
    const existingAccountId = (firstConversion as Record<string, unknown>).accountId;

    // Second Lead reuses the same Company/First/Last so the convert step should find matches.
    const secondLead = createLeadData({
      company: seedLead.company,
      firstName: seedLead.firstName,
      lastName: seedLead.lastName,
    });
    await appLauncherPage.openApp('Sales');
    await leadFormPage.openNewLeadForm();
    await leadFormPage.fill(secondLead);
    await leadFormPage.save();
    await leadDetailPage.clickConvert();
    const willCreateAccount = await convertLeadPage.resolveAccount(secondLead.company);
    const willCreateContact = await convertLeadPage.resolveContact(`${secondLead.firstName} ${secondLead.lastName}`);
    expect(willCreateAccount).toBe(false);
    expect(willCreateContact).toBe(false);

    const secondConversion = await convertLeadPage.convertAndCaptureResponse();
    expect((secondConversion as Record<string, unknown>).accountId).toBe(existingAccountId);
  });
});
