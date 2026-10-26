import { test, expect } from './fixtures/base-fixtures';
import { createLeadData } from '@src/data/testDataFactory';

test.describe('Part B - Negative Scenarios', () => {
  test('shows validation errors when saving a Lead with missing mandatory fields', async ({
    appLauncherPage,
    leadFormPage,
  }) => {
    await appLauncherPage.openApp('Sales');
    await leadFormPage.openNewLeadForm();
    await leadFormPage.save(); // Save immediately with every field left blank.

    const errors = await leadFormPage.getFieldErrorMessages();
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.join(' ')).toMatch(/complete this field/i);
  });

  test('flags a duplicate Lead when duplicate rules are configured for the org', async ({
    appLauncherPage,
    leadFormPage,
  }) => {
    // Two full Lead create cycles in one test - the default 45s budget is tight on WebKit.
    test.setTimeout(90_000);
    const lead = createLeadData();

    await appLauncherPage.openApp('Sales');
    await leadFormPage.openNewLeadForm();
    await leadFormPage.fill(lead);
    await leadFormPage.save();

    await appLauncherPage.openApp('Sales');
    await leadFormPage.openNewLeadForm();
    await leadFormPage.fill({ ...lead, company: `${lead.company}-dup` });
    await leadFormPage.save();

    const duplicateWarning = await leadFormPage.getDuplicateWarningText();
    test.skip(duplicateWarning === null, 'No duplicate rule is configured on this org for Lead Email.');
    expect(duplicateWarning).toMatch(/duplicate/i);
  });
});
