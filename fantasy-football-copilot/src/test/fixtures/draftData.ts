import type { Player, Team, DraftState, DraftSettings } from '../../types';
import type { AIStrategyInput } from '../../types/ai';

export const mockPlayers: Player[] = [
  {
    id: '1',
    name: 'Christian McCaffrey',
    position: 'RB',
    team: 'SF',
    adp: 1.2,
    tier: 1,
    byeWeek: 9,
    rank: 1,
    positionRank: 1,
    projectedPoints: 320,
    vorp: 65.5,
    isTargeted: false,
    isDoNotDraft: false,
    isDrafted: false
  },
  {
    id: '2', 
    name: 'Tyreek Hill',
    position: 'WR',
    team: 'MIA',
    adp: 3.8,
    tier: 1,
    byeWeek: 6,
    rank: 2,
    positionRank: 1,
    projectedPoints: 285,
    vorp: 58.2,
    isTargeted: true,
    isDoNotDraft: false,
    isDrafted: false
  },
  {
    id: '3',
    name: 'Josh Allen',
    position: 'QB',
    team: 'BUF', 
    adp: 12.4,
    tier: 1,
    byeWeek: 12,
    rank: 3,
    positionRank: 1,
    projectedPoints: 378,
    vorp: 45.1,
    isTargeted: false,
    isDoNotDraft: false,
    isDrafted: false
  },
  {
    id: '4',
    name: 'Travis Kelce',
    position: 'TE',
    team: 'KC',
    adp: 18.7,
    tier: 1, 
    byeWeek: 10,
    rank: 4,
    positionRank: 1,
    projectedPoints: 245,
    vorp: 42.8,
    isTargeted: false,
    isDoNotDraft: false,
    isDrafted: true, // Already drafted
    draftedBy: 'Team 2'
  },
  {
    id: '5',
    name: 'Saquon Barkley',
    position: 'RB',
    team: 'PHI',
    adp: 6.2,
    tier: 1,
    byeWeek: 5,
    rank: 5,
    positionRank: 2,
    projectedPoints: 298,
    vorp: 52.1,
    isTargeted: false,
    isDoNotDraft: false,
    isDrafted: false
  }
];

export const mockSettings: DraftSettings = {
  scoringType: 'PPR',
  numberOfTeams: 12,
  draftSlot: 3,
  numberOfRounds: 16,
  draftType: 'Snake',
  teamNames: Array.from({ length: 12 }, (_, i) => `Team ${i + 1}`),
  rosterSlots: {
    QB: 1,
    RB: 2,
    WR: 2,
    TE: 1,
    'W/R/T': 1,
    K: 1,
    DEF: 1
  }
};

export const mockUserTeam: Team = {
  id: 'user-team',
  name: 'My Team',
  isUser: true,
  roster: {
    QB: [],
    RB: [mockPlayers[0]], // Has Christian McCaffrey
    WR: [],
    TE: [],
    K: [],
    DEF: []
  },
  needs: ['QB', 'WR', 'TE', 'K', 'DEF']
};

export const mockAllTeams: Team[] = [
  mockUserTeam,
  {
    id: 'team-2',
    name: 'Team 2', 
    isUser: false,
    roster: {
      QB: [],
      RB: [],
      WR: [],
      TE: [mockPlayers[3]], // Has Travis Kelce
      K: [],
      DEF: []
    },
    needs: ['QB', 'RB', 'WR', 'K', 'DEF']
  }
];

export const mockDraftState: DraftState = {
  settings: mockSettings,
  players: mockPlayers,
  teams: mockAllTeams,
  picks: [
    {
      id: 'pick-1',
      round: 1,
      pick: 1,
      overall: 1,
      team: 'user-team',
      player: mockPlayers[0],
      timestamp: new Date()
    },
    {
      id: 'pick-2', 
      round: 1,
      pick: 2,
      overall: 2,
      team: 'team-2',
      player: mockPlayers[3],
      timestamp: new Date()
    }
  ],
  currentPick: 3,
  isActive: true,
  picksUntilMyTurn: 1
};

export const mockAIStrategyInput: AIStrategyInput = {
  availablePlayers: mockPlayers.filter(p => !p.isDrafted),
  userTeam: mockUserTeam,
  allTeams: mockAllTeams,
  draftState: mockDraftState,
  picksUntilMyTurn: 1,
  probabilities: {
    '2': 0.8, // Tyreek Hill likely available
    '3': 0.6, // Josh Allen moderate chance
    '5': 0.9  // Saquon Barkley very likely
  },
  vorpData: [
    { playerId: '1', vorp: 65.5, position: 'RB', scarcityMultiplier: 1.2 },
    { playerId: '2', vorp: 58.2, position: 'WR', scarcityMultiplier: 1.0 },
    { playerId: '3', vorp: 45.1, position: 'QB', scarcityMultiplier: 0.9 },
    { playerId: '4', vorp: 42.8, position: 'TE', scarcityMultiplier: 1.4 },
    { playerId: '5', vorp: 52.1, position: 'RB', scarcityMultiplier: 1.2 }
  ]
};

export const mockValidAIResponse = {
  topRecommendations: [
    {
      playerId: '2',
      playerName: 'Tyreek Hill', 
      position: 'WR' as const,
      vorp: 58.2,
      explanation: 'Elite WR1, fills key need', // 26 chars
      confidence: 0.9,
      urgency: 'High' as const
    }
  ],
  whatIfForesight: {
    nextPickProbabilities: [
      {
        playerId: '2',
        playerName: 'Tyreek Hill',
        position: 'WR' as const,
        availabilityProbability: 0.8,
        explanation: 'High VORP WR, others might target' // 35 chars
      }
    ],
    recommendedStrategy: 'Draft_Now' as const,
    strategyExplanation: 'Elite talent available now' // 26 chars
  },
  rosterBalance: {
    positionNeeds: [
      {
        position: 'WR' as const,
        urgency: 'High' as const,
        explanation: 'Zero WRs rostered, critical need' // 33 chars
      }
    ],
    tierAlerts: [
      {
        position: 'WR' as const,
        tier: 1,
        playersRemaining: 3,
        isCliff: true,
        explanation: 'Tier 1 WRs scarce after round' // 31 chars
      }
    ],
    byeWeekConcerns: []
  },
  targetAlerts: {
    lastChanceTargets: [
      {
        playerId: '2',
        playerName: 'Tyreek Hill',
        position: 'WR' as const,
        roundsLeft: 2,
        explanation: 'Last chance at elite WR tier', // 30 chars
        priority: 'Must_Draft' as const
      }
    ],
    stackingOpportunities: []
  },
  timestamp: Date.now(),
  confidence: 0.85
};