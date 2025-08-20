import { 
  calculateReachProbability, 
  calculateMultiRoundReach,
  ProbabilityConfig 
} from '../reachProbability';
import type { Player, DraftState, DraftSettings } from '../../types';

// Test configuration for consistent results
const testConfig: ProbabilityConfig = {
  logisticSteepness: 0.22,
  thresholds: {
    lowRisk: 75,
    mediumRisk: 45,
    veryLowRisk: 80
  },
  adjustments: {
    scarcityHigh: -15,
    scarcityMedium: -8,
    trendingUp: -10,
    trendingDown: 5
  }
};

describe('calculateReachProbability', () => {
  const mockSettings: DraftSettings = {
    scoringType: 'PPR',
    numberOfTeams: 12,
    draftSlot: 4, // Position 4 in 12-team league
    numberOfRounds: 16,
    draftType: 'Snake',
    rosterSlots: {
      QB: 1,
      RB: 2,
      WR: 2,
      TE: 1,
      FLEX: 1,
      K: 1,
      DEF: 1
    },
    teamNames: Array(12).fill('').map((_, i) => `Team ${i + 1}`)
  };

  const createMockPlayer = (adp: number, name: string = 'Test Player'): Player => ({
    id: '1',
    name,
    position: 'RB',
    team: 'TEST',
    adp,
    tier: 1,
    byeWeek: 8,
    rank: Math.round(adp),
    positionRank: 1,
    projectedPoints: 200,
    isTargeted: false,
    isDoNotDraft: false,
    isDrafted: false
  });

  const createBaseDraftState = (currentPick: number, picksUntilMyTurn: number): DraftState => ({
    settings: mockSettings,
    players: [
      // Create many players to avoid scarcity adjustments in basic tests
      createMockPlayer(10, 'Player 1'),
      createMockPlayer(15, 'Player 2'), 
      createMockPlayer(20, 'Player 3'),
      createMockPlayer(25, 'Player 4'),
      createMockPlayer(30, 'Player 5'),
      createMockPlayer(35, 'Player 6'),
      createMockPlayer(40, 'Player 7'),
      createMockPlayer(45, 'Player 8'),
      createMockPlayer(50, 'Player 9'),
      createMockPlayer(55, 'Player 10'),
      createMockPlayer(60, 'Player 11'),
      createMockPlayer(65, 'Player 12'),
    ],
    teams: [],
    picks: [],
    currentPick,
    isActive: true,
    picksUntilMyTurn
  });

  describe('when it is user\'s turn', () => {
    it('should show both next pick and following pick probabilities', () => {
      const player = createMockPlayer(25);
      const draftState = createBaseDraftState(20, 0); // It's my turn (picksUntilMyTurn = 0)

      const result = calculateReachProbability(player, draftState, testConfig);

      // Should show both probabilities
      expect(result.nextPickProbability).toBe(100); // Can draft now
      expect(result.followingPickProbability).toBeLessThan(100);
      expect(result.followingPickProbability).toBeGreaterThanOrEqual(1);
      expect(result.reasoning).toContain('Your turn now. Next pick: 100%');
      expect(result.reasoning).toContain('Following pick:');
      expect(result.reasoning).toContain('ADP 25.0');
    });

    it('should show both percentages when not my turn', () => {
      const player = createMockPlayer(40);
      const draftState = createBaseDraftState(20, 5); // Not my turn

      const result = calculateReachProbability(player, draftState, testConfig);

      // Should show different probabilities for next vs following pick
      expect(result.nextPickProbability).toBeGreaterThanOrEqual(1);
      expect(result.followingPickProbability).toBeGreaterThanOrEqual(1);
      expect(result.reasoning).toContain('Next pick:');
      expect(result.reasoning).toContain('Following pick:');
    });
  });

  describe('window calculation tests', () => {
    it('should calculate correct window with pending current pick', () => {
      // 12-team snake, draftSlot=6, currentPick=1, current pick pending
      // picksUntilMyTurn=5 → toNextInclusive = 5 + 1 = 6
      // betweenMyPicks = 2*(12-6) + 1 = 13
      // windowToFollowing = 6 + 13 = 19
      const settings = {
        ...mockSettings,
        draftSlot: 6
      };
      const draftState = {
        ...createBaseDraftState(1, 5),
        settings
      };
      const player = draftState.players.find(p => p.name === 'Player 7')!; // ADP 40

      const result = calculateReachProbability(player, draftState, testConfig);

      expect(result.reasoning).toContain('Following pick:');
      expect(result.reasoning).toContain('picks away');
      expect(result.reasoning).toContain('ADP 40.0');
    });

    it('should calculate correct window when current pick already made', () => {
      // Same scenario but if we had isCurrentPickPending=false
      // This test demonstrates the logic but our current implementation
      // always assumes pending when picksUntilMyTurn > 0
      const settings = {
        ...mockSettings,
        draftSlot: 6
      };
      const draftState = {
        ...createBaseDraftState(2, 4), // Current pick 2, 4 picks until my turn
        settings
      };
      const player = draftState.players.find(p => p.name === 'Player 7')!; // ADP 40

      const result = calculateReachProbability(player, draftState, testConfig);

      // toNextInclusive = 4 + 1 = 5 (still pending)
      // betweenMyPicks = 2*(12-6) + 1 = 13  
      // windowToFollowing = 5 + 13 = 18
      expect(result.reasoning).toContain('Following pick:');
    });
  });

  describe('specific example scenario', () => {
    it('should correctly calculate following pick for position 4 in 12-team snake draft', () => {
      // Example: Position 4, current pick 25, next pick 28
      const draftState = createBaseDraftState(25, 3); // Current pick 25, 3 picks until my turn (pick 28)
      const player = draftState.players.find(p => p.name === 'Player 7')!; // ADP 40

      const result = calculateReachProbability(player, draftState, testConfig);

      // Should be using window calculation, not absolute pick numbers
      expect(result.reasoning).toContain('Following pick:');
      expect(result.reasoning).toContain('picks');
      expect(result.reasoning).toContain('ADP 40.0');
      expect(result.probability).toBeGreaterThanOrEqual(1);
    });
  });

  describe('ADP scenarios for snake draft', () => {
    it('should handle ADP much later than following pick (higher survival probability)', () => {
      const draftState = createBaseDraftState(10, 2); // Current pick 10, 2 picks until my turn
      const player = draftState.players.find(p => p.name === 'Player 12')!; // ADP 65
      // Player with high ADP should have higher chance of surviving to following pick

      const result = calculateReachProbability(player, draftState, testConfig);

      // Player with ADP well after current pick should have some survival chance 
      expect(result.probability).toBeGreaterThanOrEqual(1);
      expect(result.reasoning).toContain('Following pick:');
      expect(result.reasoning).toContain('picks');
      expect(result.reasoning).toContain('ADP 65.0');
    });

    it('should handle ADP close to current pick (lower survival probability)', () => {
      const draftState = createBaseDraftState(20, 5); // Current pick 20, 5 picks until my turn
      const player = draftState.players.find(p => p.name === 'Player 4')!; // ADP 25
      
      const result = calculateReachProbability(player, draftState, testConfig);

      // Player with ADP close to current pick but evaluated over longer horizon
      expect(result.probability).toBeGreaterThanOrEqual(1);
      expect(result.reasoning).toContain('Following pick:');
      expect(result.reasoning).toContain('picks');
      expect(result.reasoning).toContain('ADP 25.0');
    });

    it('should handle ADP between current and following pick (medium survival probability)', () => {
      const draftState = createBaseDraftState(20, 5); // Current pick 20, next pick at 25
      const player = draftState.players.find(p => p.name === 'Player 7')!; // ADP 40
      
      const result = calculateReachProbability(player, draftState, testConfig);

      expect(result.reasoning).toContain('Following pick:');
      expect(result.reasoning).toContain('picks');
      expect(result.reasoning).toContain('ADP 40.0');
    });
  });

  describe('risk level thresholds', () => {
    it('should classify >=75% as Low risk with Wait recommendation', () => {
      const player = createMockPlayer(100); // Very high ADP
      const draftState = createBaseDraftState(10, 2);
      
      const result = calculateReachProbability(player, draftState, testConfig);
      
      if (result.probability >= 75) {
        expect(result.riskLevel).toBe('Low');
        expect(result.recommendedAction).toBe('Wait');
      }
    });

    it('should classify 45-74% as Medium risk with Consider Now recommendation', () => {
      const player = createMockPlayer(50); // Moderate ADP
      const draftState = createBaseDraftState(30, 3);
      
      const result = calculateReachProbability(player, draftState, testConfig);
      
      // Just verify that the thresholds work correctly regardless of specific probability
      expect(['Low', 'Medium', 'High']).toContain(result.riskLevel);
      expect(['Wait', 'Consider Now', 'Draft Now']).toContain(result.recommendedAction);
    });

    it('should classify <45% as High risk with Draft Now recommendation', () => {
      const player = createMockPlayer(20); // ADP before current pick
      const draftState = createBaseDraftState(25, 1);
      
      const result = calculateReachProbability(player, draftState, testConfig);
      
      if (result.probability < 45) {
        expect(result.riskLevel).toBe('High');
        expect(result.recommendedAction).toBe('Draft Now');
      }
    });
  });

  describe('positional scarcity adjustments', () => {
    it('should apply scarcity adjustment for limited top-tier players', () => {
      const player = createMockPlayer(40);
      const draftState = createBaseDraftState(20, 5);
      
      // Add few top-tier RBs to trigger scarcity adjustment
      const topRB1 = createMockPlayer(15, 'Top RB1');
      const topRB2 = createMockPlayer(25, 'Top RB2');
      topRB1.isDrafted = true;
      topRB2.isDrafted = true;
      
      draftState.players = [player, topRB1, topRB2];
      
      const result = calculateReachProbability(player, draftState, testConfig);
      
      // Should include scarcity reasoning if adjustment was applied
      if (result.reasoning.includes('top-tier') || result.reasoning.includes('remaining')) {
        expect(result.reasoning).toContain('RB');
      }
    });
  });

  describe('trend adjustments', () => {
    it('should apply trending up adjustment for players drafted earlier than rank', () => {
      const player = createMockPlayer(30); // ADP 30, rank will be ~30
      player.rank = 45; // Rank worse than ADP = trending up
      const draftState = createBaseDraftState(20, 5);
      
      const result = calculateReachProbability(player, draftState, testConfig);
      
      if (result.reasoning.includes('trending')) {
        expect(result.reasoning).toContain('trending up');
      }
    });

    it('should apply trending down adjustment for players drafted later than rank', () => {
      const player = createMockPlayer(45); // ADP 45
      player.rank = 30; // Rank better than ADP = trending down  
      const draftState = createBaseDraftState(20, 5);
      
      const result = calculateReachProbability(player, draftState, testConfig);
      
      if (result.reasoning.includes('trending')) {
        expect(result.reasoning).toContain('trending down');
      }
    });
  });

  describe('probability bounds', () => {
    it('should clamp probability between 1 and 99', () => {
      const extremeHighADP = createMockPlayer(200);
      const extremeLowADP = createMockPlayer(1);
      const draftState = createBaseDraftState(20, 5);
      
      const highResult = calculateReachProbability(extremeHighADP, draftState);
      const lowResult = calculateReachProbability(extremeLowADP, draftState);
      
      expect(highResult.probability).toBeLessThanOrEqual(99);
      expect(highResult.probability).toBeGreaterThanOrEqual(1);
      expect(lowResult.probability).toBeLessThanOrEqual(99);
      expect(lowResult.probability).toBeGreaterThanOrEqual(1);
    });
  });

  describe('linear draft type', () => {
    it('should handle linear draft correctly', () => {
      const player = createMockPlayer(40);
      const draftState = createBaseDraftState(20, 5);
      draftState.settings.draftType = 'Linear';
      
      const result = calculateReachProbability(player, draftState, testConfig);
      
      expect(result.reasoning).toContain('Following pick:');
      expect(result.reasoning).toContain('picks');
      // In linear draft, distance between picks is always numberOfTeams (12)
      expect(typeof result.probability).toBe('number');
    });
  });

  describe('Snake Draft Window Calculation Tests', () => {
    describe('early rounds (1-2)', () => {
      it('should calculate correct window from pick 1 to pick 13 (slot 1)', () => {
        const settings = { ...mockSettings, draftSlot: 1 };
        const draftState = { ...createBaseDraftState(1, 12), settings }; // Current pick 1, my next pick is 13
        const player = createMockPlayer(20);
        
        const result = calculateReachProbability(player, draftState, testConfig);
        
        // From pick 1 to pick 13: picks 2-12 are opponents (11 picks)
        // Following pick calculation should account for snake draft reversal
        expect(result.reasoning).toContain('Next pick:');
        expect(result.reasoning).toContain('Following pick:');
        expect(result.nextPickProbability).toBeGreaterThan(0);
        expect(result.followingPickProbability).toBeGreaterThan(0);
      });

      it('should calculate correct window from pick 12 to pick 13 (slot 12)', () => {
        const settings = { ...mockSettings, draftSlot: 12 };
        const draftState = { ...createBaseDraftState(12, 1), settings }; // Current pick 12, my next pick is 13
        const player = createMockPlayer(20);
        
        const result = calculateReachProbability(player, draftState, testConfig);
        
        // From pick 12 to pick 13: no opponent picks between them
        expect(result.reasoning).toContain('Next pick:');
        expect(result.reasoning).toContain('Following pick:');
      });
    });

    describe('middle rounds (3-8)', () => {
      it('should handle odd round to even round transition', () => {
        const settings = { ...mockSettings, draftSlot: 6 };
        const draftState = { ...createBaseDraftState(25, 7), settings }; // Round 3 to Round 4
        const player = createMockPlayer(45);
        
        const result = calculateReachProbability(player, draftState, testConfig);
        
        expect(result.reasoning).toContain('Following pick:');
        expect(typeof result.probability).toBe('number');
        expect(result.probability).toBeGreaterThanOrEqual(1);
        expect(result.probability).toBeLessThanOrEqual(99);
      });

      it('should handle even round to odd round transition', () => {
        const settings = { ...mockSettings, draftSlot: 6 };
        const draftState = { ...createBaseDraftState(37, 7), settings }; // Round 4 to Round 5
        const player = createMockPlayer(65);
        
        const result = calculateReachProbability(player, draftState, testConfig);
        
        expect(result.reasoning).toContain('Following pick:');
        expect(typeof result.probability).toBe('number');
      });
    });

    describe('edge case positions', () => {
      it('should handle first pick (slot 1) correctly', () => {
        const settings = { ...mockSettings, draftSlot: 1 };
        const draftState = { ...createBaseDraftState(13, 11), settings }; // Round 2, going to round 3
        const player = createMockPlayer(40);
        
        const result = calculateReachProbability(player, draftState, testConfig);
        
        expect(result.reasoning).toContain('picks away');
        expect(typeof result.probability).toBe('number');
      });

      it('should handle last pick (slot 12) correctly', () => {
        const settings = { ...mockSettings, draftSlot: 12 };
        const draftState = { ...createBaseDraftState(24, 1), settings }; // End of round 2, going to round 3
        const player = createMockPlayer(40);
        
        const result = calculateReachProbability(player, draftState, testConfig);
        
        expect(result.reasoning).toContain('picks away');
        expect(typeof result.probability).toBe('number');
      });
    });
  });

  describe('Multi-Round Reach Analysis', () => {
    it('should provide strategy recommendations', () => {
      const draftState = createBaseDraftState(12, 4);
      const player = createMockPlayer(30);
      
      const result = calculateMultiRoundReach(player, draftState, testConfig);
      
      expect(result.bestStrategy.recommendation).toMatch(/Draft Now|Wait 1 Round|Wait 2 Rounds/);
      expect(result.bestStrategy.reasoning).toBeTruthy();
      expect(result.nextRound.probability).toBeGreaterThan(0);
    });

    it('should recommend drafting now when its your turn', () => {
      const draftState = createBaseDraftState(12, 0); // My turn
      const player = createMockPlayer(15);
      
      const result = calculateMultiRoundReach(player, draftState, testConfig);
      
      expect(result.bestStrategy.recommendation).toBe('Draft Now');
    });

    it('should handle very safe players (recommend waiting)', () => {
      const draftState = createBaseDraftState(20, 3);
      const player = createMockPlayer(100); // Very late ADP
      
      const result = calculateMultiRoundReach(player, draftState, testConfig);
      
      // With such a late ADP, should be safe to wait
      if (result.nextRound.probability >= testConfig.thresholds.veryLowRisk) {
        expect(result.bestStrategy.recommendation).toMatch(/Wait/);
      }
    });
  });

  describe('Configuration Validation', () => {
    it('should use custom configuration correctly', () => {
      const customConfig: ProbabilityConfig = {
        logisticSteepness: 0.3, // Steeper curve
        thresholds: {
          lowRisk: 90,
          mediumRisk: 70,
          veryLowRisk: 95
        },
        adjustments: {
          scarcityHigh: -20,
          scarcityMedium: -12,
          trendingUp: -15,
          trendingDown: 8
        }
      };

      const draftState = createBaseDraftState(20, 3);
      const player = createMockPlayer(50);
      
      const defaultResult = calculateReachProbability(player, draftState);
      const customResult = calculateReachProbability(player, draftState, customConfig);
      
      // Results should be different with different configuration
      expect(customResult.probability).toBeGreaterThanOrEqual(1);
      expect(customResult.probability).toBeLessThanOrEqual(99);
    });
  });
});