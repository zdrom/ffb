import type { AIProvider } from '../../../types/ai';
import { OpenAIProvider } from './openai';

export const AI_PROVIDERS = {
  openai: OpenAIProvider
} as const;

export function createAIProvider(providerName: keyof typeof AI_PROVIDERS): AIProvider {
  const ProviderClass = AI_PROVIDERS[providerName];
  return new ProviderClass();
}

export * from './openai';