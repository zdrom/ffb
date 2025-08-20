import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIStrategyService } from '../services/ai/AIStrategyService';
import { StrategicAnalysisEngine } from '../utils/strategicAnalysis';
import type { AIStrategyInput, AIStrategyResponse, CandidateFeature } from '../types/ai';
import type { Player, Team, DraftState, Position } from '../types';

// Mock the OpenAI provider
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
          pAvailableNextPick: 0.2,
          urgency: 'High',
          confidence: 0.92,
          explanation: 'Elite RB1 with highest VORP, fills critical roster need',
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
          pAvailableNextPick: 0.6,
          urgency: 'Medium',
          confidence: 0.87,
          explanation: 'Elite WR1 with strong ceiling, good ADP value',
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
          pAvailableNextPick: 0.8,
          urgency: 'Low',
          confidence: 0.75,
          explanation: 'Tier 1 TE, large positional advantage',
          strategicReasoning: {
            rosterFit: 'Solves TE position for season',
            positionalScarcity: 'Tier cliff after top 3 TEs',
            opponentImpact: 'Others may reach for him',
            futureFlexibility: 'Frees up later TE picks',
            opportunityCost: 0.25
          }
        }
      ],
      warnings: [],
      timestamp: Date.now(),
      confidence: 0.88,
      summary: 'RB scarcity high, grab McCaffrey now before competitors. WR depth available later.'
    }))
  }))
}));

