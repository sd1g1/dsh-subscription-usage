import type { Context } from '@deepseek-ai/cordis';

export interface Config {
  cacheMs?: number;
  timeoutMs?: number;
  openaiCodexCredentialRef?: string;
  openaiCodexUsageUrl?: string;
  opencodeGoCredentialRef?: string;
  opencodeGoUsageUrl?: string;
}

export declare const name = "subscription-usage";
export declare const inject: string[];
export declare function apply(ctx: Context, config?: Config): void;
