import { test, expect } from './fixtures/base-fixtures';

test.describe('Part B - Lead Creation & Management', () => {
  test('creates a new Lead and validates the generated 18-char Lead Id and saved data', async ({
    page,
    appLauncherPage,
    leadFormPage,
    leadDetailPage,
    uniqueLead,
  }) => {
    await appLauncherPage.openApp('Sales');
    await leadFormPage.openNewLeadForm();
    await leadFormPage.fill(uniqueLead);
    await leadFormPage.save();

    const leadId = await leadDetailPage.getLeadId18();
    expect(leadId).toMatch(/^[a-zA-Z0-9]{18}$/);

    await expect(page.getByText(`${uniqueLead.firstName} ${uniqueLead.lastName}`)).toBeVisible();
    expect(await leadDetailPage.getFieldValueByLabel('Company')).toContain(uniqueLead.company);
    expect(await leadDetailPage.getFieldValueByLabel('Email')).toContain(uniqueLead.email);
  });

  test('edits Lead status from Open - Not Contacted to Working - Contacted and validates the update', async ({
    appLauncherPage,
    leadFormPage,
    leadDetailPage,
    uniqueLead,
  }) => {
    await appLauncherPage.openApp('Sales');
    await leadFormPage.openNewLeadForm();
    await leadFormPage.fill(uniqueLead);
    await leadFormPage.save();

    await leadDetailPage.editStatus('Working - Contacted');
    await leadDetailPage.openDetailsTab();
    expect(await leadDetailPage.getFieldValueByLabel('Lead Status')).toContain('Working - Contacted');
  });
});
