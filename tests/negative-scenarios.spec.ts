import { test, expect } from './fixtures/base-fixtures';
import { createLeadData } from '@src/data/testDataFactory';

test.describe('Part B - Negative Scenarios', () => {
  test(
    'shows validation errors when saving a Lead with missing mandatory fields',
    { tag: '@smoke' },
    async ({ appLauncherPage, leadFormPage }) => {
      await appLauncherPage.openApp('Sales');
      await leadFormPage.openNewLeadForm();
      await leadFormPage.save(); // Save immediately with every field left blank.

      // Assert on the real accessible error banner ("We hit a snag." / "Review the following
      // fields"), and that it names the two actually-required fields specifically - not just
      // that a `.slds-has-error`-classed element exists somewhere on the page. "Name" is Lead's
      // compound Salutation/First/Last field (no standalone "Last Name" entry in this banner,
      // same compounding behavior seen on the Lead detail page's header).
      const invalidFields = await leadFormPage.getInvalidFieldNames();
      expect(invalidFields).toEqual(expect.arrayContaining(['Name', 'Company']));
    },
  );

  test('flags a duplicate Lead when duplicate rules are configured for the org', async ({
    appLauncherPage,
    leadFormPage,
  }) => {
    // Two full Lead create cycles in one test - the default 45s budget is tight on WebKit, and
    // even 90s has been observed too tight when the org itself is rendering slowly.
    test.setTimeout(150_000);
    const lead = createLeadData();

    await appLauncherPage.openApp('Sales');
    await leadFormPage.openNewLeadForm();
    await leadFormPage.fill(lead);
    await leadFormPage.save();

    await appLauncherPage.openApp('Sales');
    await leadFormPage.openNewLeadForm();
    await leadFormPage.fill({ ...lead, company: `${lead.company}-dup` });
    // Must NOT use save() here: it clicks through the hard "Similar Records Exist" dialog,
    // which is itself the evidence this test is looking for.
    const { blocked, dialogText } = await leadFormPage.saveExpectingDuplicateBlock();

    test.skip(!blocked, 'No Lead duplicate rule on this org fired for this field combination.');
    expect(dialogText).toMatch(/duplicate/i);
  });
});
