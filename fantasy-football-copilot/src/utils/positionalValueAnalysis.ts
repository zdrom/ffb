import type { Player, Position, DraftSettings, Team } from '../types';
import { DynamicVORPEngine } from './dynamicVORP';

export interface PositionalValueMetrics {
  player: Player;
  absoluteVORP: number;
  vorpGapToNext: number; // How much better than next best at position
  positionDepthScore: number; // 0-100 scale of position depth
  replacementRisk: 'Low' | 'Medium' | 'High'; // Risk of similar value being available later
  relativeValue: number; // Combined score considering positional context
  positionalRanking: number; // Rank among available players at position
  qualityDropoff: number; // Points difference to 5th best at position
}

export interface PositionalValueAnalysis {
  position: Position;
  availableCount: number;
  qualityTiers: number; // Number of distinct quality tiers remaining
  nextBestVORP: number;
  avgVORPRemaining: number;
  depthScore: number; // 0-100, higher = more depth
}

export class PositionalValueAnalyzer {
  private players: Player[];
  private settings: DraftSettings;
  private teams: Team[];
  private vorpEngine: DynamicVORPEngine;

  constructor(players: Player[], settings: DraftSettings, teams: Team[]) {
    this.players = players;
    this.settings = settings;
    this.teams = teams;
    this.vorpEngine = new DynamicVORPEngine(players, settings, teams);
  }

  analyzePlayerValue(player: Player): PositionalValueMetrics {
    const availableAtPosition = this.getAvailablePlayersAtPosition(player.position);
    const playerVORP = this.vorpEngine.calculateDynamicVORP(player);
    
    // Sort by VORP descending
    const sortedByVORP = availableAtPosition
      .map(p => ({
        player: p,
        vorp: this.vorpEngine.calculateDynamicVORP(p)
      }))
      .sort((a, b) => b.vorp - a.vorp);

    const playerIndex = sortedByVORP.findIndex(p => p.player.id === player.id);
    const positionalRanking = playerIndex + 1;

    // Calculate gap to next best
    const nextBestVORP = playerIndex < sortedByVORP.length - 1 ? 
      sortedByVORP[playerIndex + 1].vorp : 0;
    const vorpGapToNext = playerVORP - nextBestVORP;

    // Calculate position depth score
    const positionDepthScore = this.calculateDepthScore(player.position, availableAtPosition);

    // Calculate replacement risk
    const replacementRisk = this.calculateReplacementRisk(player, availableAtPosition, sortedByVORP);

    // Calculate quality dropoff (to 5th best)
    const fifthBestVORP = sortedByVORP[4]?.vorp || 0;
    const qualityDropoff = playerVORP - fifthBestVORP;

    // Calculate relative value score
    const relativeValue = this.calculateRelativeValue(
      playerVORP,
      vorpGapToNext,
      positionDepthScore,
      replacementRisk,
      positionalRanking
    );

    return {
      player,
      absoluteVORP: playerVORP,
      vorpGapToNext,
      positionDepthScore,
      replacementRisk,
      relativeValue,
      positionalRanking,
      qualityDropoff
    };
  }

  analyzePositionDepth(position: Position): PositionalValueAnalysis {
    const availableAtPosition = this.getAvailablePlayersAtPosition(position);
    
    // Calculate VORPs for all available players
    const playersWithVORP = availableAtPosition
      .map(p => ({
        player: p,
        vorp: this.vorpEngine.calculateDynamicVORP(p)
      }))
      .sort((a, b) => b.vorp - a.vorp);

    const totalVORP = playersWithVORP.reduce((sum, p) => sum + p.vorp, 0);
    const avgVORPRemaining = playersWithVORP.length > 0 ? totalVORP / playersWithVORP.length : 0;
    const nextBestVORP = playersWithVORP[1]?.vorp || 0;

    // Calculate quality tiers (groups with similar VORP values)
    const qualityTiers = this.calculateQualityTiers(playersWithVORP);

    // Calculate depth score
    const depthScore = this.calculateDepthScore(position, availableAtPosition);

    return {
      position,
      availableCount: availableAtPosition.length,
      qualityTiers,
      nextBestVORP,
      avgVORPRemaining,
      depthScore
    };
  }

