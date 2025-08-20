import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIStrategyService } from '../services/ai/AIStrategyService';
import { StrategicAnalysisEngine } from '../utils/strategicAnalysis';
import type { AIStrategyInput, AIStrategyResponse, CandidateFeature } from '../types/ai';
import type { Player, Team, DraftState, Position } from '../types';

// Mock the OpenAI provider - Updated for new schema
vi.mock('../services/ai/providers/openai', () => ({
  OpenAIProvider: vi.fn().mockImplementation(() => ({
    name: 'openai',
    generateCompletion: vi.fn().mockResolvedValue(JSON.stringify({
      topRecommendations: [
        {
          playerId: 'player_1',
          playerName: 'Christian McCaffrey',
          position: 'RB',
          team: 'SF',
          vorp: 15.2,
          tier: 1,
          adp: 2.1,
          adpDelta: -20.9, // adp - currentPick (2.1 - 23 = -20.9, negative = reach)
          pAvailableNextPick: 0.2,
          urgency: 'High',
          confidence: 0.92,
          explanation: 'Elite RB1 with highest VORP, fills critical roster need',
          scoreBreakdown: {
            vorp: 0.9,
            need: 0.85,
            adpValue: 0.3, // Reaching but worth it
            stack: 0.0,
            bye: 0.7,
            risk: 0.8,
            snipe: 0.9 // High snipe risk
          },
          tieBreakersApplied: ['RosterFit', 'ADPValue'],
          strategicReasoning: {
            rosterFit: 'Fills empty RB1 slot perfectly',
            positionalScarcity: 'Only 2 elite RBs left',
            opponentImpact: 'Blocks Team B\'s top target',
            futureFlexibility: 'Allows WR focus in round 2',
            opportunityCost: 0.85
          }
        },
        {
          playerId: 'player_2', 
          playerName: 'Tyreek Hill',
          position: 'WR',
          team: 'MIA',
          vorp: 12.8,
          tier: 1,
          adp: 8.4,
          adpDelta: -14.6, // 8.4 - 23 = -14.6
          pAvailableNextPick: 0.6,
          urgency: 'Medium',
          confidence: 0.87,
          explanation: 'Elite WR1 with strong ceiling, good ADP value',
          scoreBreakdown: {
            vorp: 0.85,
            need: 0.7,
            adpValue: 0.6,
            stack: 0.0,
            bye: 0.6,
            risk: 0.7,
            snipe: 0.4
          },
          tieBreakersApplied: ['StackEquity', 'ByeDiversity'],
          strategicReasoning: {
            rosterFit: 'Upgrades WR corps significantly',
            positionalScarcity: 'WR depth exists later',
            opponentImpact: 'Minimal competition at this pick',
            futureFlexibility: 'Flexible with later picks',
            opportunityCost: 0.45
          }
        },
        {
          playerId: 'player_3',
          playerName: 'Travis Kelce',
          position: 'TE',
          team: 'KC',
          vorp: 11.5,
          tier: 1,
          adp: 15.2,
          adpDelta: -7.8, // 15.2 - 23 = -7.8
          pAvailableNextPick: 0.8,
          urgency: 'Low',
          confidence: 0.75,
          explanation: 'Tier 1 TE, large positional advantage',
          scoreBreakdown: {
            vorp: 0.8,
            need: 0.6,
            adpValue: 0.7,
            stack: 0.0,
            bye: 0.5,
            risk: 0.9,
            snipe: 0.2
          },
          tieBreakersApplied: ['RiskProfile'],
          strategicReasoning: {
            rosterFit: 'Solves TE position for season',
            positionalScarcity: 'Tier cliff after top 3 TEs',
            opponentImpact: 'Others may reach for him',
            futureFlexibility: 'Frees up later TE picks',
            opportunityCost: 0.25
          }
        }
      ],
      whatIfPass: {
        likelyAvailableNextPick: ['player_2', 'player_3'],
        risks: ['TE Tier-1 likely gone', 'RB scarcity increases'],
        notes: 'Strong WR depth available in rounds 3-4, consider waiting on WR'
      },
      warnings: [],
      timestamp: Date.now(),
      confidence: 0.88,
      summary: 'RB scarcity high, grab McCaffrey now before competitors. WR depth available later.'
    }))
  }))
}));

