import { env } from '../config/env';

type Session = { sessionId: string; instanceUrl: string };

let loginAttempted = false;
let cachedSession: Session | null = null;

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Plain SOAP username+password(+token) login - no Connected App required, unlike OAuth flows. */
async function login(): Promise<Session> {
  const envelope =
    '<?xml version="1.0" encoding="utf-8"?>' +
    '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:urn="urn:partner.soap.sforce.com">' +
    '<soapenv:Body><urn:login>' +
    `<urn:username>${escapeXml(env.username)}</urn:username>` +
    `<urn:password>${escapeXml(env.password + env.securityToken)}</urn:password>` +
    '</urn:login></soapenv:Body></soapenv:Envelope>';

  const response = await fetch(`${env.baseURL.replace(/\/+$/, '')}/services/Soap/u/60.0`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: 'login' },
    body: envelope,
  });
  const body = await response.text();
  const sessionId = body.match(/<sessionId>([^<]+)<\/sessionId>/)?.[1];
  const serverUrl = body.match(/<serverUrl>([^<]+)<\/serverUrl>/)?.[1];
  if (!sessionId || !serverUrl) {
    const faultMessage = body.match(/<faultstring>([^<]+)<\/faultstring>/)?.[1];
    throw new Error(faultMessage ?? `Unexpected SOAP login response: ${body.slice(0, 300)}`);
  }
  return { sessionId, instanceUrl: new URL(serverUrl).origin };
}

async function getSession(): Promise<Session | null> {
  if (loginAttempted) return cachedSession;
  loginAttempted = true;
  try {
    cachedSession = await login();
  } catch (error) {
    console.warn(
      `[salesforceApi] SOAP login failed (likely missing SF_SECURITY_TOKEN or an untrusted CI IP) - ` +
        `falling back to local test-state heuristics: ${(error as Error).message}`,
    );
    cachedSession = null;
  }
  return cachedSession;
}

/**
 * Looks up a record by exact Name via direct SOQL. Unlike the Convert Lead modal's own "Account
 * Search" (SOSL-backed, can lag 90s+ behind a just-created record - see ConvertLeadPage), a SOQL
 * query against the table is immediately consistent, so this is ground truth for whether a fixed
 * test fixture record already exists in the org - independent of any local, gitignored state file
 * that can't survive a fresh clone or a CI checkout.
 *
 * Returns:
 * - a Salesforce Id: the record exists.
 * - null: confirmed the record does NOT exist (a real "not found" from the org).
 * - undefined: couldn't check (no SF_SECURITY_TOKEN configured / untrusted IP) - callers should
 *   fall back to their own local-state heuristic rather than treating this as "not found".
 */
export async function findRecordIdByName(sobject: 'Account' | 'Contact', name: string): Promise<string | null | undefined> {
  const session = await getSession();
  if (!session) return undefined;

  try {
    const soql = `SELECT Id FROM ${sobject} WHERE Name = '${name.replace(/'/g, "\\'")}' LIMIT 1`;
    const response = await fetch(`${session.instanceUrl}/services/data/v60.0/query?q=${encodeURIComponent(soql)}`, {
      headers: { Authorization: `Bearer ${session.sessionId}` },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    const result = (await response.json()) as { records: { Id: string }[] };
    return result.records[0]?.Id ?? null;
  } catch (error) {
    console.warn(`[salesforceApi] Query for ${sobject} "${name}" failed: ${(error as Error).message}`);
    return undefined;
  }
}
