import type { Player, Team, DraftSettings, Position, DraftPick } from '../types';
import type { AIRecommendationContext } from '../services/aiRecommendationService';
import { DynamicVORPEngine } from './dynamicVORP';

export class DraftContextAnalyzer {
  private players: Player[];
  private teams: Team[];
  private settings: DraftSettings;
  private picks: DraftPick[];
  private vorpEngine: DynamicVORPEngine;

  constructor(players: Player[], teams: Team[], settings: DraftSettings, picks: DraftPick[]) {
    this.players = players;
    this.teams = teams;
    this.settings = settings;
    this.picks = picks;
    this.vorpEngine = new DynamicVORPEngine(players, settings, teams);
  }

  buildAIContext(currentPick: number): AIRecommendationContext {
    const userTeam = this.teams.find(t => t.isUser);
    if (!userTeam) {
      throw new Error('User team not found');
    }

    const availablePlayers = this.getAvailablePlayers();
    const topVORPPlayers = this.getTopVORPPlayers(availablePlayers, 20);
    const positionScarcity = this.analyzePositionScarcity(availablePlayers);
    const competitorAnalysis = this.analyzeCompetitors(currentPick);
    const recentPicks = this.getRecentPicks(10);

    return {
      userTeam,
      allTeams: this.teams,
      availablePlayers,
      topVORPPlayers,
      settings: this.settings,
      currentPick,
      recentPicks,
      positionScarcity,
      competitorAnalysis
    };
  }

  private getAvailablePlayers(): Player[] {
    return this.players.filter(p => !p.isDrafted && !p.isDoNotDraft);
  }

  private getTopVORPPlayers(availablePlayers: Player[], limit: number) {
    return availablePlayers
      .map(player => ({
        player,
        vorp: this.vorpEngine.calculateDynamicVORP(player)
      }))
      .sort((a, b) => b.vorp - a.vorp)
      .slice(0, limit);
  }

