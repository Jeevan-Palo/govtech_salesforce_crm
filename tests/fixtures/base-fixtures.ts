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
