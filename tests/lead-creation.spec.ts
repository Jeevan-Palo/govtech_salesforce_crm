import { test, expect } from './fixtures/base-fixtures';

test.describe('Part B - Lead Creation & Management', () => {
  test(
    'creates a new Lead and validates the generated 18-char Lead Id and saved data',
    { tag: '@smoke' },
    async ({
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

    // Assert on the actual generated Id's own shape - not convertTo18()'s output, which is a
    // no-op pass-through for already-18-char ids (as this org's Lightning URLs always are) and
    // so could never fail this check.
    const rawLeadId = await leadDetailPage.getRawLeadId();
    expect(rawLeadId).toHaveLength(18);
    expect(rawLeadId).toMatch(/^00Q/);

    // Scoped to the record header's name field - a plain getByText() match also hits the
    // save-confirmation toast (which repeats the full name) and is a strict-mode violation.
    const nameHeader = page.locator('lightning-formatted-name', { hasText: uniqueLead.lastName });
    await expect(nameHeader).toBeVisible();
    expect(await nameHeader.textContent()).toContain(uniqueLead.salutation);

    // The default landing tab only renders a compact subset of fields (e.g. Company/Email/Phone);
    // less-common fields like Fax/Industry/Address only mount once the Details tab is active.
    await leadDetailPage.openDetailsTab();

    // Covers every field actually filled by leadFormPage.fill(), not just a handful.
    expect(await leadDetailPage.getFieldValueByLabel('Company')).toContain(uniqueLead.company);
    expect(await leadDetailPage.getFieldValueByLabel('Title')).toContain(uniqueLead.title);
    expect(await leadDetailPage.getFieldValueByLabel('Email')).toContain(uniqueLead.email);
    expect(await leadDetailPage.getFieldValueByLabel('Phone')).toContain(uniqueLead.phone);
    expect(await leadDetailPage.getFieldValueByLabel('Mobile')).toContain(uniqueLead.mobile);
    expect(await leadDetailPage.getFieldValueByLabel('Fax')).toContain(uniqueLead.fax);
    expect(await leadDetailPage.getFieldValueByLabel('Website')).toContain(uniqueLead.website);
    expect(await leadDetailPage.getFieldValueByLabel('Lead Source')).toContain(uniqueLead.leadSource);
    expect(await leadDetailPage.getFieldValueByLabel('Industry')).toContain(uniqueLead.industry);
    expect(await leadDetailPage.getFieldValueByLabel('Rating')).toContain(uniqueLead.rating);
    expect(await leadDetailPage.getFieldValueByLabel('Description')).toContain(uniqueLead.description);

    // Lightning renders these with currency/thousands formatting (e.g. "$500,000"), so compare
    // on digits only rather than the raw input string.
    const annualRevenueText = await leadDetailPage.getFieldValueByLabel('Annual Revenue');
    expect(annualRevenueText.replace(/\D/g, '')).toContain(uniqueLead.annualRevenue);
    const employeesText = await leadDetailPage.getFieldValueByLabel('No. of Employees');
    expect(employeesText.replace(/\D/g, '')).toContain(uniqueLead.numberOfEmployees);

    // Street/City/Zip render together under a single compound "Address" field.
    const addressText = await leadDetailPage.getFieldValueByLabel('Address');
    expect(addressText).toContain(uniqueLead.street);
    expect(addressText).toContain(uniqueLead.city);
    expect(addressText).toContain(uniqueLead.zipPostalCode);
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

    await test.step(
      'Part C.a - drive the Lead Status Path (shadow DOM / dynamic Lightning component, see NOTES.md)',
      async () => {
        await leadDetailPage.editStatus('Working - Contacted');
        await leadDetailPage.openDetailsTab();
        // The Details tab's "Lead Status" field can briefly still reflect the pre-save value
        // (observed on WebKit, where the save round-trip to re-render this field lags behind the
        // Path's own "current status" UI update) - poll instead of reading once.
        await expect
          .poll(() => leadDetailPage.getFieldValueByLabel('Lead Status'), { timeout: 20_000 })
          .toContain('Working - Contacted');
      },
    );
  });
});
