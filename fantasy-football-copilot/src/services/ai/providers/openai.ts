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
            content: 'You are a fantasy draft assistant. Reply with VALID JSON ONLY that matches the provided schema. No code fences or explanations.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_tokens: 1400
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