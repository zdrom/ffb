import type { CustomScoring, Player } from '../types';

// Standard projection data interface (would normally come from API)
interface PlayerProjections {
  passingYards?: number;
  passingTDs?: number;
  interceptions?: number;
  rushingYards?: number;
  rushingTDs?: number;
  receptions?: number;
  receivingYards?: number;
  receivingTDs?: number;
  fumblesLost?: number;
  returnTDs?: number;
  twoPointConversions?: number;
  
  // Kicker stats
  fgAttempts0to19?: number;
  fgMade0to19?: number;
  fgAttempts20to29?: number;
  fgMade20to29?: number;
  fgAttempts30to39?: number;
  fgMade30to39?: number;
  fgAttempts40to49?: number;
  fgMade40to49?: number;
  fgAttempts50plus?: number;
  fgMade50plus?: number;
  patAttempts?: number;
  patMade?: number;
  
  // Defense stats
  sacks?: number;
  defensiveInterceptions?: number;
  fumbleRecoveries?: number;
  defensiveTDs?: number;
  safeties?: number;
  blockedKicks?: number;
  defensiveReturnTDs?: number;
  extraPointsReturned?: number;
}

// Mock projection data - in a real app, this would come from an API
const getMockProjections = (player: Player): PlayerProjections => {
  // Generate realistic projections based on position and ADP
  const rank = player.rank || 999;
  
  switch (player.position) {
    case 'QB':
      if (rank <= 5) {
        return {
          passingYards: 4200 - (rank * 200),
          passingTDs: 32 - (rank * 2),
          interceptions: 10 + rank,
          rushingYards: 400 - (rank * 30),
          rushingTDs: 4 - (rank * 0.5),
          fumblesLost: 3 + rank,
          twoPointConversions: 1
        };
      }
      return {
        passingYards: 3500 - (rank * 50),
        passingTDs: 20 - (rank * 0.5),
        interceptions: 8 + (rank * 0.3),
        rushingYards: Math.max(0, 200 - (rank * 10)),
        rushingTDs: Math.max(0, 2 - (rank * 0.2)),
        fumblesLost: 2 + (rank * 0.2),
        twoPointConversions: 0
      };
      
    case 'RB':
      if (rank <= 12) {
        return {
          rushingYards: 1200 - (rank * 60),
          rushingTDs: 10 - (rank * 0.4),
          receptions: 50 - (rank * 2),
          receivingYards: 400 - (rank * 20),
          receivingTDs: 3 - (rank * 0.1),
          fumblesLost: 2 + (rank * 0.1),
          twoPointConversions: 1
        };
      }
      return {
        rushingYards: Math.max(200, 800 - (rank * 20)),
        rushingTDs: Math.max(2, 8 - (rank * 0.2)),
        receptions: Math.max(10, 40 - (rank * 1)),
        receivingYards: Math.max(50, 300 - (rank * 10)),
        receivingTDs: Math.max(1, 2 - (rank * 0.05)),
        fumblesLost: 1 + (rank * 0.05),
        twoPointConversions: 0
      };
      
    case 'WR':
      if (rank <= 24) {
        return {
          receptions: 80 - (rank * 2),
          receivingYards: 1200 - (rank * 30),
          receivingTDs: 8 - (rank * 0.2),
          rushingYards: 20 - rank,
          rushingTDs: rank <= 12 ? 1 : 0,
          fumblesLost: 1 + (rank * 0.05),
          twoPointConversions: 1
        };
      }
      return {
        receptions: Math.max(30, 70 - (rank * 1)),
        receivingYards: Math.max(400, 1000 - (rank * 15)),
        receivingTDs: Math.max(2, 6 - (rank * 0.1)),
        rushingYards: Math.max(0, 10 - (rank * 0.5)),
        rushingTDs: 0,
        fumblesLost: 1,
        twoPointConversions: 0
      };
      
    case 'TE':
      if (rank <= 8) {
        return {
          receptions: 70 - (rank * 5),
          receivingYards: 800 - (rank * 60),
          receivingTDs: 6 - (rank * 0.5),
          fumblesLost: 1 + (rank * 0.1),
          twoPointConversions: 1
        };
      }
      return {
        receptions: Math.max(25, 60 - (rank * 2)),
        receivingYards: Math.max(300, 700 - (rank * 25)),
        receivingTDs: Math.max(2, 5 - (rank * 0.2)),
        fumblesLost: 1,
        twoPointConversions: 0
      };
      
    case 'K':
      return {
        fgMade0to19: 2 - (rank * 0.1),
        fgMade20to29: 5 - (rank * 0.2),
        fgMade30to39: 8 - (rank * 0.3),
        fgMade40to49: 6 - (rank * 0.2),
        fgMade50plus: 3 - (rank * 0.1),
        patMade: 35 - (rank * 1)
      };
      
    case 'DEF':
      return {
        sacks: 35 - (rank * 2),
        defensiveInterceptions: 12 - rank,
        fumbleRecoveries: 8 - (rank * 0.5),
        defensiveTDs: 2 - (rank * 0.1),
        safeties: 1 - (rank * 0.05),
        blockedKicks: 1 - (rank * 0.05),
        defensiveReturnTDs: 1 - (rank * 0.1),
        extraPointsReturned: rank <= 5 ? 1 : 0
      };
      
    default:
      return {};
  }
};

