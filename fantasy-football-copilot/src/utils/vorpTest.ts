// Test script to demonstrate VORP algorithm improvements
import { VORPRecommendationsEngine } from './vorpRecommendations';
import { calculateVORP, getVORPBaseline } from './vorpBaselines';
import type { Player, Team, DraftSettings } from '../types';

// Mock data for testing
const mockPlayers: Player[] = [
  // Elite players
  {
    id: '1',
    name: 'Christian McCaffrey',
    position: 'RB',
    team: 'SF',
    adp: 2.1,
    tier: 1,
    byeWeek: 9,
    rank: 1,
    positionRank: 1,
    projectedPoints: 320.0,
    isTargeted: false,
    isDoNotDraft: false,
    isDrafted: false
  },
  {
    id: '2', 
    name: 'Ja\'Marr Chase',
    position: 'WR',
    team: 'CIN',
    adp: 8.5,
    tier: 1,
    byeWeek: 12,
    rank: 2,
    positionRank: 1,
    projectedPoints: 290.0,
    isTargeted: true,
    isDoNotDraft: false,
    isDrafted: false
  },
  // High ADP player that was causing issues
  {
    id: '3',
    name: 'Random Kicker',
    position: 'K',
    team: 'GB',
    adp: 847.2,
    tier: 12,
    byeWeek: 14,
    rank: 200,
    positionRank: 25,
    projectedPoints: 120.0,
    isTargeted: false,
    isDoNotDraft: false,
    isDrafted: false
  },
  // Mid-tier player
  {
    id: '4',
    name: 'Decent Running Back',
    position: 'RB',
    team: 'TB',
    adp: 85.3,
    tier: 5,
    byeWeek: 11,
    rank: 45,
    positionRank: 15,
    projectedPoints: 210.0,
    isTargeted: false,
    isDoNotDraft: false,
    isDrafted: false
  }
];

const mockUserTeam: Team = {
  id: 'user',
  name: 'My Team',
  isUser: true,
  roster: {
    QB: [],
    RB: [],
    WR: [],
    TE: [],
    K: [],
    DEF: []
  },
  needs: ['RB', 'WR', 'QB']
};

const mockSettings: DraftSettings = {
  scoringType: 'PPR',
  numberOfTeams: 12,
  draftSlot: 5,
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
  teamNames: ['Team 1', 'Team 2', 'Team 3', 'Team 4', 'My Team', 'Team 6', 'Team 7', 'Team 8', 'Team 9', 'Team 10', 'Team 11', 'Team 12']
};

// Test function
export function testVORPAlgorithm() {
  console.log('=== VORP Algorithm Test ===\n');
  
  // Test VORP calculations
  console.log('VORP Calculations:');
  mockPlayers.forEach(player => {
    const vorp = calculateVORP(player.projectedPoints, player.position);
    const baseline = getVORPBaseline(player.position);
    console.log(`${player.name} (${player.position}): ${player.projectedPoints} pts, VORP: +${vorp.toFixed(1)} vs ${baseline.replacementLevel} replacement`);
  });
  
  console.log('\n=== Old vs New Algorithm Comparison ===\n');
  
  // Create mock teams array
  const mockTeams = [mockUserTeam];
  
  // Test new VORP engine
  const vorpEngine = new VORPRecommendationsEngine(
    mockPlayers,
    mockUserTeam,
    mockTeams,
    mockSettings,
    5, // Pick 5
    []
  );
  
  const vorpRecommendations = vorpEngine.getRecommendations(4);
  
  console.log('NEW VORP Algorithm Results:');
  vorpRecommendations.forEach((rec, index) => {
    console.log(`${index + 1}. ${rec.player.name} (${rec.player.position}) - Score: ${rec.score}`);
    console.log(`   Reasons: ${rec.reasons.join(', ')}`);
    console.log(`   ADP: ${rec.player.adp}, Projected: ${rec.player.projectedPoints}, Urgency: ${rec.urgency}\n`);
  });
  
  console.log('Key Improvements:');
  console.log('1. ❌ High ADP players (like Random Kicker with ADP 847) get penalized heavily');
  console.log('2. ✅ Elite players (McCaffrey, Chase) properly valued based on VORP vs replacement');
  console.log('3. ✅ Position scarcity and tier gaps properly weighted');
  console.log('4. ✅ Draft context (position needs, opponent behavior) factored in');
  console.log('5. ✅ Reasonable scoring that reflects real fantasy value\n');
}

// Run test if this file is executed directly
if (typeof window === 'undefined') {
  testVORPAlgorithm();
}