describe('AI Overlay V2 Integration Tests', () => {
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

  describe('Enhanced Data Pipeline', () => {
    it('should generate candidate features with all required fields', () => {
      const baseInput = {
        availablePlayers: mockPlayers.filter(p => !p.isDrafted),
        userTeam: mockTeams[0],
        allTeams: mockTeams,
        draftState: mockDraftState,
        picksUntilMyTurn: 3
      };

      const enhancedInput = strategicEngine.generateEnhancedInput(baseInput);

      expect(enhancedInput.candidates).toBeDefined();
      expect(enhancedInput.candidates.length).toBeGreaterThan(0);
      
      const candidate = enhancedInput.candidates[0];
      expect(candidate).toHaveProperty('id');
      expect(candidate).toHaveProperty('name');
      expect(candidate).toHaveProperty('pos');
      expect(candidate).toHaveProperty('vorp');
      expect(candidate).toHaveProperty('tier');
      expect(candidate).toHaveProperty('adp');
      expect(candidate).toHaveProperty('adp_delta');
      expect(candidate).toHaveProperty('stack_bonus');
      expect(candidate).toHaveProperty('risk');
      expect(candidate).toHaveProperty('p_available_next_pick');
    });

    it('should calculate tier counts remaining', () => {
      const baseInput = {
        availablePlayers: mockPlayers.filter(p => !p.isDrafted),
        userTeam: mockTeams[0],
        allTeams: mockTeams,
        draftState: mockDraftState,
        picksUntilMyTurn: 3
      };

      const enhancedInput = strategicEngine.generateEnhancedInput(baseInput);

      expect(enhancedInput.tierCountsRemaining).toBeDefined();
      expect(enhancedInput.tierCountsRemaining.RB).toBeDefined();
      expect(enhancedInput.tierCountsRemaining.RB[1]).toBe(1); // 1 tier-1 RB (McCaffrey)
    });

    it('should filter out K/DEF when outside window or needs not satisfied', () => {
      const baseInput = {
        availablePlayers: mockPlayers.filter(p => !p.isDrafted),
        userTeam: mockTeams[0], // Empty roster
        allTeams: mockTeams,
        draftState: mockDraftState,
        picksUntilMyTurn: 15 // Outside kDefWindow of 12
      };

      const enhancedInput = strategicEngine.generateEnhancedInput(baseInput);

      // Should not include K/DEF when picks > 12 and core needs not satisfied
      const hasKicker = enhancedInput.candidates.some(c => c.pos === 'K');
      expect(hasKicker).toBe(false);
    });
  });

  describe('AI Service Integration', () => {
    it('should generate exactly 3 recommendations', async () => {
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

    it('should include all required fields in recommendations', async () => {
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
        expect(rec).toHaveProperty('playerId');
        expect(rec).toHaveProperty('playerName');
        expect(rec).toHaveProperty('position');
        expect(rec).toHaveProperty('team');
        expect(rec).toHaveProperty('vorp');
        expect(rec).toHaveProperty('tier');
        expect(rec).toHaveProperty('adp');
        expect(rec).toHaveProperty('pAvailableNextPick');
        expect(rec).toHaveProperty('urgency');
        expect(rec).toHaveProperty('confidence');
        expect(rec.strategicReasoning).toHaveProperty('opportunityCost');
      });
    });

    it('should normalize urgency based on availability heuristic', async () => {
      const baseInput = {
        availablePlayers: mockPlayers.filter(p => !p.isDrafted),
        userTeam: mockTeams[0],
        allTeams: mockTeams,
        draftState: mockDraftState,
        picksUntilMyTurn: 3
      };

      const enhancedInput = strategicEngine.generateEnhancedInput(baseInput);
      const response = await aiService.generateStrategy(enhancedInput);

      // Check that urgency matches heuristic expectations
      const highUrgencyRec = response.topRecommendations.find(r => r.urgency === 'High');
      if (highUrgencyRec && highUrgencyRec.pAvailableNextPick !== undefined) {
        expect(highUrgencyRec.pAvailableNextPick).toBeLessThan(0.3);
      }
    });

    it('should include warnings when input data is missing', async () => {
      // Create input with missing ADP data
      const playersWithoutADP = mockPlayers.map(p => ({ ...p, adp: undefined }));
      const baseInput = {
        availablePlayers: playersWithoutADP.filter(p => !p.isDrafted),
        userTeam: mockTeams[0],
        allTeams: mockTeams,
        draftState: mockDraftState,
        picksUntilMyTurn: 3
      };

      const enhancedInput = strategicEngine.generateEnhancedInput(baseInput);
      const response = await aiService.generateStrategy(enhancedInput);

      expect(response.warnings).toBeDefined();
      // Note: The actual AI would need to generate warnings, this is just testing the schema
    });
  });

  describe('Strategic Analysis Engine', () => {
    it('should calculate tier cliff pressure correctly', () => {
      const tierCounts = {
        RB: { 1: 1, 2: 2, 3: 5 },
        WR: { 1: 3, 2: 4, 3: 6 },
        TE: { 1: 1, 2: 1, 3: 2 }
      };

      const rbPressure = strategicEngine.calculateTierCliffPressure('RB', tierCounts);
      const wrPressure = strategicEngine.calculateTierCliffPressure('WR', tierCounts);
      const tePressure = strategicEngine.calculateTierCliffPressure('TE', tierCounts);

      // RB has only 1 tier-1 left, should be high pressure
      expect(rbPressure).toBeGreaterThan(0.8);
      
      // WR has 3 tier-1 left, should be lower pressure
      expect(wrPressure).toBeLessThan(0.5);
      
      // TE has 1 tier-1 and 1 tier-2, should be high pressure
      expect(tePressure).toBeGreaterThan(0.6);
    });

    it('should detect stacks in progress', () => {
      // Test the stack detection logic directly
      const teamWithStack = {
        ...mockTeams[1],
        roster: {
          QB: [{
            id: 'mahomes',
            name: 'Patrick Mahomes',
            position: 'QB' as Position,
            team: 'KC',
            vorp: 8.5
          }],
          RB: [],
          WR: [{
            id: 'kelce_wr',  
            name: 'Travis Kelce',
            position: 'WR' as Position,
            team: 'KC',
            vorp: 11.5
          }],
          TE: [],
          K: [],
          DEF: []
        }
      };

      const stacks = strategicEngine['detectStacksInProgress'](teamWithStack);
      expect(stacks).toContain('QB-WR');
    });
  });

  describe('Acceptance Criteria', () => {
    it('should include richer context in prompt', async () => {
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

      // Verify that console logging includes detailed context
      expect(consoleGroupSpy).toHaveBeenCalledWith('🤖 AI Prompt Being Sent:');
      
      consoleLogSpy.mockRestore();
      consoleGroupSpy.mockRestore();
    });

    it('should return JSON without code fences', async () => {
      const baseInput = {
        availablePlayers: mockPlayers.filter(p => !p.isDrafted),
        userTeam: mockTeams[0],
        allTeams: mockTeams,
        draftState: mockDraftState,
        picksUntilMyTurn: 3
      };

      const enhancedInput = strategicEngine.generateEnhancedInput(baseInput);
      const response = await aiService.generateStrategy(enhancedInput);

      // Should successfully parse without code fence handling
      expect(response).toBeDefined();
      expect(response.topRecommendations).toHaveLength(3);
      expect(response.confidence).toBeGreaterThan(0);
    });

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
  });
});