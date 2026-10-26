import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { env } from '../config/env';
import { logger } from './logger';

const CODE_REGEX = /\b(\d{6})\b/;

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
          const message = await client.download(uid, undefined, { uid: true });
          if (!message.content) continue;
          const parsed = await simpleParser(message.content);
          const text = `${parsed.subject ?? ''} ${parsed.text ?? ''}`;
          const match = text.match(CODE_REGEX);
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
