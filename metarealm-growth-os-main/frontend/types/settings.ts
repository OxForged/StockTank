/** Settings domain — mirrors backend/app/schemas/settings.py. */

export interface SecretSetting {
  set: boolean;
  secret: true;
}
export interface ValueSetting {
  value: string;
  secret: false;
}
export type SettingEntry = SecretSetting | ValueSetting;

export interface SearchProviders {
  searxng: boolean;
  grok_x: boolean;
  perplexity: boolean;
  tavily: boolean;
}

export interface HunterBudget {
  keySet: boolean;
  month: string;
  usedThisMonth: number;
  monthlyLimit: number;
  remainingMonth: number;
  usedToday: number;
  remainingToday: number;
  dailyLimit: number;
  emailsPerCompanyPaid: number;
  companiesPerDayPaid: number;
  planHint: string;
}

export interface SettingsPayload {
  settings: Record<string, SettingEntry>;
  search: SearchProviders;
  hunter?: HunterBudget;
  agentNames: string[];
}

export interface PromptFile {
  name: string;
  content: string;
}
