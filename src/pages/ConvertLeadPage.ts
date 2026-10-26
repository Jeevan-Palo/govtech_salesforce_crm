import { Response } from '@playwright/test';
import { BasePage } from './BasePage';

export class ConvertLeadPage extends BasePage {
  /** Links to an existing Account by name if found; otherwise leaves "New Account" selected. Returns true if a new Account will be created. */
  async resolveAccount(companyName: string): Promise<boolean> {
    const linkedExisting = await this.fillLookupAndSelect('Account', companyName);
    return !linkedExisting;
  }

  /** Links to an existing Contact by full name if found; otherwise leaves "New Contact" selected. Returns true if a new Contact will be created. */
  async resolveContact(fullName: string): Promise<boolean> {
    const linkedExisting = await this.fillLookupAndSelect('Contact', fullName);
    return !linkedExisting;
  }

  /**
   * Clicks Convert and captures the underlying conversion network response.
   * NOTE: the URL/body matcher below is a starting point — confirm the exact
   * endpoint shape against your own org's Network tab (see NOTES.md) and adjust.
   */
  async convertAndCaptureResponse(): Promise<Record<string, unknown>> {
    const [response] = await Promise.all([
      this.page.waitForResponse(
        (res: Response) => /convert/i.test(res.url()) || /LeadConvert/i.test(res.url()),
        { timeout: 30_000 },
      ),
      this.page.getByRole('button', { name: 'Convert', exact: true }).click(),
    ]);
    await this.waitForLightningReady();

    try {
      return (await response.json()) as Record<string, unknown>;
    } catch {
      // Aura endpoints sometimes serve JSON with a text/plain content-type.
      return JSON.parse(await response.text()) as Record<string, unknown>;
    }
  }
}