export const calculateCustomFantasyPoints = (player: Player, customScoring: CustomScoring): number => {
  const projections = getMockProjections(player);
  let points = 0;
  
  // Passing points
  if (projections.passingYards) {
    points += projections.passingYards * customScoring.passing.yards;
  }
  if (projections.passingTDs) {
    points += projections.passingTDs * customScoring.passing.touchdowns;
  }
  if (projections.interceptions) {
    points += projections.interceptions * customScoring.passing.interceptions;
  }
  
  // Rushing points
  if (projections.rushingYards) {
    points += projections.rushingYards * customScoring.rushing.yards;
  }
  if (projections.rushingTDs) {
    points += projections.rushingTDs * customScoring.rushing.touchdowns;
  }
  
  // Receiving points
  if (projections.receptions) {
    points += projections.receptions * customScoring.receiving.receptions;
  }
  if (projections.receivingYards) {
    points += projections.receivingYards * customScoring.receiving.yards;
  }
  if (projections.receivingTDs) {
    points += projections.receivingTDs * customScoring.receiving.touchdowns;
  }
  
  // Misc points
  if (projections.fumblesLost) {
    points += projections.fumblesLost * customScoring.misc.fumblesLost;
  }
  if (projections.returnTDs) {
    points += projections.returnTDs * customScoring.misc.returnTouchdowns;
  }
  
  // Two point conversions (passing, rushing, receiving)
  if (projections.twoPointConversions) {
    points += projections.twoPointConversions * (
      customScoring.passing.twoPointConversions +
      customScoring.rushing.twoPointConversions +
      customScoring.receiving.twoPointConversions
    ) / 3;
  }
  
  // Kicking points
  if (projections.fgMade0to19) points += projections.fgMade0to19 * customScoring.kicking.fg0to19;
  if (projections.fgMade20to29) points += projections.fgMade20to29 * customScoring.kicking.fg20to29;
  if (projections.fgMade30to39) points += projections.fgMade30to39 * customScoring.kicking.fg30to39;
  if (projections.fgMade40to49) points += projections.fgMade40to49 * customScoring.kicking.fg40to49;
  if (projections.fgMade50plus) points += projections.fgMade50plus * customScoring.kicking.fg50plus;
  if (projections.patMade) points += projections.patMade * customScoring.kicking.patMade;
  
  // Defense points
  if (projections.sacks) points += projections.sacks * customScoring.defense.sack;
  if (projections.defensiveInterceptions) points += projections.defensiveInterceptions * customScoring.defense.interception;
  if (projections.fumbleRecoveries) points += projections.fumbleRecoveries * customScoring.defense.fumbleRecovery;
  if (projections.defensiveTDs) points += projections.defensiveTDs * customScoring.defense.touchdown;
  if (projections.safeties) points += projections.safeties * customScoring.defense.safety;
  if (projections.blockedKicks) points += projections.blockedKicks * customScoring.defense.blockKick;
  if (projections.defensiveReturnTDs) points += projections.defensiveReturnTDs * customScoring.defense.returnTouchdown;
  if (projections.extraPointsReturned) points += projections.extraPointsReturned * customScoring.defense.extraPointReturned;
  
  return Math.round(points * 10) / 10; // Round to 1 decimal place
};

