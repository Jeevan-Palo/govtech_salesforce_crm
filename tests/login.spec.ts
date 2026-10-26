import { test, expect } from './fixtures/base-fixtures';

test.describe('Part A - Salesforce Login', () => {
  test('validates successful login via global search / App Launcher', async ({ page, loginPage }) => {
    await page.goto('/');
    await loginPage.assertLoggedIn();
  });
});
