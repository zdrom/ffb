export interface Player {
  id: string;
  name: string;
  position: Position;
  team: string;
  adp: number;
  tier: number;
  byeWeek: number;
  rank: number;
  positionRank: number;
  projectedPoints: number;
  vorp?: number; // VORP value if available
  isTargeted: boolean;
  isDoNotDraft: boolean;
  isDrafted: boolean;
  draftedBy?: string;
  playoffSchedule?: 'Good' | 'Avg' | 'Tough';
}

export interface DraftPick {
  id: string;
  round: number;
  pick: number;
  overall: number;
  team: string;
  player?: Player;
  timestamp: Date;
}

export interface Team {
  id: string;
  name: string;
  isUser: boolean;
  roster: Record<Position, Player[]>;
  needs: Position[];
}

export interface DraftSettings {
  scoringType: 'PPR' | 'Half-PPR' | 'Standard' | 'Custom';
  numberOfTeams: number;
  draftSlot: number;
  numberOfRounds: number;
  draftType: 'Snake' | 'Linear';
  rosterSlots: RosterSlots;
  teamNames: string[];
  customScoring?: CustomScoring;
  positionLimits?: PositionLimits;
}

export interface RosterSlots {
  QB: number;
  RB: number;
  WR: number;
  TE: number;
  FLEX?: number;
  SUPERFLEX?: number;
  'W/R/T'?: number;
  K: number;
  DEF: number;
}

export interface PositionLimits {
  QB: number;
  RB: number;
  WR: number;
  TE: number;
  K: number;
  DEF: number;
}

export interface CustomScoring {
  passing: {
    yards: number;
    touchdowns: number;
    interceptions: number;
    twoPointConversions: number;
  };
  rushing: {
    yards: number;
    touchdowns: number;
    twoPointConversions: number;
  };
  receiving: {
    receptions: number;
    yards: number;
    touchdowns: number;
    twoPointConversions: number;
  };
  misc: {
    fumblesLost: number;
    returnTouchdowns: number;
  };
  kicking: {
    fg0to19: number;
    fg20to29: number;
    fg30to39: number;
    fg40to49: number;
    fg50plus: number;
    patMade: number;
  };
  defense: {
    sack: number;
    interception: number;
    fumbleRecovery: number;
    touchdown: number;
    safety: number;
    blockKick: number;
    returnTouchdown: number;
    extraPointReturned: number;
  };
}

export type Position = 'QB' | 'RB' | 'WR' | 'TE' | 'W/R/T' | 'K' | 'DEF';

export interface PositionalRun {
  position: Position;
  count: number;
  inLastPicks: number;
  isActive: boolean;
}

export interface TierAlert {
  position: Position;
  tier: number;
  remainingPlayers: number;
  isCollapsing: boolean;
}

export interface Recommendation {
  player: Player;
  score: number;
  reasons: string[];
  isValue: boolean;
  urgency: 'High' | 'Medium' | 'Low';
}

export interface DraftState {
  settings: DraftSettings;
  players: Player[];
  teams: Team[];
  picks: DraftPick[];
  currentPick: number;
  isActive: boolean;
  picksUntilMyTurn: number;
  draftId?: string;
}

export interface SimulationResult {
  predictedPicks: DraftPick[];
  availableAtMyTurn: Player[];
  positionsAtRisk: Position[];
}

export interface HandcuffRecommendation {
  primaryPlayer: Player;
  handcuffs: {
    player: Player;
    type: 'Direct' | 'Committee' | 'Insurance';
    priority: 'High' | 'Medium' | 'Low';
    reasoning: string;
  }[];
}

export interface TrendData {
  playerId: string;
  playerName: string;
  position: Position;
  currentADP: number;
  previousADP: number;
  adpChange: number;
  adpTrend: 'Rising' | 'Falling' | 'Stable';
  velocityScore: number; // How quickly they're moving
  lastUpdated: Date;
}

export interface PositionScarcity {
  position: Position;
  tier1Remaining: number;
  tier2Remaining: number;
  tier3Remaining: number;
  avgPicksUntilNextTier: number;
  scarcityLevel: 'Critical' | 'High' | 'Medium' | 'Low';
}