import type { Player, Team, DraftSettings, Recommendation, Position, DraftPick } from '../types';
import { DynamicVORPEngine } from './dynamicVORP';

export class VORPOnlyRecommendationsEngine {
  private players: Player[];
  private userTeam: Team;
  private settings: DraftSettings;
  private dynamicVORP: DynamicVORPEngine;

  constructor(
    players: Player[], 
    userTeam: Team, 
    allTeams: Team[], 
    settings: DraftSettings, 
    _currentPick: number, 
    _draftPicks: DraftPick[] = []
  ) {
    this.players = players;
    this.userTeam = userTeam;
    this.settings = settings;
    this.dynamicVORP = new DynamicVORPEngine(players, settings, allTeams);
  }

  getRecommendations(limit: number = 10): Recommendation[] {
    // Double-check that we're filtering out drafted players properly
    const availablePlayers = this.players.filter(p => {
      // Strict checking for drafted status
      const isDrafted = p.isDrafted === true || p.draftedBy !== undefined;
      const isDoNotDraft = p.isDoNotDraft === true;
      
      if (isDrafted && process.env.NODE_ENV === 'development') {
        console.log(`Filtering out drafted player: ${p.name} (isDrafted: ${p.isDrafted}, draftedBy: ${p.draftedBy})`);
      }
      
      return !isDrafted && !isDoNotDraft;
    });
    
    if (availablePlayers.length === 0) {
      console.warn('No available players found for recommendations');
      return [];
    }
    
    console.log(`Found ${availablePlayers.length} available players for VORP recommendations`);
    
    const scoredPlayers = availablePlayers.map(player => ({
      player,
      score: this.calculateVORPOnlyScore(player),
      reasons: this.getVORPOnlyReasons(player),
      isValue: this.isVORPValue(player),
      urgency: this.getVORPUrgency(player)
    }));

    return scoredPlayers
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  getBestVORPByPosition(): Record<Position, { player: Player; vorp: number } | null> {
    const positions: Position[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
    const result: Record<Position, { player: Player; vorp: number } | null> = {} as any;

    positions.forEach(position => {
      const availableAtPosition = this.players
        .filter(p => p.position === position && !p.isDrafted && !p.isDoNotDraft)
        .sort((a, b) => b.projectedPoints - a.projectedPoints); // Higher projected points = higher VORP

      if (availableAtPosition.length > 0) {
        const bestPlayer = availableAtPosition[0];
        const vorp = this.calculateVORP(bestPlayer);
        result[position] = { player: bestPlayer, vorp };
      } else {
        result[position] = null;
      }
    });

    return result;
  }

  getVORPChangesAfterDraft(draftedPlayer: Player): Record<Position, number> {
    const changes: Record<Position, number> = {} as any;
    const positions: Position[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];

    positions.forEach(position => {
      if (position === draftedPlayer.position) {
        // Find the next best player at this position
        const availableAtPosition = this.players
          .filter(p => p.position === position && !p.isDrafted && !p.isDoNotDraft && p.id !== draftedPlayer.id)
          .sort((a, b) => b.projectedPoints - a.projectedPoints);

        if (availableAtPosition.length > 0) {
          const nextBest = availableAtPosition[0];
          const currentVORP = this.calculateVORP(draftedPlayer);
          const nextVORP = this.calculateVORP(nextBest);
          changes[position] = nextVORP - currentVORP; // Negative value shows the drop
        } else {
          changes[position] = -this.calculateVORP(draftedPlayer); // All VORP lost
        }
      } else {
        changes[position] = 0; // No change for other positions
      }
    });

    return changes;
  }

  private calculateVORPOnlyScore(player: Player): number {
    // Pure dynamic VORP - no multipliers or bonuses
    const dynamicVORP = this.dynamicVORP.calculateDynamicVORP(player);
    
    // Round to 1 decimal place for clean display
    return Math.round(dynamicVORP * 10) / 10;
  }

  private calculateVORP(player: Player): number {
    // Use dynamic VORP calculation
    return this.dynamicVORP.calculateDynamicVORP(player);
  }

  private getTierBreakpointBonus(player: Player, depthAnalysis: any): number {
    const availableAtPosition = this.players
      .filter(p => p.position === player.position && !p.isDrafted && !p.isDoNotDraft)
      .sort((a, b) => b.projectedPoints - a.projectedPoints);

    const playerIndex = availableAtPosition.findIndex(p => p.id === player.id);
    
    // If this player is just before a tier breakpoint, give bonus
    if (playerIndex >= 0 && playerIndex === depthAnalysis.nextTierBreakpoint - 1) {
      return 75; // Large bonus for being the last before a drop
    }
    
    // If this player is in the last few quality players
    if (depthAnalysis.qualityPlayersRemaining <= 3 && playerIndex < depthAnalysis.qualityPlayersRemaining) {
      return 40; // Medium bonus for limited quality remaining
    }
    
    return 0;
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

  private getPositionNeedMultiplier(need: number): number {
    switch (need) {
      case 3: return 1.8; // High need
      case 2: return 1.4; // Medium need  
      case 1: return 1.1; // Low need
      default: return 0.8; // No immediate need
    }
  }

  private getPositionScarcityBonus(player: Player): number {
    // This is now handled by the dynamic scarcity multiplier in calculateVORPOnlyScore
    // Keep this method for backward compatibility but use dynamic analysis
    const depthAnalysis = this.dynamicVORP.getPositionDepthAnalysis(player.position);
    
    const availableAtPosition = this.players
      .filter(p => p.position === player.position && !p.isDrafted && !p.isDoNotDraft)
      .sort((a, b) => this.calculateVORP(b) - this.calculateVORP(a));

    const playerIndex = availableAtPosition.findIndex(p => p.id === player.id);
    
    // Bonus for being the best available at position
    if (playerIndex === 0) {
      return depthAnalysis.isPositionScarce ? 100 : 50;
    }

    // Bonus for being in top few at scarce positions
    if (depthAnalysis.isPositionScarce && playerIndex < 3) {
      return 60 - (playerIndex * 20);
    }

    return 0;
  }

  private isVORPValue(player: Player): boolean {
    const vorp = this.calculateVORP(player);
    
    // Consider it value if VORP is significantly positive
    return vorp >= 30;
  }

  private getVORPOnlyReasons(player: Player): string[] {
    const reasons: string[] = [];
    const vorp = this.calculateVORP(player);
    const depthAnalysis = this.dynamicVORP.getPositionDepthAnalysis(player.position);
    const dynamicReplacement = this.dynamicVORP.getDynamicReplacementLevel(player.position);
    
    // Dynamic VORP-based reasons
    if (vorp >= 100) {
      reasons.push(`Elite VORP: +${vorp.toFixed(0)} vs current replacement`);
    } else if (vorp >= 60) {
      reasons.push(`Strong VORP: +${vorp.toFixed(0)} vs current replacement`);
    } else if (vorp >= 30) {
      reasons.push(`Good VORP: +${vorp.toFixed(0)} vs current replacement`);
    } else if (vorp >= 10) {
      reasons.push(`Moderate VORP: +${vorp.toFixed(0)} vs current replacement`);
    } else {
      reasons.push(`Low VORP: +${vorp.toFixed(0)} vs current replacement`);
    }
    
    // Position scarcity and depth analysis
    if (depthAnalysis.isPositionScarce) {
      reasons.push(`${player.position} position is scarce (${depthAnalysis.totalAvailable} left)`);
    }
    
    if (depthAnalysis.qualityPlayersRemaining <= 3 && depthAnalysis.qualityPlayersRemaining > 0) {
      reasons.push(`Only ${depthAnalysis.qualityPlayersRemaining} quality ${player.position}s left`);
    }
    
    // Tier breakpoint warning
    const availableAtPosition = this.players
      .filter(p => p.position === player.position && !p.isDrafted && !p.isDoNotDraft)
      .sort((a, b) => b.projectedPoints - a.projectedPoints);
    const playerIndex = availableAtPosition.findIndex(p => p.id === player.id);
    
    if (playerIndex >= 0 && playerIndex === depthAnalysis.nextTierBreakpoint - 1) {
      reasons.push('Last player before significant talent drop');
    }
    
    // Position need
    const need = this.getPositionNeed(player.position);
    if (need >= 3) {
      reasons.push(`High need at ${player.position}`);
    } else if (need >= 2) {
      reasons.push(`Flex depth needed`);
    }
    
    // Target
    if (player.isTargeted) {
      reasons.push('On your target list');
    }
    
    return reasons;
  }

  private getVORPUrgency(player: Player): 'High' | 'Medium' | 'Low' {
    const vorp = this.calculateVORP(player);
    const scarcityBonus = this.getPositionScarcityBonus(player);
    const need = this.getPositionNeed(player.position);
    
    // High urgency
    if (vorp >= 100 || scarcityBonus >= 100 || need >= 3) {
      return 'High';
    }
    
    // Medium urgency  
    if (vorp >= 50 || scarcityBonus >= 35 || need >= 2) {
      return 'Medium';
    }
    
    return 'Low';
  }
}