  private analyzePositionScarcity(availablePlayers: Player[]) {
    const positions: Position[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
    const scarcity: Record<Position, any> = {} as any;

    positions.forEach(position => {
      const positionPlayers = availablePlayers.filter(p => p.position === position);
      const vorps = positionPlayers.map(p => this.vorpEngine.calculateDynamicVORP(p));
      const averageVORP = vorps.length > 0 ? vorps.reduce((sum, vorp) => sum + vorp, 0) / vorps.length : 0;
      
      // Calculate total demand for this position across all teams
      const totalDemand = this.calculateTotalDemand(position);
      const supplyDemandRatio = positionPlayers.length / totalDemand;
      
      let scarcityLevel: 'Low' | 'Medium' | 'High' = 'Low';
      if (supplyDemandRatio < 1.2) scarcityLevel = 'High';
      else if (supplyDemandRatio < 2.0) scarcityLevel = 'Medium';

      scarcity[position] = {
        available: positionPlayers.length,
        averageVORP: averageVORP,
        scarcityLevel,
        supplyDemandRatio
      };
    });

    return scarcity;
  }

  private calculateTotalDemand(position: Position): number {
    const baseSlots = this.settings.rosterSlots[position] || 0;
    
    // Add flex demand for skill positions
    let flexDemand = 0;
    if (['RB', 'WR', 'TE'].includes(position)) {
      flexDemand = (this.settings.rosterSlots.FLEX || 0) + 
                   (this.settings.rosterSlots['W/R/T'] || 0);
      // Distribute flex demand across the three positions
      flexDemand = flexDemand / 3;
    }
    
    return (baseSlots + flexDemand) * this.teams.length;
  }

  private analyzeCompetitors(currentPick: number) {
    return this.teams
      .filter(team => !team.isUser)
      .map(team => {
        const urgentNeeds = this.identifyUrgentNeeds(team);
        const likelyTargets = this.predictLikelyTargets(team, currentPick);
        
        return {
          team,
          likelyTargets,
          urgentNeeds
        };
      });
  }

  private identifyUrgentNeeds(team: Team): Position[] {
    const urgentNeeds: Position[] = [];
    const positions: Position[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];

    positions.forEach(position => {
      const currentCount = team.roster[position]?.length || 0;
      const requiredCount = this.settings.rosterSlots[position] || 0;
      
      // Urgent if completely unfilled required position
      if (currentCount === 0 && requiredCount > 0) {
        urgentNeeds.push(position);
      }
      // Also urgent if significantly behind requirement
      else if (currentCount < requiredCount * 0.7) {
        urgentNeeds.push(position);
      }
    });

    return urgentNeeds;
  }

  private predictLikelyTargets(team: Team, currentPick: number): Position[] {
    const urgentNeeds = this.identifyUrgentNeeds(team);
    if (urgentNeeds.length > 0) return urgentNeeds;

    // If no urgent needs, predict based on draft strategy and value
    const roundNumber = Math.ceil(currentPick / this.settings.numberOfTeams);
    const positions: Position[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
    
    return positions.filter(position => {
      const currentCount = team.roster[position]?.length || 0;
      const requiredCount = this.settings.rosterSlots[position] || 0;
      
      // Still has room for this position
      if (currentCount < requiredCount + 1) return true;
      
      // Early rounds - might stockpile RB/WR
      if (roundNumber <= 8 && ['RB', 'WR'].includes(position)) return true;
      
      return false;
    });
  }

  private getRecentPicks(limit: number): DraftPick[] {
    return this.picks.slice(-limit);
  }

  // Utility method to predict when user picks next
  getPicksUntilUserTurn(currentPick: number): number {
    const currentRound = Math.ceil(currentPick / this.settings.numberOfTeams);
    const pickInRound = ((currentPick - 1) % this.settings.numberOfTeams) + 1;
    const userDraftSlot = this.settings.draftSlot;
    
    if (this.settings.draftType === 'Snake') {
      const isOddRound = currentRound % 2 === 1;
      
      if (isOddRound) {
        // Standard order: 1, 2, 3, ..., 12
        if (pickInRound < userDraftSlot) {
          return userDraftSlot - pickInRound;
        } else {
          // User already picked this round, calculate next round
          const nextRoundPicksUntilUser = this.settings.numberOfTeams - userDraftSlot + 1;
          const picksLeftThisRound = this.settings.numberOfTeams - pickInRound;
          return picksLeftThisRound + nextRoundPicksUntilUser;
        }
      } else {
        // Reverse order: 12, 11, 10, ..., 1
        const reverseUserSlot = this.settings.numberOfTeams - userDraftSlot + 1;
        if (pickInRound < reverseUserSlot) {
          return reverseUserSlot - pickInRound;
        } else {
          // User already picked this round, calculate next round
          const nextRoundPicksUntilUser = userDraftSlot;
          const picksLeftThisRound = this.settings.numberOfTeams - pickInRound;
          return picksLeftThisRound + nextRoundPicksUntilUser;
        }
      }
    } else {
      // Linear draft
      if (pickInRound < userDraftSlot) {
        return userDraftSlot - pickInRound;
      } else {
        const picksLeftThisRound = this.settings.numberOfTeams - pickInRound;
        return picksLeftThisRound + userDraftSlot;
      }
    }
  }

  // Simulate what players might be available when user picks next
  simulatePlayerAvailability(currentPick: number): Player[] {
    const picksUntilUser = this.getPicksUntilUserTurn(currentPick);
    const availablePlayers = this.getAvailablePlayers();
    const topPlayers = this.getTopVORPPlayers(availablePlayers, availablePlayers.length);
    
    // Simple simulation: assume top VORP players get picked
    const likelyToBeDrafted = Math.min(picksUntilUser, topPlayers.length);
    const likelyAvailable = topPlayers.slice(likelyToBeDrafted);
    
    return likelyAvailable.map(({ player }) => player);
  }
}