  getPositionalComparison(): Map<Position, PositionalValueAnalysis> {
    const positions: Position[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
    const comparison = new Map<Position, PositionalValueAnalysis>();

    positions.forEach(position => {
      comparison.set(position, this.analyzePositionDepth(position));
    });

    return comparison;
  }

  getTopValuesByPosition(limit: number = 5): Map<Position, PositionalValueMetrics[]> {
    const positions: Position[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
    const topValues = new Map<Position, PositionalValueMetrics[]>();

    positions.forEach(position => {
      const availableAtPosition = this.getAvailablePlayersAtPosition(position);
      const analyzed = availableAtPosition
        .map(p => this.analyzePlayerValue(p))
        .sort((a, b) => b.relativeValue - a.relativeValue)
        .slice(0, limit);
      
      topValues.set(position, analyzed);
    });

    return topValues;
  }

  private getAvailablePlayersAtPosition(position: Position): Player[] {
    return this.players.filter(p => 
      p.position === position && 
      !p.isDrafted && 
      !p.isDoNotDraft
    );
  }

  private calculateDepthScore(position: Position, availablePlayers: Player[]): number {
    if (availablePlayers.length === 0) return 0;

    // Calculate demand for this position across all teams
    const totalDemand = this.calculateTotalPositionDemand(position);
    const supplyDemandRatio = availablePlayers.length / Math.max(1, totalDemand);

    // Calculate quality distribution
    const playersWithVORP = availablePlayers
      .map(p => this.vorpEngine.calculateDynamicVORP(p))
      .sort((a, b) => b - a);

    // Count players above average quality
    const avgVORP = playersWithVORP.reduce((sum, v) => sum + v, 0) / playersWithVORP.length;
    const qualityPlayersCount = playersWithVORP.filter(v => v > avgVORP * 1.2).length;
    const qualityRatio = qualityPlayersCount / availablePlayers.length;

    // Combine factors into depth score (0-100)
    const baseScore = Math.min(100, supplyDemandRatio * 50);
    const qualityBonus = qualityRatio * 30;
    const volumeBonus = Math.min(20, availablePlayers.length * 2);

    return Math.round(baseScore + qualityBonus + volumeBonus);
  }

  private calculateTotalPositionDemand(position: Position): number {
    let totalDemand = 0;

    this.teams.forEach(team => {
      const currentCount = team.roster[position]?.length || 0;
      const requiredCount = this.settings.rosterSlots[position];
      
      // Basic position need
      totalDemand += Math.max(0, requiredCount - currentCount);

      // Add flex demand for skill positions
      if (['RB', 'WR', 'TE'].includes(position)) {
        const flexNeeded = (this.settings.rosterSlots.FLEX || 0) + 
                          (this.settings.rosterSlots['W/R/T'] || 0);
        
        const skillPositions: Position[] = ['RB', 'WR', 'TE'];
        const totalSkill = skillPositions.reduce((sum, pos) => 
          sum + (team.roster[pos]?.length || 0), 0
        );
        
        const totalSkillNeeded = this.settings.rosterSlots.RB + 
                                this.settings.rosterSlots.WR + 
                                this.settings.rosterSlots.TE + 
                                flexNeeded;
        
        const flexDemand = Math.max(0, totalSkillNeeded - totalSkill);
        totalDemand += Math.round(flexDemand * 0.33); // Distribute across RB/WR/TE
      }

      // Add depth consideration
      if (['QB', 'RB', 'WR', 'TE'].includes(position)) {
        totalDemand += currentCount < 2 ? 1 : 0; // Most teams want depth
      }
    });

    return Math.max(1, totalDemand);
  }

  private calculateReplacementRisk(
    player: Player, 
    availablePlayers: Player[],
    sortedByVORP: Array<{player: Player, vorp: number}>
  ): 'Low' | 'Medium' | 'High' {
    const playerIndex = sortedByVORP.findIndex(p => p.player.id === player.id);
    const playerVORP = sortedByVORP[playerIndex]?.vorp || 0;

    // Count similar quality players (within 20% VORP)
    const similarQualityPlayers = sortedByVORP.filter(p => 
      Math.abs(p.vorp - playerVORP) / playerVORP < 0.2
    ).length;

    // Calculate demand pressure
    const totalDemand = this.calculateTotalPositionDemand(player.position);
    const demandPressure = totalDemand / availablePlayers.length;

    // Determine risk level
    if (similarQualityPlayers <= 2 || demandPressure > 1.5) {
      return 'High'; // Few alternatives, high demand
    } else if (similarQualityPlayers <= 4 || demandPressure > 1.0) {
      return 'Medium'; // Some alternatives, moderate demand
    } else {
      return 'Low'; // Many alternatives, low demand pressure
    }
  }

  private calculateQualityTiers(
    playersWithVORP: Array<{player: Player, vorp: number}>
  ): number {
    if (playersWithVORP.length === 0) return 0;

    let tiers = 1;
    const tierThreshold = 0.15; // 15% drop = new tier

    for (let i = 0; i < playersWithVORP.length - 1; i++) {
      const current = playersWithVORP[i].vorp;
      const next = playersWithVORP[i + 1].vorp;
      
      if (current > 0 && (current - next) / current > tierThreshold) {
        tiers++;
      }
    }

    return tiers;
  }

  private calculateRelativeValue(
    absoluteVORP: number,
    vorpGapToNext: number,
    depthScore: number,
    replacementRisk: 'Low' | 'Medium' | 'High',
    positionalRanking: number
  ): number {
    // Base score from absolute VORP
    let relativeScore = absoluteVORP;

    // Gap bonus - more valuable if significantly better than next option
    const gapMultiplier = vorpGapToNext > 20 ? 1.5 : 
                         vorpGapToNext > 10 ? 1.3 : 
                         vorpGapToNext > 5 ? 1.1 : 1.0;
    relativeScore *= gapMultiplier;

    // Depth penalty - less valuable if position has lots of depth
    const depthPenalty = depthScore > 80 ? 0.8 : 
                        depthScore > 60 ? 0.9 : 
                        depthScore > 40 ? 1.0 : 1.1;
    relativeScore *= depthPenalty;

    // Replacement risk bonus
    const riskBonus = replacementRisk === 'High' ? 40 :
                     replacementRisk === 'Medium' ? 20 : 0;
    relativeScore += riskBonus;

    // Positional ranking bonus (top players at position get extra value)
    const rankingBonus = positionalRanking === 1 ? 30 :
                        positionalRanking === 2 ? 20 :
                        positionalRanking === 3 ? 10 : 0;
    relativeScore += rankingBonus;

    return Math.round(relativeScore);
  }
}