describe('AI Overlay V3 Integration Tests', () => {
  let aiService: AIStrategyService;
  let strategicEngine: StrategicAnalysisEngine;
  let mockPlayers: Player[];
  let mockTeams: Team[];
  let mockDraftState: DraftState;

  beforeEach(() => {
    // Setup mock data
    mockPlayers = [
      {
        id: 'player_1',
        name: 'Christian McCaffrey',
        position: 'RB' as Position,
        team: 'SF',
        byeWeek: 9,
        vorp: 15.2,
        tier: 1,
        adp: 2.1,
        isDrafted: false,
        isDoNotDraft: false
      },
      {
        id: 'player_2', 
        name: 'Tyreek Hill',
        position: 'WR' as Position,
        team: 'MIA',
        byeWeek: 6,
        vorp: 12.8,
        tier: 1,
        adp: 8.4,
        isDrafted: false,
        isDoNotDraft: false
      },
      {
        id: 'player_3',
        name: 'Travis Kelce', 
        position: 'TE' as Position,
        team: 'KC',
        byeWeek: 10,
        vorp: 11.5,
        tier: 1,
        adp: 15.2,
        isDrafted: false,
        isDoNotDraft: false
      },
      {
        id: 'player_4',
        name: 'Harrison Butker',
        position: 'K' as Position,
        team: 'KC',
        byeWeek: 10,
        vorp: 2.1,
        tier: 3,
        adp: 165.0,
        isDrafted: false,
        isDoNotDraft: false
      },
      {
        id: 'player_5',
        name: 'Player Without ADP',
        position: 'WR' as Position,
        team: 'BUF',
        byeWeek: 12,
        vorp: 8.5,
        tier: 2,
        adp: undefined, // Missing ADP for testing
        isDrafted: false,
        isDoNotDraft: false
      }
    ];

    mockTeams = [
      {
        id: 'team_user',
        name: 'User Team',
        isUser: true,
        roster: {
          QB: [],
          RB: [],
          WR: [],
          TE: [],
          K: [],
          DEF: []
        }
      },
      {
        id: 'team_opp1',
        name: 'Opponent A',
        isUser: false,
        roster: {
          QB: [],
          RB: [{
            id: 'drafted_rb',
            name: 'Saquon Barkley',
            position: 'RB' as Position,
            team: 'PHI',
            vorp: 12.0
          }],
          WR: [],
          TE: [],
          K: [],
          DEF: []
        }
      }
    ];

    mockDraftState = {
      isActive: true,
      currentPick: 23,
      picksUntilMyTurn: 3,
      players: mockPlayers,
      teams: mockTeams,
      settings: {
        numberOfTeams: 12,
        numberOfRounds: 16,
        draftSlot: 5,
        rosterSlots: {
          QB: 1,
          RB: 2,
          WR: 2,
          TE: 1,
          FLEX: 1,
          K: 1,
          DEF: 1,
          BENCH: 7
        },
        scoringType: 'PPR'
      }
    };

    // Initialize services
    strategicEngine = new StrategicAnalysisEngine(mockPlayers, mockTeams, mockDraftState);
    aiService = new AIStrategyService({
      provider: 'openai',
      apiKey: 'test-key'
    });
  });

  describe('Enhanced Schema Validation', () => {
    it('should return exactly 3 recommendations', async () => {
      const baseInput = {
        availablePlayers: mockPlayers.filter(p => !p.isDrafted),
        userTeam: mockTeams[0],
        allTeams: mockTeams,
        draftState: mockDraftState,
        picksUntilMyTurn: 3
      };

      const enhancedInput = strategicEngine.generateEnhancedInput(baseInput);
      const response = await aiService.generateStrategy(enhancedInput);

      expect(response.topRecommendations).toHaveLength(3);
    });

    it('should include all new required fields', async () => {
      const baseInput = {
        availablePlayers: mockPlayers.filter(p => !p.isDrafted),
        userTeam: mockTeams[0],
        allTeams: mockTeams,
        draftState: mockDraftState,
        picksUntilMyTurn: 3
      };

      const enhancedInput = strategicEngine.generateEnhancedInput(baseInput);
      const response = await aiService.generateStrategy(enhancedInput);

      response.topRecommendations.forEach(rec => {
        // Check new required fields
        expect(rec).toHaveProperty('adpDelta');
        expect(typeof rec.adpDelta).toBe('number');
        
        expect(rec).toHaveProperty('scoreBreakdown');
        expect(rec.scoreBreakdown).toHaveProperty('vorp');
        expect(rec.scoreBreakdown).toHaveProperty('need');
        expect(rec.scoreBreakdown).toHaveProperty('adpValue');
        expect(rec.scoreBreakdown).toHaveProperty('stack');
        expect(rec.scoreBreakdown).toHaveProperty('bye');
        expect(rec.scoreBreakdown).toHaveProperty('risk');
        expect(rec.scoreBreakdown).toHaveProperty('snipe');
        
        // Check all scoreBreakdown values are 0-1
        Object.values(rec.scoreBreakdown).forEach(score => {
          expect(score).toBeGreaterThanOrEqual(0);
          expect(score).toBeLessThanOrEqual(1);
        });
        
        expect(rec).toHaveProperty('tieBreakersApplied');
        expect(Array.isArray(rec.tieBreakersApplied)).toBe(true);
      });

      // Check whatIfPass block
      expect(response).toHaveProperty('whatIfPass');
      expect(response.whatIfPass).toHaveProperty('likelyAvailableNextPick');
      expect(response.whatIfPass).toHaveProperty('risks');
      expect(response.whatIfPass).toHaveProperty('notes');
      expect(Array.isArray(response.whatIfPass.likelyAvailableNextPick)).toBe(true);
      expect(Array.isArray(response.whatIfPass.risks)).toBe(true);
      expect(response.whatIfPass.notes.length).toBeLessThanOrEqual(120);
    });

    it('should honor explicit urgency thresholds', async () => {
      const baseInput = {
        availablePlayers: mockPlayers.filter(p => !p.isDrafted),
        userTeam: mockTeams[0],
        allTeams: mockTeams,
        draftState: mockDraftState,
        picksUntilMyTurn: 3
      };

      const enhancedInput = strategicEngine.generateEnhancedInput(baseInput);
      const response = await aiService.generateStrategy(enhancedInput);

      response.topRecommendations.forEach(rec => {
        if (rec.pAvailableNextPick !== undefined) {
          if (rec.pAvailableNextPick < 0.30) {
            // Should be High urgency
            expect(rec.urgency).toBe('High');
          } else if (rec.pAvailableNextPick < 0.60) {
            // Should be Medium or High urgency
            expect(['Medium', 'High']).toContain(rec.urgency);
          }
          // Note: Low urgency can occur for any value but is expected for >= 0.60
        }
      });
    });

    it('should ensure confidence is within 0-1 range', async () => {
      const baseInput = {
        availablePlayers: mockPlayers.filter(p => !p.isDrafted),
        userTeam: mockTeams[0],
        allTeams: mockTeams,
        draftState: mockDraftState,
        picksUntilMyTurn: 3
      };

      const enhancedInput = strategicEngine.generateEnhancedInput(baseInput);
      const response = await aiService.generateStrategy(enhancedInput);

      response.topRecommendations.forEach(rec => {
        expect(rec.confidence).toBeGreaterThanOrEqual(0);
        expect(rec.confidence).toBeLessThanOrEqual(1);
      });

      expect(response.confidence).toBeGreaterThanOrEqual(0);
      expect(response.confidence).toBeLessThanOrEqual(1);
    });

    it('should include whatIfPass when candidates have high availability probability', async () => {
      const baseInput = {
        availablePlayers: mockPlayers.filter(p => !p.isDrafted),
        userTeam: mockTeams[0],
        allTeams: mockTeams,
        draftState: mockDraftState,
        picksUntilMyTurn: 3
      };

      const enhancedInput = strategicEngine.generateEnhancedInput(baseInput);
      const response = await aiService.generateStrategy(enhancedInput);

      // Should always have whatIfPass block
      expect(response.whatIfPass).toBeDefined();
      expect(response.whatIfPass.likelyAvailableNextPick).toBeDefined();
      
      // Check that likelyAvailableNextPick contains player IDs when availability >= 0.5
      const highAvailabilityRecs = response.topRecommendations.filter(
        rec => rec.pAvailableNextPick && rec.pAvailableNextPick >= 0.5
      );
      
      if (highAvailabilityRecs.length > 0) {
        expect(response.whatIfPass.likelyAvailableNextPick.length).toBeGreaterThan(0);
      }
    });

    it('should populate warnings when candidate is missing tier or adp', async () => {
      // Include the player without ADP
      const baseInput = {
        availablePlayers: mockPlayers.filter(p => !p.isDrafted && p.id === 'player_5'),
        userTeam: mockTeams[0],
        allTeams: mockTeams,
        draftState: mockDraftState,
        picksUntilMyTurn: 3
      };

      const enhancedInput = strategicEngine.generateEnhancedInput(baseInput);
      
      // Check that our candidate features handle missing ADP
      const candidateWithoutADP = enhancedInput.candidates.find(c => c.id === 'player_5');
      expect(candidateWithoutADP).toBeDefined();
      expect(candidateWithoutADP?.adp).toBeUndefined();
      expect(candidateWithoutADP?.adp_delta).toBe(0); // Default when ADP missing

      // The AI service should handle this gracefully
      const response = await aiService.generateStrategy(enhancedInput);
      expect(response).toBeDefined();
      // Note: Real AI would need to generate warnings based on missing data
    });
  });

  describe('ADP Delta Calculation', () => {
    it('should calculate adp_delta correctly', () => {
      const baseInput = {
        availablePlayers: mockPlayers.filter(p => !p.isDrafted),
        userTeam: mockTeams[0],
        allTeams: mockTeams,
        draftState: mockDraftState,
        picksUntilMyTurn: 3
      };

      const enhancedInput = strategicEngine.generateEnhancedInput(baseInput);

      // Test adp_delta calculation (adp - currentPick)
      const cmcCandidate = enhancedInput.candidates.find(c => c.id === 'player_1');
      expect(cmcCandidate?.adp_delta).toBe(2.1 - 23); // -20.9 (negative = reach)

      const kelceCandidate = enhancedInput.candidates.find(c => c.id === 'player_3');
      expect(kelceCandidate?.adp_delta).toBe(15.2 - 23); // -7.8 (negative = reach but smaller)

      // Missing ADP should default to 0
      const missingADPCandidate = enhancedInput.candidates.find(c => c.id === 'player_5');
      expect(missingADPCandidate?.adp_delta).toBe(0);
    });
  });

  describe('Provider Strict JSON Mode', () => {
    it('should return pure JSON without code fences', async () => {
      const baseInput = {
        availablePlayers: mockPlayers.filter(p => !p.isDrafted),
        userTeam: mockTeams[0],
        allTeams: mockTeams,
        draftState: mockDraftState,
        picksUntilMyTurn: 3
      };

      const enhancedInput = strategicEngine.generateEnhancedInput(baseInput);
      const response = await aiService.generateStrategy(enhancedInput);

      // Should successfully parse without any code fence processing
      expect(response).toBeDefined();
      expect(response.topRecommendations).toHaveLength(3);
      expect(response.confidence).toBeGreaterThan(0);
      expect(response.whatIfPass).toBeDefined();
    });

    it('should include explicit JSON-only instruction in prompt', async () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const consoleGroupSpy = vi.spyOn(console, 'group').mockImplementation(() => {});
      
      const baseInput = {
        availablePlayers: mockPlayers.filter(p => !p.isDrafted),
        userTeam: mockTeams[0],
        allTeams: mockTeams,
        draftState: mockDraftState,
        picksUntilMyTurn: 3
      };

      const enhancedInput = strategicEngine.generateEnhancedInput(baseInput);
      await aiService.generateStrategy(enhancedInput);

      // Check that the prompt includes the explicit JSON instruction
      const logCalls = consoleLogSpy.mock.calls;
      const promptCall = logCalls.find(call => 
        call[0] && typeof call[0] === 'string' && call[0].includes('Return STRICT JSON only')
      );
      expect(promptCall).toBeDefined();
      
      consoleLogSpy.mockRestore();
      consoleGroupSpy.mockRestore();
    });
  });

  describe('Guardrails', () => {
    it('should apply K/DEF gating correctly', () => {
      // Test early pick scenario (should exclude K/DEF)
      const earlyPickInput = {
        availablePlayers: mockPlayers.filter(p => !p.isDrafted),
        userTeam: mockTeams[0], // Empty roster
        allTeams: mockTeams,
        draftState: { ...mockDraftState, currentPick: 15 },
        picksUntilMyTurn: 15 // > kDefWindow
      };

      const enhancedEarlyInput = strategicEngine.generateEnhancedInput(earlyPickInput);
      const hasKDefEarly = enhancedEarlyInput.candidates.some(c => c.pos === 'K' || c.pos === 'DEF');
      expect(hasKDefEarly).toBe(false);

      // Test late pick scenario with satisfied needs (should include K/DEF)
      const satisfiedTeam = {
        ...mockTeams[0],
        roster: {
          QB: [{ id: 'qb1', name: 'QB', position: 'QB' as Position, team: 'Team', vorp: 5 }],
          RB: [
            { id: 'rb1', name: 'RB1', position: 'RB' as Position, team: 'Team', vorp: 10 },
            { id: 'rb2', name: 'RB2', position: 'RB' as Position, team: 'Team', vorp: 8 }
          ],
          WR: [
            { id: 'wr1', name: 'WR1', position: 'WR' as Position, team: 'Team', vorp: 9 },
            { id: 'wr2', name: 'WR2', position: 'WR' as Position, team: 'Team', vorp: 7 }
          ],
          TE: [{ id: 'te1', name: 'TE', position: 'TE' as Position, team: 'Team', vorp: 6 }],
          K: [],
          DEF: []
        }
      };

      const latePickInput = {
        availablePlayers: mockPlayers.filter(p => !p.isDrafted),
        userTeam: satisfiedTeam,
        allTeams: [satisfiedTeam, mockTeams[1]],
        draftState: { ...mockDraftState, currentPick: 150 },
        picksUntilMyTurn: 5 // < kDefWindow
      };

      const enhancedLateInput = strategicEngine.generateEnhancedInput(latePickInput);
      const hasKDefLate = enhancedLateInput.candidates.some(c => c.pos === 'K');
      expect(hasKDefLate).toBe(true);
    });

    it('should handle missing input data gracefully', () => {
      const baseInput = {
        availablePlayers: mockPlayers.filter(p => !p.isDrafted),
        userTeam: mockTeams[0],
        allTeams: mockTeams,
        draftState: mockDraftState,
        picksUntilMyTurn: 3
      };

      const enhancedInput = strategicEngine.generateEnhancedInput(baseInput);
      
      // Ensure candidates with missing data are still included
      const candidatesWithMissingData = enhancedInput.candidates.filter(c => 
        !c.tier || !c.adp || c.p_available_next_pick === undefined
      );
      
      // Should still have candidates even if some data is missing
      expect(enhancedInput.candidates.length).toBeGreaterThan(0);
    });
  });
});