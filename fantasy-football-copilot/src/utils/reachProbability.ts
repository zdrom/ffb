import type { Player, DraftState } from '../types';
import { calculateMyPickInRounds } from '../contexts/DraftContext';

// Configuration for probability calculations
export interface ProbabilityConfig {
  logisticSteepness: number; // k parameter for logistic function
  thresholds: {
    lowRisk: number;    // >= this % is low risk
    mediumRisk: number; // >= this % is medium risk (below is high risk)
    veryLowRisk: number; // >= this % for 'very safe to wait'
  };
  adjustments: {
    scarcityHigh: number;    // When <= 3 top tier players left
    scarcityMedium: number;  // When <= 5 top tier players left
    trendingUp: number;      // When player trending up
    trendingDown: number;    // When player trending down
    injuryRisk: number;      // When player has injury concerns
    byeWeekImpact: number;   // When player has upcoming bye week
    rookieDiscount: number;  // Additional uncertainty for rookie players
    lateRoundRun: number;    // Position run effect in later rounds
  };
}

const DEFAULT_CONFIG: ProbabilityConfig = {
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
    trendingDown: 5,
    injuryRisk: -8,
    byeWeekImpact: -3,
    rookieDiscount: -5,
    lateRoundRun: -12
  }
};

export interface ReachProbabilityResult {
  probability: number; // Following pick probability (for backward compatibility)
  nextPickProbability: number; // Probability at next pick
  followingPickProbability: number; // Probability at following pick (two picks from now)
  reasoning: string;
  riskLevel: 'Low' | 'Medium' | 'High';
  recommendedAction: 'Wait' | 'Consider Now' | 'Draft Now';
}

export interface MultiRoundReachResult {
  nextRound: ReachProbabilityResult;
  twoRoundsAhead: ReachProbabilityResult;
  bestStrategy: {
    recommendation: 'Draft Now' | 'Wait 1 Round' | 'Wait 2 Rounds';
    reasoning: string;
  };
}

export function calculateReachProbability(
  player: Player,
  draftState: DraftState,
  config: ProbabilityConfig = DEFAULT_CONFIG
): ReachProbabilityResult {
  const { currentPick, picksUntilMyTurn, settings } = draftState;
  const { numberOfTeams, draftSlot, draftType } = settings;

  // --- Calculate both windows: next pick and following pick
  
  // Window to next pick (excluding my actual pick)
  let windowToNext: number;
  if (picksUntilMyTurn === 0) {
    // It's my turn - next pick window is 0 (I can draft now)
    windowToNext = 0;
  } else {
    // Count other teams' picks from now until my next pick (excluding my pick)
    // If current pick is pending, include it; then add (picksUntilMyTurn - 1)
    const isCurrentPickPending = true; // Always true when picksUntilMyTurn > 0
    windowToNext = (isCurrentPickPending ? 1 : 0) + (picksUntilMyTurn - 1);
  }

  // Distance between consecutive picks (excluding my following pick)
  let betweenMyPicks: number;
  if (draftType === 'Snake') {
    const myNextPick = currentPick + picksUntilMyTurn;
    const nextRound = Math.ceil(myNextPick / numberOfTeams);
    const isNextRoundOdd = nextRound % 2 === 1;
    
    if (isNextRoundOdd) {
      // Subtract 1 to exclude my following pick from the count
      betweenMyPicks = 2 * (numberOfTeams - draftSlot) + 1 - 1;
    } else {
      // Subtract 1 to exclude my following pick from the count
      betweenMyPicks = 2 * (draftSlot - 1) + 1 - 1;
    }
  } else {
    // Linear draft: numberOfTeams - 1 (exclude my following pick)
    betweenMyPicks = numberOfTeams - 1;
  }

  // Window to following pick: other teams' picks from now until my following pick  
  const windowToFollowing = windowToNext + betweenMyPicks;

  // --- Calculate probabilities using logistic model
  const adpDeltaFromNow = player.adp - currentPick;
  const k = config.logisticSteepness;

  // Probability available at next pick
  let nextPickBaseProbability: number;
  if (picksUntilMyTurn === 0) {
    // If it's my turn, probability of being available at "next pick" is 100% (I can draft now)
    nextPickBaseProbability = 100;
  } else {
    nextPickBaseProbability = 100 / (1 + Math.exp(k * (windowToNext - adpDeltaFromNow)));
  }

  // Probability available at following pick  
  const followingPickBaseProbability = 100 / (1 + Math.exp(k * (windowToFollowing - adpDeltaFromNow)));

  // Apply all adjustments to both probabilities
  const positionalAdjustment = getPositionalScarcityAdjustment(player, draftState, config);
  const trendAdjustment = getTrendAdjustment(player, config);
  const contextualAdjustment = getContextualAdjustments(player, draftState, config);
  const totalAdjustment = positionalAdjustment.adjustment + trendAdjustment.adjustment + contextualAdjustment.adjustment;

  // Apply adjustments carefully - don't adjust 100% probability when it's my turn  
  let nextPickProbability: number;
  if (picksUntilMyTurn === 0 && nextPickBaseProbability === 100) {
    nextPickProbability = 100; // Keep 100% when it's my turn
  } else {
    nextPickProbability = Math.max(1, Math.min(99, nextPickBaseProbability + totalAdjustment));
  }
  
  let followingPickProbability = Math.max(1, Math.min(99, followingPickBaseProbability + totalAdjustment));

  // --- Build reasoning string
  let reasoning: string;
  if (picksUntilMyTurn === 0) {
    reasoning = `Your turn now. Next pick: 100% (can draft now). Following pick: ${Math.round(followingPickProbability)}% (${windowToFollowing} picks away). ADP ${player.adp.toFixed(1)}`;
  } else {
    reasoning = `Next pick: ${Math.round(nextPickProbability)}% (${windowToNext} picks away). Following pick: ${Math.round(followingPickProbability)}% (${windowToFollowing} picks away). ADP ${player.adp.toFixed(1)}`;
  }
  
  if (adpDeltaFromNow >= 0) {
    reasoning += ` is ${adpDeltaFromNow.toFixed(1)} picks after current pick`;
  } else {
    reasoning += ` is ${Math.abs(adpDeltaFromNow).toFixed(1)} picks before current pick`;
  }

  if (positionalAdjustment.adjustment !== 0) {
    reasoning += `. ${positionalAdjustment.reason}`;
  }

  if (trendAdjustment.adjustment !== 0) {
    reasoning += `. ${trendAdjustment.reason}`;
  }

  // --- Risk assessment based on following pick probability (for main recommendation)
  let riskLevel: 'Low' | 'Medium' | 'High';
  let recommendedAction: 'Wait' | 'Consider Now' | 'Draft Now';

  if (followingPickProbability >= config.thresholds.lowRisk) {
    riskLevel = 'Low';
    recommendedAction = 'Wait';
  } else if (followingPickProbability >= config.thresholds.mediumRisk) {
    riskLevel = 'Medium';
    recommendedAction = 'Consider Now';
  } else {
    riskLevel = 'High';
    recommendedAction = 'Draft Now';
  }

  return {
    probability: Math.round(followingPickProbability), // Backward compatibility
    nextPickProbability: Math.round(nextPickProbability),
    followingPickProbability: Math.round(followingPickProbability),
    reasoning,
    riskLevel,
    recommendedAction
  };
}


