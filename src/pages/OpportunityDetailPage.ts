import { expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class OpportunityDetailPage extends BasePage {
  async assertOwner(expectedOwner: string): Promise<void> {
    expect(await this.getFieldValueByLabel('Opportunity Owner')).toContain(expectedOwner);
  }

  async assertStage(expectedStage: string): Promise<void> {
    expect(await this.getFieldValueByLabel('Stage')).toContain(expectedStage);
  }
}
