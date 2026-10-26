const ID_15_REGEX = /^[a-zA-Z0-9]{15}$/;
const ID_18_REGEX = /^[a-zA-Z0-9]{18}$/;

/** Deterministic 15->18 char Salesforce Id conversion using the standard checksum-suffix algorithm. */
export function convertTo18(id: string): string {
  if (ID_18_REGEX.test(id)) return id;
  if (!ID_15_REGEX.test(id)) {
    throw new Error(`"${id}" is not a valid 15 or 18 character Salesforce Id`);
  }

  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ012345';
  let suffix = '';
  for (let block = 0; block < 3; block++) {
    let flags = 0;
    for (let i = 0; i < 5; i++) {
      const c = id[block * 5 + i];
      if (c >= 'A' && c <= 'Z') flags += 1 << i;
    }
    suffix += chars[flags];
  }
  return id + suffix;
}

export function isValidSalesforceId18(id: string): boolean {
  try {
    return ID_18_REGEX.test(convertTo18(id));
  } catch {
    return false;
  }
}

/** Extracts the record Id segment from a Lightning record URL, e.g. /lightning/r/Lead/00Q.../view */
export function extractRecordIdFromUrl(url: string): string {
  const match = url.match(/\/lightning\/r\/[^/]+\/([a-zA-Z0-9]{15,18})\//);
  if (!match) {
    throw new Error(`Could not extract a Salesforce record Id from URL: ${url}`);
  }
  return match[1];
}
