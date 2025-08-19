import type { Player, DraftState } from '../types';

export interface ReachProbabilityResult {
  probability: number;
  reasoning: string;
  riskLevel: 'Low' | 'Medium' | 'High';
  recommendedAction: 'Wait' | 'Consider Now' | 'Draft Now';
}

export function calculateReachProbability(
  player: Player, 
  draftState: DraftState
): ReachProbabilityResult {
  const { currentPick, picksUntilMyTurn } = draftState;
  
  if (picksUntilMyTurn === 0) {
    return {
      probability: 100,
      reasoning: 'It\'s your turn - you can draft this player now',
      riskLevel: 'Low',
      recommendedAction: 'Draft Now'
    };
  }

  const myNextPick = currentPick + picksUntilMyTurn;
  const playerADP = player.adp;
  
  // Base probability calculation
  let probability: number;
  let reasoning: string;
  
  if (playerADP >= myNextPick + 5) {
    // Player's ADP is well after my next pick
    probability = Math.min(95, 85 + ((playerADP - myNextPick) / 10));
    reasoning = `ADP (${playerADP.toFixed(1)}) is ${(playerADP - myNextPick).toFixed(1)} picks after your next pick`;
  } else if (playerADP >= myNextPick) {
    // Player's ADP is around my next pick
    const adpDiff = playerADP - myNextPick;
    probability = 70 + (adpDiff * 5);
    reasoning = `ADP (${playerADP.toFixed(1)}) is ${adpDiff.toFixed(1)} picks after your next pick`;
  } else {
    // Player's ADP is before my next pick - risky
    const adpDiff = myNextPick - playerADP;
    probability = Math.max(10, 60 - (adpDiff * 8));
    reasoning = `ADP (${playerADP.toFixed(1)}) is ${adpDiff.toFixed(1)} picks before your next pick`;
  }

  // Adjust for position scarcity
  const positionalAdjustment = getPositionalScarcityAdjustment(player, draftState);
  probability = Math.max(5, Math.min(95, probability + positionalAdjustment.adjustment));
  
  if (positionalAdjustment.adjustment !== 0) {
    reasoning += `. ${positionalAdjustment.reason}`;
  }

  // Adjust for trending players
  const trendAdjustment = getTrendAdjustment(player);
  probability = Math.max(5, Math.min(95, probability + trendAdjustment.adjustment));
  
  if (trendAdjustment.adjustment !== 0) {
    reasoning += `. ${trendAdjustment.reason}`;
  }

  // Determine risk level and recommendation
  let riskLevel: 'Low' | 'Medium' | 'High';
  let recommendedAction: 'Wait' | 'Consider Now' | 'Draft Now';

  if (probability >= 75) {
    riskLevel = 'Low';
    recommendedAction = 'Wait';
  } else if (probability >= 45) {
    riskLevel = 'Medium';
    recommendedAction = 'Consider Now';
  } else {
    riskLevel = 'High';
    recommendedAction = 'Draft Now';
  }

  return {
    probability: Math.round(probability),
    reasoning,
    riskLevel,
    recommendedAction
  };
}

function getPositionalScarcityAdjustment(
  player: Player, 
  draftState: DraftState
): { adjustment: number; reason: string } {
  const availableAtPosition = draftState.players.filter(
    p => p.position === player.position && !p.isDrafted && !p.isDoNotDraft
  );

  const topTierAtPosition = availableAtPosition
    .sort((a, b) => a.rank - b.rank)
    .slice(0, getPositionTierSize(player.position));

  const isTopTier = topTierAtPosition.some(p => p.id === player.id);
  
  if (isTopTier && topTierAtPosition.length <= 3) {
    return {
      adjustment: -15,
      reason: `Only ${topTierAtPosition.length} top-tier ${player.position}s left`
    };
  }

  if (isTopTier && topTierAtPosition.length <= 5) {
    return {
      adjustment: -8,
      reason: `Limited top-tier ${player.position}s remaining`
    };
  }

  return { adjustment: 0, reason: '' };
}

function getTrendAdjustment(player: Player): { adjustment: number; reason: string } {
  // This would integrate with actual ADP trending data
  // For now, we'll use a simple heuristic based on rank vs ADP
  
  const rankADPDiff = player.adp - player.rank;
  
  if (rankADPDiff < -10) {
    // Player being drafted much earlier than their rank suggests - trending up
    return {
      adjustment: -10,
      reason: 'Player trending up in drafts'
    };
  }
  
  if (rankADPDiff > 10) {
    // Player being drafted later than their rank suggests - trending down
    return {
      adjustment: 5,
      reason: 'Player trending down in drafts'
    };
  }

  return { adjustment: 0, reason: '' };
}

function getPositionTierSize(position: string): number {
  const tierSizes: Record<string, number> = {
    QB: 12,  // QB1-QB12
    RB: 24,  // RB1-RB24  
    WR: 30,  // WR1-WR30
    TE: 12,  // TE1-TE12
    K: 12,   // K1-K12
    DEF: 12  // DEF1-DEF12
  };
  
  return tierSizes[position] || 12;
}