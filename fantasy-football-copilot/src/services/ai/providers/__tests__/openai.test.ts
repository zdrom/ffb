import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpenAIProvider } from '../openai';
import type { AIProviderConfig } from '../../../../types/ai';

describe('OpenAIProvider', () => {
  let provider: OpenAIProvider;
  let mockConfig: AIProviderConfig;
  let mockFetch: any;

  beforeEach(() => {
    provider = new OpenAIProvider();
    mockConfig = {
      apiKey: 'test-api-key-123',
      model: 'gpt-4o-mini',
      timeout: 15000
    };

    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('generateCompletion', () => {
    it('should make correct API call to OpenAI', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: '{"test": "response"}'
            }
          }]
        })
      };

      mockFetch.mockResolvedValue(mockResponse);

      const result = await provider.generateCompletion('test prompt', mockConfig);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-api-key-123'
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: 'You are a fantasy football draft assistant. You provide structured JSON responses only. Keep explanations to 35 words maximum.'
              },
              {
                role: 'user',
                content: 'test prompt'
              }
            ],
            temperature: 0.3,
            max_tokens: 2000
          }),
          signal: expect.any(AbortSignal)
        }
      );

      expect(result).toBe('{"test": "response"}');
    });

    it('should use custom baseURL when provided', async () => {
      const customConfig = {
        ...mockConfig,
        baseURL: 'https://custom.openai.com/v1'
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'response' } }] })
      });

      await provider.generateCompletion('test', customConfig);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://custom.openai.com/v1/chat/completions',
        expect.any(Object)
      );
    });

    it('should use custom model when provided', async () => {
      const customConfig = {
        ...mockConfig,
        model: 'gpt-4'
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'response' } }] })
      });

      await provider.generateCompletion('test', customConfig);

      const call = mockFetch.mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.model).toBe('gpt-4');
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized'
      });

      await expect(
        provider.generateCompletion('test', mockConfig)
      ).rejects.toThrow('OpenAI API error: 401 - Unauthorized');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(
        provider.generateCompletion('test', mockConfig)
      ).rejects.toThrow('Network error');
    });

    it('should handle empty response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [] })
      });

      const result = await provider.generateCompletion('test', mockConfig);
      expect(result).toBe('');
    });

    it('should handle missing message content', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{
            message: {}
          }]
        })
      });

      const result = await provider.generateCompletion('test', mockConfig);
      expect(result).toBe('');
    });

    it('should include timeout in request', async () => {
      const customConfig = {
        ...mockConfig,
        timeout: 5000
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'response' } }] })
      });

      await provider.generateCompletion('test', customConfig);

      const call = mockFetch.mock.calls[0];
      expect(call[1].signal).toBeDefined();
    });

    it('should use default timeout when not specified', async () => {
      const configWithoutTimeout = {
        apiKey: mockConfig.apiKey,
        model: mockConfig.model
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'response' } }] })
      });

      await provider.generateCompletion('test', configWithoutTimeout);

      const call = mockFetch.mock.calls[0];
      expect(call[1].signal).toBeDefined();
    });
  });

  describe('provider properties', () => {
    it('should have correct name', () => {
      expect(provider.name).toBe('openai');
    });
  });
});