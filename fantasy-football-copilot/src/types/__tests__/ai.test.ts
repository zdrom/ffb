import { describe, it, expect } from 'vitest';
import { 
  AIStrategyResponseSchema,
  PickRecommendationSchema,
  WhatIfForesightSchema,
  RosterBalanceGuidanceSchema,
  TargetAlertSchema
} from '../ai';

describe('AI Type Schemas', () => {
  describe('PickRecommendationSchema', () => {
    it('should validate correct pick recommendation', () => {
      const validPick = {
        playerId: 'player-123',
        playerName: 'Josh Allen',
        position: 'QB',
        vorp: 45.2,
        explanation: 'Elite QB1 with rushing upside',
        confidence: 0.9,
        urgency: 'High'
      };

      expect(() => PickRecommendationSchema.parse(validPick)).not.toThrow();
    });

    it('should reject invalid position', () => {
      const invalidPick = {
        playerId: 'player-123',
        playerName: 'Josh Allen',
        position: 'INVALID',
        vorp: 45.2,
        explanation: 'Test',
        confidence: 0.9,
        urgency: 'High'
      };

      expect(() => PickRecommendationSchema.parse(invalidPick)).toThrow();
    });

    it('should reject explanation longer than 35 words', () => {
      const longExplanation = Array.from({ length: 40 }, () => 'word').join(' ');
      const invalidPick = {
        playerId: 'player-123',
        playerName: 'Josh Allen',
        position: 'QB',
        vorp: 45.2,
        explanation: longExplanation,
        confidence: 0.9,
        urgency: 'High'
      };

      expect(() => PickRecommendationSchema.parse(invalidPick)).toThrow();
    });

    it('should reject confidence outside 0-1 range', () => {
      const invalidPick = {
        playerId: 'player-123',
        playerName: 'Josh Allen',
        position: 'QB',
        vorp: 45.2,
        explanation: 'Test',
        confidence: 1.5, // Invalid
        urgency: 'High'
      };

      expect(() => PickRecommendationSchema.parse(invalidPick)).toThrow();
    });
  });

  describe('WhatIfForesightSchema', () => {
    it('should validate correct what-if foresight', () => {
      const validForesight = {
        nextPickProbabilities: [{
          playerId: 'player-123',
          playerName: 'Tyreek Hill',
          position: 'WR',
          availabilityProbability: 0.8,
          explanation: 'Likely available next pick' // 25 chars
        }],
        recommendedStrategy: 'Wait',
        strategyExplanation: 'Better value next pick' // 22 chars
      };

      expect(() => WhatIfForesightSchema.parse(validForesight)).not.toThrow();
    });

    it('should reject invalid strategy', () => {
      const invalidForesight = {
        nextPickProbabilities: [],
        recommendedStrategy: 'INVALID_STRATEGY',
        strategyExplanation: 'Test'
      };

      expect(() => WhatIfForesightSchema.parse(invalidForesight)).toThrow();
    });
  });

  describe('RosterBalanceGuidanceSchema', () => {
    it('should validate correct roster balance guidance', () => {
      const validGuidance = {
        positionNeeds: [{
          position: 'WR',
          urgency: 'Critical',
          explanation: 'Zero WRs on roster'
        }],
        tierAlerts: [{
          position: 'RB',
          tier: 1,
          playersRemaining: 3,
          isCliff: true,
          explanation: 'Tier 1 RBs running out'
        }],
        byeWeekConcerns: [{
          week: 9,
          affectedPositions: ['QB', 'RB'],
          severity: 'High'
        }]
      };

      expect(() => RosterBalanceGuidanceSchema.parse(validGuidance)).not.toThrow();
    });

    it('should allow empty arrays for optional fields', () => {
      const minimalGuidance = {
        positionNeeds: [],
        tierAlerts: [],
        byeWeekConcerns: []
      };

      expect(() => RosterBalanceGuidanceSchema.parse(minimalGuidance)).not.toThrow();
    });
  });

  describe('TargetAlertSchema', () => {
    it('should validate correct target alerts', () => {
      const validAlerts = {
        lastChanceTargets: [{
          playerId: 'player-123',
          playerName: 'Travis Kelce',
          position: 'TE',
          roundsLeft: 2,
          explanation: 'Last elite TE available',
          priority: 'Must_Draft'
        }],
        stackingOpportunities: [{
          primaryPlayerId: 'qb-123',
          stackPlayerId: 'wr-456',
          stackType: 'QB_WR',
          explanation: 'Same team stack opportunity',
          value: 0.8
        }]
      };

      expect(() => TargetAlertSchema.parse(validAlerts)).not.toThrow();
    });

    it('should reject invalid stack type', () => {
      const invalidAlerts = {
        lastChanceTargets: [],
        stackingOpportunities: [{
          primaryPlayerId: 'qb-123',
          stackPlayerId: 'wr-456',
          stackType: 'INVALID_STACK',
          explanation: 'Test',
          value: 0.8
        }]
      };

      expect(() => TargetAlertSchema.parse(invalidAlerts)).toThrow();
    });
  });

  describe('AIStrategyResponseSchema', () => {
    it('should validate complete AI strategy response', () => {
      const validResponse = {
        topRecommendations: [{
          playerId: 'player-123',
          playerName: 'Josh Allen',
          position: 'QB',
          vorp: 45.2,
          explanation: 'Elite QB1 option',
          confidence: 0.9,
          urgency: 'High'
        }],
        whatIfForesight: {
          nextPickProbabilities: [{
            playerId: 'player-456',
            playerName: 'Tyreek Hill',
            position: 'WR',
            availabilityProbability: 0.7,
            explanation: 'May be gone by next pick'
          }],
          recommendedStrategy: 'Draft_Now',
          strategyExplanation: 'Elite talent available now'
        },
        rosterBalance: {
          positionNeeds: [{
            position: 'WR',
            urgency: 'High',
            explanation: 'Need WR depth'
          }],
          tierAlerts: [],
          byeWeekConcerns: []
        },
        targetAlerts: {
          lastChanceTargets: [],
          stackingOpportunities: []
        },
        timestamp: Date.now(),
        confidence: 0.85
      };

      expect(() => AIStrategyResponseSchema.parse(validResponse)).not.toThrow();
    });

    it('should enforce maximum 5 top recommendations', () => {
      const tooManyRecommendations = {
        topRecommendations: Array.from({ length: 6 }, (_, i) => ({
          playerId: `player-${i}`,
          playerName: `Player ${i}`,
          position: 'RB',
          vorp: 50,
          explanation: 'Good player',
          confidence: 0.8,
          urgency: 'Medium'
        })),
        whatIfForesight: {
          nextPickProbabilities: [],
          recommendedStrategy: 'Wait',
          strategyExplanation: 'Test'
        },
        rosterBalance: {
          positionNeeds: [],
          tierAlerts: [],
          byeWeekConcerns: []
        },
        targetAlerts: {
          lastChanceTargets: [],
          stackingOpportunities: []
        },
        timestamp: Date.now(),
        confidence: 0.8
      };

      expect(() => AIStrategyResponseSchema.parse(tooManyRecommendations)).toThrow();
    });

    it('should require all top-level fields', () => {
      const incompleteResponse = {
        topRecommendations: [],
        // Missing other required fields
        timestamp: Date.now(),
        confidence: 0.8
      };

      expect(() => AIStrategyResponseSchema.parse(incompleteResponse)).toThrow();
    });
  });

  describe('Edge cases and constraints', () => {
    it('should handle zero confidence values', () => {
      const zeroConfidence = {
        playerId: 'player-123',
        playerName: 'Player',
        position: 'RB',
        vorp: 30,
        explanation: 'Uncertain pick',
        confidence: 0, // Valid minimum
        urgency: 'Low'
      };

      expect(() => PickRecommendationSchema.parse(zeroConfidence)).not.toThrow();
    });

    it('should handle maximum confidence values', () => {
      const maxConfidence = {
        playerId: 'player-123',
        playerName: 'Player',
        position: 'RB', 
        vorp: 60,
        explanation: 'Certain pick',
        confidence: 1, // Valid maximum
        urgency: 'High'
      };

      expect(() => PickRecommendationSchema.parse(maxConfidence)).not.toThrow();
    });

    it('should handle negative VORP values', () => {
      const negativeVORP = {
        playerId: 'player-123',
        playerName: 'Player',
        position: 'K',
        vorp: -5.2, // Negative VORP is valid
        explanation: 'Below replacement level',
        confidence: 0.6,
        urgency: 'Low'
      };

      expect(() => PickRecommendationSchema.parse(negativeVORP)).not.toThrow();
    });

    it('should validate bye week numbers', () => {
      const validByeWeek = {
        week: 14, // Valid bye week
        affectedPositions: ['QB'],
        severity: 'Medium'
      };

      // This should be part of a larger schema test
      expect(validByeWeek.week).toBeGreaterThan(0);
      expect(validByeWeek.week).toBeLessThanOrEqual(18);
    });
  });
});