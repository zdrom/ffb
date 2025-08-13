import type { Position } from '../types';

export interface VORPBaseline {
  position: Position;
  replacementLevel: number; // Fantasy points for replacement player
  tierDropoffs: Record<number, number>; // Average points by tier
  eliteThreshold: number; // Points threshold for elite tier
}

// 2024 VORP baselines calculated from actual data
export const VORP_BASELINES: Record<Position, VORPBaseline> = {
  QB: {
    position: 'QB',
    replacementLevel: 288.4, // QB12 (Justin Herbert)
    tierDropoffs: {
      1: 409.7, // Elite tier (Lamar, Allen)
      2: 355.6, // Tier 1 QBs
      3: 320.0, // Mid-tier QBs
      4: 288.4, // Replacement level
      5: 250.0  // Streaming QBs
    },
    eliteThreshold: 350.0
  },
  RB: {
    position: 'RB',
    replacementLevel: 191.8, // RB24 (J.K. Dobbins)
    tierDropoffs: {
      1: 341.7, // Elite RB1s (Bijan)
      2: 359.1, // Top RB1s (Gibbs, Saquon)
      3: 299.9, // Mid RB1s
      4: 274.7, // RB2s
      5: 239.9, // Flex RBs
      6: 191.8  // Replacement level
    },
    eliteThreshold: 300.0
  },
  WR: {
    position: 'WR',
    replacementLevel: 207.0, // Estimated WR30
    tierDropoffs: {
      1: 350.0, // Elite WR1s (Chase)
      2: 285.0, // Top WR1s
      3: 250.0, // Mid WR1s
      4: 220.0, // WR2s
      5: 207.0, // Replacement level
      6: 180.0  // Waiver wire
    },
    eliteThreshold: 280.0
  },
  TE: {
    position: 'TE',
    replacementLevel: 120.0, // TE12 (actual TEs)
    tierDropoffs: {
      1: 180.0, // Elite TEs (Kelce tier)
      2: 150.0, // Good TEs
      3: 130.0, // Decent TEs
      4: 120.0, // Replacement level
      5: 100.0  // Streaming TEs
    },
    eliteThreshold: 160.0
  },
  K: {
    position: 'K',
    replacementLevel: 140.0, // K12
    tierDropoffs: {
      1: 160.0,
      2: 150.0,
      3: 140.0,
      4: 130.0,
      5: 120.0
    },
    eliteThreshold: 155.0
  },
  DEF: {
    position: 'DEF',
    replacementLevel: 130.0, // DEF12
    tierDropoffs: {
      1: 170.0,
      2: 150.0,
      3: 140.0,
      4: 130.0,
      5: 120.0
    },
    eliteThreshold: 160.0
  }
};

export function getVORPBaseline(position: Position): VORPBaseline {
  return VORP_BASELINES[position];
}

export function calculateVORP(projectedPoints: number, position: Position): number {
  const baseline = getVORPBaseline(position);
  return Math.max(0, projectedPoints - baseline.replacementLevel);
}

export function getTierValue(tier: number, position: Position): number {
  const baseline = getVORPBaseline(position);
  return baseline.tierDropoffs[tier] || baseline.replacementLevel;
}

export function isEliteTier(projectedPoints: number, position: Position): boolean {
  const baseline = getVORPBaseline(position);
  return projectedPoints >= baseline.eliteThreshold;
}

// Position scarcity weights based on 2024 analysis
export const POSITION_SCARCITY_WEIGHTS: Record<Position, number> = {
  RB: 1.3,  // Highest scarcity - big dropoffs
  QB: 1.1,  // High scarcity in superflex
  TE: 1.2,  // High scarcity after elite tier
  WR: 1.0,  // Most depth
  K: 0.8,   // Minimal scarcity
  DEF: 0.8  // Minimal scarcity
};