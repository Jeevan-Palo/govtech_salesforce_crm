import crypto from 'crypto';

export type LeadData = {
  salutation: string;
  firstName: string;
  lastName: string;
  company: string;
  title: string;
  email: string;
  phone: string;
  mobile: string;
  fax: string;
  website: string;
  leadSource: string;
  industry: string;
  rating: string;
  annualRevenue: string;
  numberOfEmployees: string;
  street: string;
  city: string;
  zipPostalCode: string;
  description: string;
};

const SALUTATIONS = ['Mr.', 'Ms.', 'Mrs.', 'Dr.', 'Prof.'];
const FIRST_NAMES = ['Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Jamie', 'Avery', 'Cameron', 'Drew'];
const LAST_NAMES = ['Tan', 'Lim', 'Ng', 'Goh', 'Chua', 'Koh', 'Teo', 'Wong', 'Lee', 'Sim'];
const COMPANY_SUFFIXES = ['Holdings', 'Technologies', 'Solutions', 'Global', 'Industries', 'Ventures'];
const JOB_TITLES = ['IT Manager', 'Procurement Lead', 'Operations Director', 'Business Analyst', 'CTO'];
const LEAD_SOURCES = ['Web', 'Phone Inquiry', 'Partner Referral', 'Purchased List', 'Other'];
// Chosen to avoid substring collisions with each other (and with the rest of the standard
// Industry picklist, e.g. "Technology" is a substring of "Biotechnology") since selectCombobox()
// matches option text non-exactly.
const INDUSTRIES = ['Banking', 'Retail', 'Healthcare', 'Manufacturing', 'Construction', 'Education', 'Insurance', 'Hospitality'];
const RATINGS = ['Hot', 'Warm', 'Cold'];
const STREETS = ['1 Example Street', '22 Market Street', '8 Marina Boulevard', '15 Orchard Road'];

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function randomDigits(length: number): string {
  // First digit must be non-zero - Lightning Number fields (Annual Revenue, No. of Employees)
  // strip a leading zero on save/display, which would otherwise break substring assertions
  // against the originally-generated string on an unlucky ~1-in-10 run.
  let digits = String(Math.floor(Math.random() * 9) + 1);
  for (let i = 1; i < length; i++) digits += Math.floor(Math.random() * 10);
  return digits;
}

/** Generates unique-per-call Lead data so parallel workers never collide on name/email/company. */
export function createLeadData(overrides: Partial<LeadData> = {}): LeadData {
  const unique = crypto.randomBytes(4).toString('hex');
  const firstName = overrides.firstName ?? pick(FIRST_NAMES);
  const lastName = overrides.lastName ?? `${pick(LAST_NAMES)}-${unique}`;

  return {
    salutation: pick(SALUTATIONS),
    firstName,
    lastName,
    company: `${pick(LAST_NAMES)} ${pick(COMPANY_SUFFIXES)} ${unique}`,
    title: pick(JOB_TITLES),
    email: `${firstName}.${lastName}.${unique}@example-test.com`.toLowerCase(),
    phone: `+65${randomDigits(8)}`,
    mobile: `+65${randomDigits(8)}`,
    fax: `+65${randomDigits(8)}`,
    website: `https://${unique}.example-test.com`,
    leadSource: pick(LEAD_SOURCES),
    industry: pick(INDUSTRIES),
    rating: pick(RATINGS),
    annualRevenue: randomDigits(7),
    numberOfEmployees: randomDigits(4),
    street: pick(STREETS),
    city: 'Singapore',
    zipPostalCode: randomDigits(6),
    description: `Automated test Lead (ref ${unique}) - generated for end-to-end CRM validation.`,
    ...overrides,
  };
}

