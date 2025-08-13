import type { Player, Position, DraftSettings, Team } from '../types';

export interface DynamicVORPCalculator {
  calculateDynamicVORP(player: Player): number;
  getDynamicReplacementLevel(position: Position): number;
  getPositionScarcityMultiplier(position: Position): number;
  getPositionDepthAnalysis(position: Position): PositionDepthAnalysis;
}

export interface PositionDepthAnalysis {
  totalAvailable: number;
  qualityPlayersRemaining: number;
  averageVORPRemaining: number;
  nextTierBreakpoint: number;
  scarcityMultiplier: number;
  isPositionScarce: boolean;
}

export class DynamicVORPEngine implements DynamicVORPCalculator {
  private players: Player[];
  private settings: DraftSettings;
  private allTeams: Team[];

  constructor(players: Player[], settings: DraftSettings, allTeams: Team[]) {
    this.players = players;
    this.settings = settings;
    this.allTeams = allTeams;
  }

  calculateDynamicVORP(player: Player): number {
    // Safety check for valid position
    const validPositions: Position[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
    if (!validPositions.includes(player.position)) {
      console.warn(`Invalid position for player ${player.name}: ${player.position}`);
      return 0;
    }

    // Safety check for projectedPoints
    if (!player.projectedPoints || isNaN(player.projectedPoints)) {
      console.warn(`Player ${player.name} has invalid projectedPoints:`, player.projectedPoints);
      return 0;
    }
    
    const dynamicReplacement = this.getDynamicReplacementLevel(player.position);
    
    // Safety check for replacement level
    if (isNaN(dynamicReplacement)) {
      console.warn(`Invalid replacement level for position ${player.position}:`, dynamicReplacement);
      return 0;
    }
    
    const vorp = player.projectedPoints - dynamicReplacement;
    return Math.max(0, vorp);
  }

  getDynamicReplacementLevel(position: Position): number {
    // Get all available players at this position
    const availableAtPosition = this.players
      .filter(p => p.position === position && !p.isDrafted && !p.isDoNotDraft)
      .sort((a, b) => b.projectedPoints - a.projectedPoints);

    if (availableAtPosition.length === 0) {
      return this.getStaticBaseline(position);
    }

    // Calculate how many more players of this position will be drafted
    const remainingDemand = this.calculateRemainingPositionDemand(position);
    
    // The replacement level is the player who would be the last "startable" player
    // This adjusts based on actual league demand
    const replacementIndex = Math.min(remainingDemand - 1, availableAtPosition.length - 1);
    const replacementIndex_safe = Math.max(0, replacementIndex);

    if (replacementIndex_safe < availableAtPosition.length) {
      return availableAtPosition[replacementIndex_safe].projectedPoints;
    }

    // Fallback to static baseline if we don't have enough players
    return this.getStaticBaseline(position);
  }

  private calculateRemainingPositionDemand(position: Position): number {
    let totalDemand = 0;

    this.allTeams.forEach(team => {
      const currentCount = team.roster[position]?.length || 0;
      const requiredCount = this.settings.rosterSlots[position];
      
      // Basic position need
      const basicNeed = Math.max(0, requiredCount - currentCount);
      totalDemand += basicNeed;

      // Add flex demand for skill positions
      if (['RB', 'WR', 'TE'].includes(position)) {
        const skillPositions: Position[] = ['RB', 'WR', 'TE'];
        const totalSkill = skillPositions.reduce((sum, pos) => 
          sum + (team.roster[pos]?.length || 0), 0
        );
        
        const flexNeeded = (this.settings.rosterSlots.FLEX || 0) + 
                          (this.settings.rosterSlots['W/R/T'] || 0);
        
        const totalSkillNeeded = this.settings.rosterSlots.RB + 
                                this.settings.rosterSlots.WR + 
                                this.settings.rosterSlots.TE + 
                                flexNeeded;
        
        const flexDemand = Math.max(0, totalSkillNeeded - totalSkill);
        // Distribute flex demand proportionally across skill positions
        const positionWeight = this.getPositionFlexWeight(position);
        totalDemand += Math.round(flexDemand * positionWeight);
      }

      // Add superflex demand for QB
      if (position === 'QB') {
        const superflexNeeded = this.settings.rosterSlots.SUPERFLEX || 0;
        totalDemand += Math.max(0, superflexNeeded - Math.max(0, currentCount - requiredCount));
      }

      // Add depth consideration (teams typically draft 1-2 extra at key positions)
      if (['QB', 'RB', 'WR', 'TE'].includes(position)) {
        const depthNeed = this.getPositionDepthNeed(position, currentCount);
        totalDemand += depthNeed;
      }
    });

    return Math.max(1, totalDemand); // At least 1 to avoid division by zero
  }

  private getPositionFlexWeight(position: Position): number {
    // Historical draft patterns for flex positions
    const weights: Record<string, number> = {
      'RB': 0.45,  // RBs are drafted more heavily for flex
      'WR': 0.45,  // WRs are also heavily drafted for flex
      'TE': 0.10   // TEs less commonly used in flex
    };
    return weights[position] || 0;
  }

  private getPositionDepthNeed(position: Position, currentCount: number): number {
    // How many extra players teams typically draft for depth
    const depthTargets: Record<Position, number> = {
      QB: currentCount < 2 ? 1 : 0,  // Most teams want 2 QBs
      RB: currentCount < 4 ? 2 : 1,  // RB depth is crucial
      WR: currentCount < 5 ? 2 : 1,  // WR depth important
      TE: currentCount < 2 ? 1 : 0,  // Most teams want 2 TEs
      K: 0,   // Usually just 1
      DEF: 0  // Usually just 1
    };
    return depthTargets[position] || 0;
  }

  getPositionScarcityMultiplier(position: Position): number {
    const analysis = this.getPositionDepthAnalysis(position);
    
    // Base multiplier on scarcity
    if (analysis.isPositionScarce) {
      return 1.5; // 50% bonus for scarce positions
    }
    
    if (analysis.qualityPlayersRemaining <= 3) {
      return 1.3; // 30% bonus for very limited quality
    }
    
    if (analysis.qualityPlayersRemaining <= 6) {
      return 1.2; // 20% bonus for limited quality
    }
    
    return 1.0; // No bonus
  }

  getPositionDepthAnalysis(position: Position): PositionDepthAnalysis {
    const availableAtPosition = this.players
      .filter(p => p.position === position && !p.isDrafted && !p.isDoNotDraft)
      .sort((a, b) => b.projectedPoints - a.projectedPoints);

    const totalAvailable = availableAtPosition.length;
    const remainingDemand = this.calculateRemainingPositionDemand(position);
    
    // Calculate quality players (those significantly above replacement)
    const dynamicReplacement = this.getDynamicReplacementLevel(position);
    const qualityPlayersRemaining = availableAtPosition.filter(p => 
      p.projectedPoints > dynamicReplacement + 20 // 20+ points above replacement = quality
    ).length;

    // Calculate average VORP of remaining players
    const totalVORP = availableAtPosition.reduce((sum, p) => 
      sum + this.calculateDynamicVORP(p), 0
    );
    const averageVORPRemaining = totalAvailable > 0 ? totalVORP / totalAvailable : 0;

    // Find next tier breakpoint
    const nextTierBreakpoint = this.findNextTierBreakpoint(availableAtPosition);

    // Scarcity calculation
    const demandToSupplyRatio = remainingDemand / Math.max(1, totalAvailable);
    const scarcityMultiplier = Math.min(2.0, 1 + (demandToSupplyRatio - 1) * 0.5);
    const isPositionScarce = demandToSupplyRatio > 1.5 || qualityPlayersRemaining <= 2;

    return {
      totalAvailable,
      qualityPlayersRemaining,
      averageVORPRemaining,
      nextTierBreakpoint,
      scarcityMultiplier,
      isPositionScarce
    };
  }

  private findNextTierBreakpoint(sortedPlayers: Player[]): number {
    if (sortedPlayers.length < 3) return 0;

    // Look for significant drops in projected points
    for (let i = 0; i < sortedPlayers.length - 1; i++) {
      const currentPlayer = sortedPlayers[i];
      const nextPlayer = sortedPlayers[i + 1];
      
      const dropPercentage = (currentPlayer.projectedPoints - nextPlayer.projectedPoints) / 
                            currentPlayer.projectedPoints;
      
      // If there's a >15% drop, that's a tier breakpoint
      if (dropPercentage > 0.15) {
        return i + 1; // Return the position after the drop
      }
    }

    return sortedPlayers.length; // No significant breakpoint found
  }

  private getStaticBaseline(position: Position): number {
    // Fallback static baselines if dynamic calculation fails
    const baselines: Record<Position, number> = {
      QB: 288.4,  // QB12
      RB: 191.8,  // RB24
      WR: 207.0,  // WR30
      TE: 120.0,  // TE12
      K: 140.0,   // K12
      DEF: 130.0  // DEF12
    };
    return baselines[position];
  }
}