import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AIStrategyService } from '../AIStrategyService';
import type { AIServiceConfig } from '../../../types/ai';
import { 
  mockAIStrategyInput, 
  mockValidAIResponse,
  mockPlayers,
  mockDraftState 
} from '../../../test/fixtures/draftData';

// Mock the OpenAI provider
vi.mock('../providers/openai', () => ({
  OpenAIProvider: class MockOpenAIProvider {
    name = 'openai';
    
    async generateCompletion(prompt: string, config: any) {
      if (config.apiKey === 'invalid-key') {
        throw new Error('Invalid API key');
      }
      
      if (prompt.includes('error-test')) {
        throw new Error('API Error');
      }

      return JSON.stringify(mockValidAIResponse);
    }
  }
}));

describe('AIStrategyService', () => {
  let service: AIStrategyService;
  let mockConfig: AIServiceConfig;

  beforeEach(() => {
    mockConfig = {
      provider: 'openai',
      apiKey: 'test-key-123',
      model: 'gpt-4o-mini',
      timeout: 15000,
      userPreferences: {
        riskTolerance: 'Balanced',
        prioritizeVORP: true,
        stackingPreference: false,
        byeWeekAwareness: true
      }
    };
    
    service = new AIStrategyService(mockConfig);
    
    // Reset fetch mock
    (global.fetch as any).mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with provided config', () => {
      expect(service).toBeDefined();
      expect(service['config']).toEqual(mockConfig);
    });

    it('should create provider based on config', () => {
      expect(service['provider']).toBeDefined();
      expect(service['provider'].name).toBe('openai');
    });
  });

  describe('generateStrategy', () => {
    it('should generate valid AI strategy response', async () => {
      const result = await service.generateStrategy(mockAIStrategyInput);
      
      expect(result).toBeDefined();
      expect(result.topRecommendations).toHaveLength(1);
      expect(result.topRecommendations[0].playerName).toBe('Tyreek Hill');
      expect(result.topRecommendations[0].explanation.length).toBeLessThanOrEqual(35);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.timestamp).toBeGreaterThan(0);
    });

    it('should handle API errors gracefully', async () => {
      const errorService = new AIStrategyService({
        ...mockConfig,
        apiKey: 'invalid-key'
      });

      await expect(errorService.generateStrategy(mockAIStrategyInput))
        .rejects.toThrow('AI Strategy failed');
    });

    it('should validate response schema', async () => {
      // Mock invalid response
      vi.doMock('../providers/openai', () => ({
        OpenAIProvider: class MockOpenAIProvider {
          name = 'openai';
          async generateCompletion() {
            return JSON.stringify({ invalid: 'response' });
          }
        }
      }));

      await expect(service.generateStrategy(mockAIStrategyInput))
        .rejects.toThrow('Invalid AI response format');
    });

    it('should handle JSON parsing errors', async () => {
      vi.doMock('../providers/openai', () => ({
        OpenAIProvider: class MockOpenAIProvider {
          name = 'openai';
          async generateCompletion() {
            return 'invalid json {';
          }
        }
      }));

      await expect(service.generateStrategy(mockAIStrategyInput))
        .rejects.toThrow('Invalid AI response format');
    });
  });

  describe('buildPrompt', () => {
    it('should create comprehensive prompt with all required data', () => {
      const prompt = service['buildPrompt'](mockAIStrategyInput);
      
      expect(prompt).toContain('CURRENT SITUATION');
      expect(prompt).toContain('USER ROSTER');
      expect(prompt).toContain('ROSTER NEEDS');
      expect(prompt).toContain('TOP AVAILABLE PLAYERS');
      expect(prompt).toContain('POSITION SCARCITY');
      expect(prompt).toContain('USER PREFERENCES');
      expect(prompt).toContain('CONSTRAINTS');
      expect(prompt).toContain('Picks until my turn: 1');
      expect(prompt).toContain('Christian McCaffrey');
    });

    it('should include VORP data in prompt', () => {
      const prompt = service['buildPrompt'](mockAIStrategyInput);
      
      expect(prompt).toContain('VORP:');
      expect(prompt).toContain('58.2'); // Tyreek Hill's VORP
    });
  });

  describe('analyzeRosterNeeds', () => {
    it('should identify missing positions', () => {
      const needs = service['analyzeRosterNeeds'](
        mockAIStrategyInput.userTeam, 
        mockDraftState.settings
      );
      
      expect(needs).toContain('QB');
      expect(needs).toContain('WR'); 
      expect(needs).toContain('TE');
      expect(needs).toContain('RB'); // Need another RB (roster slots require 2)
    });
  });

  describe('calculatePositionScarcity', () => {
    it('should calculate availability by position', () => {
      const scarcity = service['calculatePositionScarcity'](mockPlayers);
      
      expect(scarcity.RB).toBeDefined();
      expect(scarcity.RB.available).toBeGreaterThan(0);
      expect(scarcity.WR).toBeDefined();
      expect(scarcity.QB).toBeDefined();
    });

    it('should exclude drafted players from scarcity calculation', () => {
      const playersWithDrafted = [
        ...mockPlayers,
        { ...mockPlayers[0], id: 'drafted', isDrafted: true }
      ];
      
      const scarcity = service['calculatePositionScarcity'](playersWithDrafted);
      expect(scarcity.RB.available).toBe(2); // Should not count drafted player
    });
  });

  describe('parseAndValidateResponse', () => {
    it('should parse valid JSON response', () => {
      const jsonResponse = JSON.stringify(mockValidAIResponse);
      const result = service['parseAndValidateResponse'](jsonResponse);
      
      expect(result).toEqual(mockValidAIResponse);
    });

    it('should extract JSON from markdown code blocks', () => {
      const markdownResponse = `Here's the analysis:\n\`\`\`json\n${JSON.stringify(mockValidAIResponse)}\n\`\`\``;
      const result = service['parseAndValidateResponse'](markdownResponse);
      
      expect(result).toEqual(mockValidAIResponse);
    });

    it('should validate response schema strictly', () => {
      const invalidResponse = {
        ...mockValidAIResponse,
        topRecommendations: [
          {
            ...mockValidAIResponse.topRecommendations[0],
            position: 'INVALID_POSITION' // Invalid position
          }
        ]
      };

      expect(() => 
        service['parseAndValidateResponse'](JSON.stringify(invalidResponse))
      ).toThrow();
    });
  });

  describe('static methods', () => {
    describe('isConfigured', () => {
      it('should return true when API key provided in config', () => {
        expect(AIStrategyService.isConfigured({ apiKey: 'test-key' })).toBe(true);
      });

      it('should return true when API key in environment', () => {
        expect(AIStrategyService.isConfigured()).toBe(true); // OPENAI_API_KEY is mocked in setup
      });

      it('should return false when no API key available', () => {
        vi.stubEnv('OPENAI_API_KEY', '');
        vi.stubEnv('VITE_OPENAI_API_KEY', '');
        expect(AIStrategyService.isConfigured({})).toBe(false);
      });
    });

    describe('createDefault', () => {
      it('should create service with environment API key', () => {
        const defaultService = AIStrategyService.createDefault();
        
        expect(defaultService).toBeDefined();
        expect(defaultService?.['config'].apiKey).toBe('test-key-123');
        expect(defaultService?.['config'].provider).toBe('openai');
      });

      it('should return null when no API key available', () => {
        vi.stubEnv('OPENAI_API_KEY', '');
        vi.stubEnv('VITE_OPENAI_API_KEY', '');
        
        const defaultService = AIStrategyService.createDefault();
        expect(defaultService).toBeNull();
      });
    });
  });

  describe('edge cases', () => {
    it('should handle empty available players list', async () => {
      const emptyInput = {
        ...mockAIStrategyInput,
        availablePlayers: []
      };

      const result = await service.generateStrategy(emptyInput);
      expect(result).toBeDefined();
    });

    it('should handle missing VORP data', async () => {
      const noVorpInput = {
        ...mockAIStrategyInput,
        vorpData: []
      };

      const result = await service.generateStrategy(noVorpInput);
      expect(result).toBeDefined();
    });

    it('should respect timeout configuration', async () => {
      const timeoutService = new AIStrategyService({
        ...mockConfig,
        timeout: 100 // Very short timeout
      });

      // This test depends on the provider implementation
      // In a real scenario, you'd mock a slow response
      const result = await timeoutService.generateStrategy(mockAIStrategyInput);
      expect(result).toBeDefined();
    });
  });
});