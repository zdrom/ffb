import type { AIProvider, AIProviderConfig } from '../../../types/ai';

export class OpenAIProvider implements AIProvider {
  name = 'openai';

  async generateCompletion(prompt: string, config: AIProviderConfig): Promise<string> {
    const baseURL = config.baseURL || 'https://api.openai.com/v1';
    const model = config.model || 'gpt-4o-mini';
    
    const response = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: 'You are a fantasy football draft assistant. You provide structured JSON responses only. Keep explanations to 35 words maximum.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 2000
      }),
      signal: AbortSignal.timeout(config.timeout || 15000)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  }
}