function getPositionalScarcityAdjustment(
  player: Player, 
  draftState: DraftState,
  config: ProbabilityConfig
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
      adjustment: config.adjustments.scarcityHigh,
      reason: `Only ${topTierAtPosition.length} top-tier ${player.position}s left`
    };
  }

  if (isTopTier && topTierAtPosition.length <= 5) {
    return {
      adjustment: config.adjustments.scarcityMedium,
      reason: `Limited top-tier ${player.position}s remaining`
    };
  }

  return { adjustment: 0, reason: '' };
}

function getTrendAdjustment(player: Player, config: ProbabilityConfig): { adjustment: number; reason: string } {
  // This would integrate with actual ADP trending data
  // For now, we'll use a simple heuristic based on rank vs ADP
  
  const rankADPDiff = player.adp - player.rank;
  
  if (rankADPDiff < -10) {
    // Player being drafted much earlier than their rank suggests - trending up
    return {
      adjustment: config.adjustments.trendingUp,
      reason: 'Player trending up in drafts'
    };
  }
  
  if (rankADPDiff > 10) {
    // Player being drafted later than their rank suggests - trending down
    return {
      adjustment: config.adjustments.trendingDown,
      reason: 'Player trending down in drafts'
    };
  }

  return { adjustment: 0, reason: '' };
}

function getContextualAdjustments(
  player: Player, 
  draftState: DraftState,
  config: ProbabilityConfig
): { adjustment: number; reason: string } {
  let totalAdjustment = 0;
  const reasons: string[] = [];
  
  // Bye week impact - if player has bye in next few weeks, slightly less likely to be taken now
  if (player.byeWeek && typeof player.byeWeek === 'number') {
    const currentWeek = getCurrentWeek(); // Would need to implement this
    if (currentWeek && player.byeWeek <= currentWeek + 3) {
      totalAdjustment += config.adjustments.byeWeekImpact;
      reasons.push(`Bye week ${player.byeWeek} approaching`);
    }
  }
  
  // Rookie discount - rookies have more uncertainty
  if (isRookiePlayer(player)) {
    totalAdjustment += config.adjustments.rookieDiscount;
    reasons.push('Rookie uncertainty');
  }
  
  // Late round position runs - if we're in later rounds and this position is getting drafted heavily
  const currentRound = Math.ceil(draftState.currentPick / draftState.settings.numberOfTeams);
  if (currentRound >= 8 && isPositionRunHappening(player.position, draftState)) {
    totalAdjustment += config.adjustments.lateRoundRun;
    reasons.push(`${player.position} position run happening`);
  }
  
  // Injury risk adjustment - would require injury status data
  if (hasInjuryConcerns(player)) {
    totalAdjustment += config.adjustments.injuryRisk;
    reasons.push('Injury concerns');
  }
  
  return {
    adjustment: totalAdjustment,
    reason: reasons.join(', ')
  };
}

