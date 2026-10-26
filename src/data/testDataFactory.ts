import crypto from 'crypto';

export type LeadData = {
  firstName: string;
  lastName: string;
  company: string;
  email: string;
  phone: string;
  leadSource: string;
  title: string;
};

const FIRST_NAMES = ['Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Jamie', 'Avery', 'Cameron', 'Drew'];
const LAST_NAMES = ['Tan', 'Lim', 'Ng', 'Goh', 'Chua', 'Koh', 'Teo', 'Wong', 'Lee', 'Sim'];
const COMPANY_SUFFIXES = ['Holdings', 'Technologies', 'Solutions', 'Global', 'Industries', 'Ventures'];
const JOB_TITLES = ['IT Manager', 'Procurement Lead', 'Operations Director', 'Business Analyst', 'CTO'];
const LEAD_SOURCES = ['Web', 'Phone Inquiry', 'Partner Referral', 'Purchased List', 'Other'];

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function randomDigits(length: number): string {
  let digits = '';
  for (let i = 0; i < length; i++) digits += Math.floor(Math.random() * 10);
  return digits;
}

/** Generates unique-per-call Lead data so parallel workers never collide on name/email/company. */
export function createLeadData(overrides: Partial<LeadData> = {}): LeadData {
  const unique = crypto.randomBytes(4).toString('hex');
  const firstName = overrides.firstName ?? pick(FIRST_NAMES);
  const lastName = overrides.lastName ?? `${pick(LAST_NAMES)}-${unique}`;

  return {
    firstName,
    lastName,
    company: `${pick(LAST_NAMES)} ${pick(COMPANY_SUFFIXES)} ${unique}`,
    email: `${firstName}.${lastName}.${unique}@example-test.com`.toLowerCase(),
    phone: `+65${randomDigits(8)}`,
    leadSource: pick(LEAD_SOURCES),
    title: pick(JOB_TITLES),
    ...overrides,
  };
}