export const calculateStandardFantasyPoints = (player: Player, scoringType: 'PPR' | 'Half-PPR' | 'Standard'): number => {
  const projections = getMockProjections(player);
  let points = 0;
  
  // Standard scoring rules
  if (projections.passingYards) points += projections.passingYards * 0.04;
  if (projections.passingTDs) points += projections.passingTDs * 4;
  if (projections.interceptions) points += projections.interceptions * -2;
  
  if (projections.rushingYards) points += projections.rushingYards * 0.1;
  if (projections.rushingTDs) points += projections.rushingTDs * 6;
  
  if (projections.receivingYards) points += projections.receivingYards * 0.1;
  if (projections.receivingTDs) points += projections.receivingTDs * 6;
  
  // PPR scoring for receptions
  if (projections.receptions) {
    if (scoringType === 'PPR') {
      points += projections.receptions * 1;
    } else if (scoringType === 'Half-PPR') {
      points += projections.receptions * 0.5;
    }
    // Standard = 0 points for receptions
  }
  
  if (projections.fumblesLost) points += projections.fumblesLost * -2;
  
  // Kicking (standard)
  if (projections.fgMade0to19) points += projections.fgMade0to19 * 3;
  if (projections.fgMade20to29) points += projections.fgMade20to29 * 3;
  if (projections.fgMade30to39) points += projections.fgMade30to39 * 3;
  if (projections.fgMade40to49) points += projections.fgMade40to49 * 4;
  if (projections.fgMade50plus) points += projections.fgMade50plus * 5;
  if (projections.patMade) points += projections.patMade * 1;
  
  // Defense (standard)
  if (projections.sacks) points += projections.sacks * 1;
  if (projections.defensiveInterceptions) points += projections.defensiveInterceptions * 2;
  if (projections.fumbleRecoveries) points += projections.fumbleRecoveries * 2;
  if (projections.defensiveTDs) points += projections.defensiveTDs * 6;
  if (projections.safeties) points += projections.safeties * 2;
  if (projections.blockedKicks) points += projections.blockedKicks * 2;
  if (projections.defensiveReturnTDs) points += projections.defensiveReturnTDs * 6;
  
  return Math.round(points * 10) / 10;
};

export const recalculatePlayerRankings = (players: Player[], customScoring?: CustomScoring, scoringType: 'PPR' | 'Half-PPR' | 'Standard' | 'Custom' = 'PPR'): Player[] => {
  return players.map(player => {
    let newProjectedPoints: number;
    
    if (scoringType === 'Custom' && customScoring) {
      newProjectedPoints = calculateCustomFantasyPoints(player, customScoring);
    } else {
      newProjectedPoints = calculateStandardFantasyPoints(player, scoringType as 'PPR' | 'Half-PPR' | 'Standard');
    }
    
    return {
      ...player,
      projectedPoints: newProjectedPoints
    };
  }).sort((a, b) => {
    // Sort by projected points (highest first), then by ADP (lowest first) as tiebreaker
    if (Math.abs(a.projectedPoints - b.projectedPoints) < 0.1) {
      return a.adp - b.adp;
    }
    return b.projectedPoints - a.projectedPoints;
  }).map((player, index) => ({
    ...player,
    rank: index + 1
  }));
};