import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const env = {
  baseURL: process.env.SF_BASE_URL ?? 'https://login.salesforce.com',
  username: process.env.SF_USERNAME ?? '',
  password: process.env.SF_PASSWORD ?? '',
  securityToken: process.env.SF_SECURITY_TOKEN ?? '',
  storageStatePath: process.env.STORAGE_STATE_PATH ?? 'playwright/.auth/user.json',
  otp: {
    enabled: (process.env.OTP_AUTOMATION_ENABLED ?? 'true') !== 'false',
    imapHost: process.env.OTP_IMAP_HOST ?? '',
    imapPort: Number(process.env.OTP_IMAP_PORT ?? 993),
    imapUser: process.env.OTP_IMAP_USER ?? '',
    imapPassword: process.env.OTP_IMAP_PASSWORD ?? '',
    pollTimeoutMs: Number(process.env.OTP_POLL_TIMEOUT_MS ?? 60_000),
    pollIntervalMs: Number(process.env.OTP_POLL_INTERVAL_MS ?? 3_000),
  },
};

/** Fails fast with a clear message instead of letting Salesforce reject a blank login. */
export function requireCredentials(): void {
  const missing = (['username', 'password'] as const).filter((key) => !env[key]);
  if (missing.length) {
    const names = missing.map((m) => `SF_${m.toUpperCase()}`).join(', ');
    throw new Error(`Missing Salesforce credentials in .env: ${names}. Copy .env.example to .env and fill it in.`);
  }
}
