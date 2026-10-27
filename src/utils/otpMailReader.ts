import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { env } from '../config/env';
import { logger } from './logger';

// Prefer a code anchored to "verification code" wording; fall back to a bare 6-digit match for
// orgs/locales that phrase the email differently.
const ANCHORED_CODE_REGEX = /verification code\D{0,40}(\d{6})\b/i;
const LOOSE_CODE_REGEX = /\b(\d{6})\b/;

// IMAP SEARCH SINCE only filters by calendar day, not time, so an older same-day code would
// otherwise match - allow a little clock-skew slack rather than requiring internalDate >= sentAfter exactly.
const CLOCK_SKEW_TOLERANCE_MS = 60_000;

/**
 * Polls an IMAP inbox for Salesforce's "Verify Your Identity" email and extracts the
 * 6-digit one-time code. See README "Handling Email Verification Code on Login" for the
 * security/practical tradeoffs of this approach vs. a disposable inbox service.
 */
export async function fetchLatestVerificationCode(sentAfter: Date): Promise<string> {
  if (!env.otp.imapHost || !env.otp.imapUser || !env.otp.imapPassword) {
    throw new Error('OTP_IMAP_* environment variables are not configured; cannot auto-read the verification code.');
  }

  const deadline = Date.now() + env.otp.pollTimeoutMs;
  const cutoff = sentAfter.getTime() - CLOCK_SKEW_TOLERANCE_MS;

  while (Date.now() < deadline) {
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
        const uids = await client.search({ since: sentAfter, from: 'salesforce.com' }, { uid: true });
        const sortedUids = (Array.isArray(uids) ? uids : []).sort((a, b) => b - a);
        for (const uid of sortedUids) {
          const message = await client.fetchOne(String(uid), { internalDate: true, source: true }, { uid: true });
          if (!message || !message.source) continue;

          // The server's own delivery timestamp - not the email's own Date: header, which a
          // sender's clock could misreport - so a stale code from earlier the same day is skipped
          // even though SINCE's day-level granularity let it through the server-side search.
          const internalDate = message.internalDate ? new Date(message.internalDate).getTime() : 0;
          if (internalDate < cutoff) continue;

          const parsed = await simpleParser(message.source);
          const text = `${parsed.subject ?? ''} ${parsed.text ?? ''}`;
          const match = text.match(ANCHORED_CODE_REGEX) ?? text.match(LOOSE_CODE_REGEX);
          if (match) {
            logger.info('Retrieved Salesforce verification code from inbox');
            return match[1];
          }
        }
      } finally {
        lock.release();
      }
    } finally {
      await client.logout().catch(() => client.close());
    }

    logger.info(`Verification email not found yet, retrying in ${env.otp.pollIntervalMs}ms`);
    await new Promise((resolve) => setTimeout(resolve, env.otp.pollIntervalMs));
  }

  throw new Error(`Timed out after ${env.otp.pollTimeoutMs}ms waiting for the Salesforce verification email`);
}