// Helper functions for contextual adjustments
function getCurrentWeek(): number | null {
  // This would integrate with real NFL week data
  // For now, return null to disable bye week adjustments
  return null;
}

function isRookiePlayer(player: Player): boolean {
  // This would check if player is a rookie
  // Could be based on player data or name patterns
  // For now, return false to disable rookie adjustments
  return false;
}

function isPositionRunHappening(position: string, draftState: DraftState): boolean {
  // Check if multiple players of this position were drafted in recent picks
  const recentPicks = 6; // Look at last 6 picks
  const startPick = Math.max(1, draftState.currentPick - recentPicks);
  
  // This would require access to recent draft picks
  // For now, return false to disable position run adjustments
  return false;
}

function hasInjuryConcerns(player: Player): boolean {
  // This would integrate with injury report data
  // For now, return false to disable injury adjustments
  return false;
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

// Unified logistic probability calculation
function calculateLogisticProbability(
  player: Player,
  currentPick: number,
  windowSize: number,
  config: ProbabilityConfig
): number {
  const adpDeltaFromNow = player.adp - currentPick;
  const k = config.logisticSteepness;
  
  // Base logistic probability
  return 100 / (1 + Math.exp(k * (windowSize - adpDeltaFromNow)));
}

// Calculate window size for snake draft between two picks
function calculateSnakeDraftWindow(
  fromPick: number,
  toPick: number,
  draftSlot: number,
  numberOfTeams: number
): number {
  if (toPick <= fromPick) return 0;
  
  let totalOpponentPicks = 0;
  
  for (let pick = fromPick + 1; pick <= toPick; pick++) {
    const round = Math.ceil(pick / numberOfTeams);
    const positionInRound = ((pick - 1) % numberOfTeams) + 1;
    
    // In snake draft, odd rounds go 1->N, even rounds go N->1
    let actualSlotInRound: number;
    if (round % 2 === 1) {
      // Odd round: normal order
      actualSlotInRound = positionInRound;
    } else {
      // Even round: reverse order
      actualSlotInRound = numberOfTeams - positionInRound + 1;
    }
    
    // Only count picks that aren't mine
    if (actualSlotInRound !== draftSlot) {
      totalOpponentPicks++;
    }
  }
  
  return totalOpponentPicks;
}

export function calculateMultiRoundReach(
  player: Player, 
  draftState: DraftState,
  config: ProbabilityConfig = DEFAULT_CONFIG
): MultiRoundReachResult {
  const { currentPick, settings } = draftState;
  
  if (draftState.picksUntilMyTurn === 0) {
    return {
      nextRound: calculateReachProbability(player, draftState),
      twoRoundsAhead: {
        probability: 0,
        nextPickProbability: 0,
        followingPickProbability: 0,
        reasoning: 'Not applicable - it\'s your turn now',
        riskLevel: 'Low',
        recommendedAction: 'Draft Now'
      },
      bestStrategy: {
        recommendation: 'Draft Now',
        reasoning: 'It\'s your turn - draft now if you want this player'
      }
    };
  }

  // Calculate my picks for the next 2 rounds
  const myFuturePicks = calculateMyPickInRounds(
    currentPick, 
    settings.draftSlot, 
    settings.numberOfTeams, 
    settings.draftType, 
    2
  );

  if (myFuturePicks.length === 0) {
    return {
      nextRound: calculateReachProbability(player, draftState),
      twoRoundsAhead: {
        probability: 0,
        nextPickProbability: 0,
        followingPickProbability: 0,
        reasoning: 'No more picks available',
        riskLevel: 'High',
        recommendedAction: 'Draft Now'
      },
      bestStrategy: {
        recommendation: 'Draft Now',
        reasoning: 'No future picks available'
      }
    };
  }

  const nextPickNum = myFuturePicks[0];
  const secondPickNum = myFuturePicks[1] || null;

  // Calculate probability for next round
  const nextRoundProb = calculateReachProbabilityForPick(
    player, currentPick, nextPickNum, settings.draftSlot, settings.numberOfTeams, settings.draftType, config
  );
  
  // Calculate probability for two rounds ahead (if applicable)
  let twoRoundsProb: ReachProbabilityResult;
  if (secondPickNum) {
    twoRoundsProb = calculateReachProbabilityForPick(
      player, currentPick, secondPickNum, settings.draftSlot, settings.numberOfTeams, settings.draftType, config
    );
  } else {
    twoRoundsProb = {
      probability: 0,
      nextPickProbability: 0,
      followingPickProbability: 0,
      reasoning: 'No second pick available in timeframe',
      riskLevel: 'High',
      recommendedAction: 'Draft Now'
    };
  }

  // Determine best strategy
  const bestStrategy = determineBestStrategy(nextRoundProb, twoRoundsProb, config);

  return {
    nextRound: nextRoundProb,
    twoRoundsAhead: twoRoundsProb,
    bestStrategy
  };
}

function calculateReachProbabilityForPick(
  player: Player, 
  currentPick: number, 
  targetPick: number,
  draftSlot: number = 1,
  numberOfTeams: number = 12,
  draftType: 'Snake' | 'Linear' = 'Snake',
  config: ProbabilityConfig = DEFAULT_CONFIG
): ReachProbabilityResult {
  // Calculate window size (number of opponent picks between now and target)
  let windowSize: number;
  if (draftType === 'Snake') {
    windowSize = calculateSnakeDraftWindow(currentPick, targetPick - 1, draftSlot, numberOfTeams);
  } else {
    // Linear draft: simple calculation
    windowSize = Math.max(0, targetPick - currentPick - 1);
  }
  
  // Use unified logistic probability calculation
  let probability = calculateLogisticProbability(player, currentPick, windowSize, config);
  
  // Apply basic adjustments (simplified for multi-round)
  const rankADPDiff = player.adp - player.rank;
  
  if (rankADPDiff < -10) {
    probability += config.adjustments.trendingUp;
  } else if (rankADPDiff > 10) {
    probability += config.adjustments.trendingDown;
  }
  
  // Add basic contextual adjustments
  if (isRookiePlayer(player)) {
    probability += config.adjustments.rookieDiscount;
  }
  
  // Clamp probability
  probability = Math.max(1, Math.min(99, probability));
  
  // Build reasoning
  const reasoning = `Pick ${targetPick}: ${Math.round(probability)}% chance (${windowSize} opponent picks, ADP ${player.adp.toFixed(1)})`;

  // Determine risk level and recommendation
  let riskLevel: 'Low' | 'Medium' | 'High';
  let recommendedAction: 'Wait' | 'Consider Now' | 'Draft Now';

  if (probability >= config.thresholds.lowRisk) {
    riskLevel = 'Low';
    recommendedAction = 'Wait';
  } else if (probability >= config.thresholds.mediumRisk) {
    riskLevel = 'Medium';
    recommendedAction = 'Consider Now';
  } else {
    riskLevel = 'High';
    recommendedAction = 'Draft Now';
  }

  return {
    probability: Math.round(probability),
    nextPickProbability: Math.round(probability),
    followingPickProbability: Math.round(probability),
    reasoning,
    riskLevel,
    recommendedAction
  };
}

function determineBestStrategy(
  nextRound: ReachProbabilityResult,
  twoRounds: ReachProbabilityResult,
  config: ProbabilityConfig
): { recommendation: 'Draft Now' | 'Wait 1 Round' | 'Wait 2 Rounds'; reasoning: string } {
  
  // If either is very low risk, recommend waiting
  if (twoRounds.probability >= config.thresholds.veryLowRisk) {
    return {
      recommendation: 'Wait 2 Rounds',
      reasoning: `Very safe to wait - ${twoRounds.probability}% chance available in 2 rounds`
    };
  }
  
  if (nextRound.probability >= config.thresholds.veryLowRisk) {
    return {
      recommendation: 'Wait 1 Round', 
      reasoning: `Safe to wait one round - ${nextRound.probability}% chance available`
    };
  }
  
  // If next round is medium risk but two rounds is high risk, wait one round
  if (nextRound.probability >= 50 && twoRounds.probability < 30) {
    return {
      recommendation: 'Wait 1 Round',
      reasoning: `Reasonable chance next round (${nextRound.probability}%), unlikely to last 2 rounds (${twoRounds.probability}%)`
    };
  }
  
  // If both are risky, draft now
  if (nextRound.probability < 50) {
    return {
      recommendation: 'Draft Now',
      reasoning: `Risky to wait - only ${nextRound.probability}% chance available next round`
    };
  }
  
  // Default to waiting one round for medium probabilities
  return {
    recommendation: 'Wait 1 Round',
    reasoning: `Moderate risk - ${nextRound.probability}% chance available next round`
  };
}