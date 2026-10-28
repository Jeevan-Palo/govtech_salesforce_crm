import { test, expect } from '@playwright/test';
import { test as pomTest, expect as pomExpect } from '../fixtures/base-fixtures';
import { ImapFlow } from 'imapflow';
import { env } from '@src/config/env';

// One-off connectivity check for the Gmail App Password/IMAP settings in .env - confirms the
// credentials/host/port actually authenticate before trusting the real auth.setup.ts OTP flow
// with them. Not part of the real suite: delete this file once the check passes.
// Already validated - skip by default so it doesn't run as part of every report.
test.skip('OTP mailbox IMAP connection authenticates and opens INBOX', async () => {
  expect(env.otp.imapHost, 'OTP_IMAP_HOST is not set').toBeTruthy();
  expect(env.otp.imapUser, 'OTP_IMAP_USER is not set').toBeTruthy();
  expect(env.otp.imapPassword, 'OTP_IMAP_PASSWORD is not set').toBeTruthy();

  const client = new ImapFlow({
    host: env.otp.imapHost,
    port: env.otp.imapPort,
    secure: true,
    auth: { user: env.otp.imapUser, pass: env.otp.imapPassword },
    logger: false,
  });

  await client.connect();
  try {
    const lock = await client.getMailboxLock('INBOX');
    try {
      const status = await client.status('INBOX', { messages: true });
      if (!status) throw new Error('IMAP STATUS command returned no result');
      console.log(`Connected OK. INBOX message count: ${status.messages}`);
      expect(status.messages).toBeGreaterThanOrEqual(0);
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => client.close());
  }
});

// Extends the above IMAP check with a real Lead creation, reusing the same fixtures/page
// objects as the real suite - confirms the session from the OTP login actually works end to end.
pomTest('creates a Lead after the OTP-IMAP login succeeds', async ({ appLauncherPage, leadFormPage, leadDetailPage, uniqueLead }) => {
  await appLauncherPage.openApp('Sales');
  await leadFormPage.openNewLeadForm();
  await leadFormPage.fill(uniqueLead);
  await leadFormPage.save();

  const rawLeadId = await leadDetailPage.getRawLeadId();
  pomExpect(rawLeadId).toHaveLength(18);
  pomExpect(rawLeadId).toMatch(/^00Q/);
});

