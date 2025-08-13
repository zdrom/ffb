import type { Player, Team, DraftSettings, Recommendation, Position, DraftPick } from '../types';
import { 
  calculateVORP, 
  getTierValue, 
  isEliteTier, 
  POSITION_SCARCITY_WEIGHTS,
  getVORPBaseline 
} from './vorpBaselines';

export class VORPRecommendationsEngine {
  private players: Player[];
  private userTeam: Team;
  private allTeams: Team[];
  private settings: DraftSettings;
  private currentPick: number;
  private draftPicks: DraftPick[];

  constructor(
    players: Player[], 
    userTeam: Team, 
    allTeams: Team[], 
    settings: DraftSettings, 
    currentPick: number, 
    draftPicks: DraftPick[] = []
  ) {
    this.players = players;
    this.userTeam = userTeam;
    this.allTeams = allTeams;
    this.settings = settings;
    this.currentPick = currentPick;
    this.draftPicks = draftPicks;
  }

  getRecommendations(limit: number = 10): Recommendation[] {
    const availablePlayers = this.players.filter(p => !p.isDrafted && !p.isDoNotDraft);
    
    const scoredPlayers = availablePlayers.map(player => ({
      player,
      score: this.calculateVORPScore(player),
      reasons: this.getVORPReasons(player),
      isValue: this.isVORPValue(player),
      urgency: this.getVORPUrgency(player)
    }));

    return scoredPlayers
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  private calculateVORPScore(player: Player): number {
    // Base VORP calculation
    const baseVORP = calculateVORP(player.projectedPoints, player.position);
    
    // Tier multiplier based on actual 2024 dropoffs
    const tierMultiplier = this.getTierMultiplier(player);
    
    // Position scarcity bonus
    const scarcityBonus = this.getPositionScarcityBonus(player);
    
    // Position need multiplier
    const needMultiplier = this.getPositionNeedMultiplier(player.position);
    
    // Draft context bonuses
    const contextBonus = this.getDraftContextBonus(player);
    
    // ADP value bonus (but capped to prevent ADP 800+ issues)
    const adpBonus = this.getADPValueBonus(player);
    
    // Target player bonus
    const targetBonus = player.isTargeted ? 50 : 0;
    
    // Final score calculation
    const score = (baseVORP * tierMultiplier * needMultiplier) + 
                  scarcityBonus + 
                  contextBonus + 
                  adpBonus + 
                  targetBonus;

    return Math.max(0, Math.round(score));
  }

  private getTierMultiplier(player: Player): number {
    const baseline = getVORPBaseline(player.position);
    const tierValue = getTierValue(player.tier, player.position);
    const replacementValue = baseline.replacementLevel;
    
    // Calculate multiplier based on how much better this tier is than replacement
    const tierAdvantage = (tierValue - replacementValue) / replacementValue;
    
    // Elite players get extra multiplier
    if (isEliteTier(player.projectedPoints, player.position)) {
      return 1.5 + (tierAdvantage * 0.5);
    }
    
    return 1.0 + (tierAdvantage * 0.3);
  }

  private getPositionScarcityBonus(player: Player): number {
    const availableAtPosition = this.players.filter(p => 
      p.position === player.position && !p.isDrafted && !p.isDoNotDraft
    );
    
    // Count elite players remaining
    const eliteRemaining = availableAtPosition.filter(p => 
      isEliteTier(p.projectedPoints, p.position)
    ).length;
    
    // Count players in same tier
    const sameTierRemaining = availableAtPosition.filter(p => 
      p.tier === player.tier
    ).length;
    
    let scarcityBonus = 0;
    
    // Bonus for being last elite player
    if (eliteRemaining === 1 && isEliteTier(player.projectedPoints, player.position)) {
      scarcityBonus += 100;
    }
    
    // Bonus for being last in tier
    if (sameTierRemaining === 1 && player.tier <= 5) {
      scarcityBonus += 75 - (player.tier * 10);
    } else if (sameTierRemaining <= 2 && player.tier <= 3) {
      scarcityBonus += 40 - (player.tier * 5);
    }
    
    // Position-specific scarcity
    const positionWeight = POSITION_SCARCITY_WEIGHTS[player.position];
    scarcityBonus *= positionWeight;
    
    return Math.round(scarcityBonus);
  }

  private getPositionNeedMultiplier(position: Position): number {
    const positionNeed = this.getPositionNeed(position);
    
    switch (positionNeed) {
      case 3: return 1.8; // High need
      case 2: return 1.4; // Medium need  
      case 1: return 1.1; // Low need
      default: return 0.8; // No immediate need
    }
  }

  private getPositionNeed(position: Position): number {
    const currentCount = this.userTeam.roster[position]?.length || 0;
    const requiredCount = this.settings.rosterSlots[position];
    
    // Check flex eligibility
    const skillPositions: Position[] = ['RB', 'WR', 'TE'];
    const flexCount = skillPositions.reduce((sum, pos) => 
      sum + (this.userTeam.roster[pos]?.length || 0), 0
    );
    const flexRequired = (this.settings.rosterSlots.FLEX || 0) + 
                        (this.settings.rosterSlots['W/R/T'] || 0);
    
    // High need: unfilled required positions
    if (currentCount < requiredCount) {
      return 3;
    }
    
    // Medium need: flex positions when flex slots unfilled
    if (skillPositions.includes(position) && flexCount < (requiredCount + flexRequired)) {
      return 2;
    }
    
    // Low need: depth at position
    if (currentCount < requiredCount + 1) {
      return 1;
    }
    
    return 0;
  }

  private getDraftContextBonus(player: Player): number {
    let contextBonus = 0;
    
    // Next pick distance - more valuable if you have to wait longer
    const nextPickGap = this.getPicksUntilNextTurn();
    if (nextPickGap >= 20) {
      contextBonus += 30; // Long wait, grab value now
    } else if (nextPickGap >= 12) {
      contextBonus += 15; // Medium wait
    }
    
    // Opponent targeting bonus
    const opponentDemand = this.getOpponentDemandForPosition(player.position);
    if (opponentDemand >= 3) {
      contextBonus += 25; // High demand from opponents
    } else if (opponentDemand >= 2) {
      contextBonus += 15; // Medium demand
    }
    
    // Positional run detection
    if (this.isPositionalRunActive(player.position)) {
      contextBonus += 20;
    }
    
    return contextBonus;
  }

  private getADPValueBonus(player: Player): number {
    // Cap ADP influence to prevent late-round players from ranking too high
    if (player.adp === 999 || player.adp > 300) {
      return -50; // Penalty for very late ADP
    }
    
    const currentRound = Math.ceil(this.currentPick / this.settings.numberOfTeams);
    const adpRound = Math.ceil(player.adp / this.settings.numberOfTeams);
    const roundsAhead = adpRound - currentRound;
    
    // Only give significant bonuses for reasonable ADP gaps
    if (roundsAhead >= 2) {
      return Math.min(40, roundsAhead * 15); // Cap at 40 points
    } else if (roundsAhead >= 1) {
      return 20;
    } else if (roundsAhead >= 0.5) {
      return 10;
    }
    
    return 0;
  }

  private getPicksUntilNextTurn(): number {
    const totalTeams = this.settings.numberOfTeams;
    const currentRound = Math.ceil(this.currentPick / totalTeams);
    const pickInRound = ((this.currentPick - 1) % totalTeams) + 1;
    
    // In snake draft, calculate picks until next turn
    if (this.settings.draftType === 'Snake') {
      if (currentRound % 2 === 1) {
        // Odd round - picks go 1,2,3...N, then N,N-1,N-2...1
        return (totalTeams - pickInRound) + (totalTeams - pickInRound) + 1;
      } else {
        // Even round - already going backwards
        return (pickInRound - 1) + pickInRound;
      }
    } else {
      // Linear draft
      return totalTeams;
    }
  }

  private getOpponentDemandForPosition(position: Position): number {
    let demand = 0;
    
    this.allTeams.forEach(team => {
      if (team.isUser) return;
      
      const currentCount = team.roster[position]?.length || 0;
      const requiredCount = this.settings.rosterSlots[position];
      
      if (currentCount < requiredCount) {
        demand++;
      }
    });
    
    return demand;
  }

  private isPositionalRunActive(position: Position): boolean {
    const recentPicks = this.draftPicks.slice(-6);
    const positionPicks = recentPicks.filter(pick => 
      pick.player?.position === position
    );
    
    return positionPicks.length >= 3;
  }

  private isVORPValue(player: Player): boolean {
    const vorp = calculateVORP(player.projectedPoints, player.position);
    const adpBonus = this.getADPValueBonus(player);
    
    // Value if significant VORP and reasonable ADP bonus
    return vorp >= 30 && adpBonus >= 20;
  }

  private getVORPReasons(player: Player): string[] {
    const reasons: string[] = [];
    const vorp = calculateVORP(player.projectedPoints, player.position);
    
    // VORP-based reasons
    if (vorp >= 80) {
      reasons.push(`Elite value (+${vorp.toFixed(0)} vs replacement)`);
    } else if (vorp >= 40) {
      reasons.push(`Strong value (+${vorp.toFixed(0)} vs replacement)`);
    } else if (vorp >= 20) {
      reasons.push(`Good value (+${vorp.toFixed(0)} vs replacement)`);
    }
    
    // Position need
    const need = this.getPositionNeed(player.position);
    if (need >= 3) {
      reasons.push(`High need at ${player.position}`);
    } else if (need >= 2) {
      reasons.push(`Flex depth needed`);
    }
    
    // Scarcity
    const scarcityBonus = this.getPositionScarcityBonus(player);
    if (scarcityBonus >= 100) {
      reasons.push('Last elite player at position');
    } else if (scarcityBonus >= 50) {
      reasons.push('Tier about to collapse');
    } else if (scarcityBonus >= 25) {
      reasons.push(`${player.position} getting scarce`);
    }
    
    // ADP value
    const adpBonus = this.getADPValueBonus(player);
    if (adpBonus >= 30) {
      reasons.push('Great ADP value');
    } else if (adpBonus >= 15) {
      reasons.push('Good ADP value');
    }
    
    // Target
    if (player.isTargeted) {
      reasons.push('On your target list');
    }
    
    // Context
    if (this.getOpponentDemandForPosition(player.position) >= 3) {
      reasons.push('High opponent demand');
    }
    
    if (this.isPositionalRunActive(player.position)) {
      reasons.push('Positional run active');
    }
    
    return reasons;
  }

  private getVORPUrgency(player: Player): 'High' | 'Medium' | 'Low' {
    const vorp = calculateVORP(player.projectedPoints, player.position);
    const scarcityBonus = this.getPositionScarcityBonus(player);
    const need = this.getPositionNeed(player.position);
    
    // High urgency
    if (vorp >= 80 || scarcityBonus >= 75 || need >= 3) {
      return 'High';
    }
    
    // Medium urgency  
    if (vorp >= 40 || scarcityBonus >= 30 || need >= 2) {
      return 'Medium';
    }
    
    return 'Low';
  }
}