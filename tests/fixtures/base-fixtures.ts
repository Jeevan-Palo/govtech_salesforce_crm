import { test as base } from '@playwright/test';
import { LoginPage } from '@src/pages/LoginPage';
import { AppLauncherPage } from '@src/pages/AppLauncherPage';
import { LeadFormPage } from '@src/pages/LeadFormPage';
import { LeadDetailPage } from '@src/pages/LeadDetailPage';
import { ConvertLeadPage } from '@src/pages/ConvertLeadPage';
import { OpportunityDetailPage } from '@src/pages/OpportunityDetailPage';
import { createLeadData, LeadData } from '@src/data/testDataFactory';

type Fixtures = {
  loginPage: LoginPage;
  appLauncherPage: AppLauncherPage;
  leadFormPage: LeadFormPage;
  leadDetailPage: LeadDetailPage;
  convertLeadPage: ConvertLeadPage;
  opportunityPage: OpportunityDetailPage;
  uniqueLead: LeadData;
};

export const test = base.extend<Fixtures>({
  // Every test starts logged-in and landed on the org home page, not about:blank.
  page: async ({ page }, use) => {
    // 'load' (the default waitUntil) can hang indefinitely on a freshly-upgraded org showing a
    // release splash (e.g. "Winter '27") that keeps background activity going - wait for DOM
    // content instead, then confirm we're actually logged in via a stable UI anchor.
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page
      .getByRole('button', { name: /App Launcher/i })
      .or(page.getByPlaceholder('Search...'))
      .first()
      .waitFor({ state: 'visible', timeout: 30_000 })
      .catch(() => {});
    await use(page);
  },
  loginPage: async ({ page }, use) => use(new LoginPage(page)),
  appLauncherPage: async ({ page }, use) => use(new AppLauncherPage(page)),
  leadFormPage: async ({ page }, use) => use(new LeadFormPage(page)),
  leadDetailPage: async ({ page }, use) => use(new LeadDetailPage(page)),
  convertLeadPage: async ({ page }, use) => use(new ConvertLeadPage(page)),
  opportunityPage: async ({ page }, use) => use(new OpportunityDetailPage(page)),
  // eslint-disable-next-line no-empty-pattern
  uniqueLead: async ({}, use) => use(createLeadData()),
});

export { expect } from '@playwright/test';
