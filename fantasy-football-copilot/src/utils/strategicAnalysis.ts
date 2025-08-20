import type { Player, Position, Team, DraftState } from '../types';
import type { AIStrategyInput, CandidateFeature } from '../types/ai';

export interface OpponentAnalysis {
  teamId: string;
  teamName: string;
  rosterNeeds: Position[];
  positionStrengths: Position[];
  picksUntilTheirTurn: number;
  likelyTargets: string[];
}

export interface PositionalDepthAnalysis {
  tier1Available: number;
  tier2Available: number;
  tier3Available: number;
  dropoffAfterTier: number;
}

export interface ScenarioAnalysis {
  nextFewPicks: number;
  positionDepthByTier: Record<Position, PositionalDepthAnalysis>;
  competitivePositions: Position[];
}

export class StrategicAnalysisEngine {
  private players: Player[];
  private teams: Team[];
  private draftState: DraftState;
  
  constructor(
    players: Player[],
    teams: Team[],
    draftState: DraftState
  ) {
    this.players = players;
    this.teams = teams;
    this.draftState = draftState;
  }

  analyzeOpponentRosters(): OpponentAnalysis[] {
    const userTeam = this.teams.find(t => t.isUser);
    if (!userTeam) return [];

    return this.teams
      .filter(team => !team.isUser && team.id !== userTeam.id)
      .map(team => this.analyzeTeam(team));
  }

  private analyzeTeam(team: Team): OpponentAnalysis {
    const rosterNeeds = this.calculateRosterNeeds(team);
    const positionStrengths = this.calculatePositionStrengths(team);
    const picksUntilTheirTurn = this.calculatePicksUntilTeamTurn(team);
    const likelyTargets = this.predictLikelyTargets(team, rosterNeeds);

    return {
      teamId: team.id,
      teamName: team.name,
      rosterNeeds,
      positionStrengths,
      picksUntilTheirTurn,
      likelyTargets
    };
  }

  private calculateRosterNeeds(team: Team): Position[] {
    const needs: Position[] = [];
    const roster = team.roster;
    const slots = this.draftState.settings.rosterSlots;

    Object.entries(slots).forEach(([position, requiredCount]) => {
      if (position === 'W/R/T' || position === 'FLEX' || position === 'SUPERFLEX') return;
      
      const currentCount = roster[position as Position]?.length || 0;
      if (currentCount < requiredCount) {
        needs.push(position as Position);
      }
    });

    // Add depth needs for key positions
    const flexPositions: Position[] = ['RB', 'WR', 'TE'];
    flexPositions.forEach(pos => {
      const currentCount = roster[pos]?.length || 0;
      const minDepth = pos === 'TE' ? 2 : 3; // Want at least 2 TEs, 3 RBs/WRs
      
      if (currentCount < minDepth && !needs.includes(pos)) {
        needs.push(pos);
      }
    });

    return needs;
  }

  private calculatePositionStrengths(team: Team): Position[] {
    const strengths: Position[] = [];
    const roster = team.roster;
    const slots = this.draftState.settings.rosterSlots;

    Object.entries(slots).forEach(([position, requiredCount]) => {
      if (position === 'W/R/T' || position === 'FLEX' || position === 'SUPERFLEX') return;
      
      const currentPlayers = roster[position as Position] || [];
      const filledRatio = currentPlayers.length / requiredCount;
      
      // Consider it a strength if they have 150%+ of required slots filled
      // and the average VORP is above threshold
      if (filledRatio >= 1.5) {
        const avgVorp = currentPlayers.reduce((sum, p) => sum + (p.vorp || 0), 0) / currentPlayers.length;
        if (avgVorp > 5) { // Threshold for "good" players
          strengths.push(position as Position);
        }
      }
    });

    return strengths;
  }

  private calculatePicksUntilTeamTurn(team: Team): number {
    // This would need actual draft order logic
    // For now, using a simplified calculation
    const currentPick = this.draftState.currentPick;
    const totalTeams = this.draftState.settings.numberOfTeams;
    
    // Simple approximation - would need actual draft order
    // Using team index as draft position for now
    const teamIndex = this.teams.findIndex(t => t.id === team.id);
    return Math.abs(teamIndex - (currentPick % totalTeams)) || totalTeams;
  }

  private predictLikelyTargets(_team: Team, needs: Position[]): string[] {
    const availablePlayers = this.players.filter(p => !p.isDrafted && !p.isDoNotDraft);
    
    // Get top players at needed positions, sorted by VORP
    const targets = availablePlayers
      .filter(p => needs.includes(p.position))
      .sort((a, b) => (b.vorp || 0) - (a.vorp || 0))
      .slice(0, 5) // Top 5 targets per team
      .map(p => p.id);

    return targets;
  }

  analyzePositionalDepth(): ScenarioAnalysis {
    const availablePlayers = this.players.filter(p => !p.isDrafted && !p.isDoNotDraft);
    const nextFewPicks = Math.min(10, this.draftState.settings.numberOfTeams * 2); // Look ahead 2 rounds max
    
    const positionDepthByTier: Record<Position, PositionalDepthAnalysis> = {} as any;
    const positions: Position[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
    
    positions.forEach(position => {
      const posPlayers = availablePlayers.filter(p => p.position === position);
      
      // Categorize by tier (assuming tier property exists)
      const tier1 = posPlayers.filter(p => p.tier === 1);
      const tier2 = posPlayers.filter(p => p.tier === 2);
      const tier3 = posPlayers.filter(p => p.tier === 3);
      
      // Calculate dropoff (difference in average VORP between tiers)
      const tier1AvgVorp = tier1.reduce((sum, p) => sum + (p.vorp || 0), 0) / Math.max(tier1.length, 1);
      const tier2AvgVorp = tier2.reduce((sum, p) => sum + (p.vorp || 0), 0) / Math.max(tier2.length, 1);
      const tier3AvgVorp = tier3.reduce((sum, p) => sum + (p.vorp || 0), 0) / Math.max(tier3.length, 1);
      
      const dropoffAfterTier = Math.max(
        tier1AvgVorp - tier2AvgVorp,
        tier2AvgVorp - tier3AvgVorp
      );
      
      positionDepthByTier[position] = {
        tier1Available: tier1.length,
        tier2Available: tier2.length,
        tier3Available: tier3.length,
        dropoffAfterTier
      };
    });
    
    // Identify competitive positions (where multiple teams have needs)
    const opponentAnalysis = this.analyzeOpponentRosters();
    const competitivePositions: Position[] = [];
    
    positions.forEach(position => {
      const teamsNeedingPosition = opponentAnalysis.filter(
        team => team.rosterNeeds.includes(position)
      ).length;
      
      if (teamsNeedingPosition >= 2) { // 2+ teams competing for this position
        competitivePositions.push(position);
      }
    });

    return {
      nextFewPicks,
      positionDepthByTier,
      competitivePositions
    };
  }

  calculateOpportunityCost(player: Player, analysis: ScenarioAnalysis): number {
    const position = player.position;
    const depthAnalysis = analysis.positionDepthByTier[position];
    
    // High opportunity cost if:
    // 1. Limited tier 1/2 players left
    // 2. Position is competitive
    // 3. Large dropoff after current tier
    
    let cost = 0;
    
    // Factor 1: Scarcity
    const totalQualityPlayers = depthAnalysis.tier1Available + depthAnalysis.tier2Available;
    if (totalQualityPlayers <= 3) cost += 0.4;
    else if (totalQualityPlayers <= 6) cost += 0.2;
    
    // Factor 2: Competition
    if (analysis.competitivePositions.includes(position)) {
      cost += 0.3;
    }
    
    // Factor 3: Dropoff
    if (depthAnalysis.dropoffAfterTier > 10) cost += 0.3; // Large VORP dropoff
    else if (depthAnalysis.dropoffAfterTier > 5) cost += 0.15;
    
    return Math.min(cost, 1.0); // Cap at 1.0
  }

  generateEnhancedInput(baseInput: Omit<AIStrategyInput, 'candidates' | 'tierCountsRemaining' | 'opponentWindows' | 'positionAlerts' | 'playstyle' | 'scoringWeights'>): AIStrategyInput {
    // Filter to top players and convert to enhanced candidates
    const filteredPlayers = this.filterTopPlayers(baseInput.availablePlayers);
    const candidates = this.buildCandidateFeatures(filteredPlayers, baseInput);
    
    // Enhanced analysis
    const tierCountsRemaining = this.calculateTierCounts(baseInput.availablePlayers);
    const opponentWindows = this.analyzeOpponentWindows();
    const positionAlerts = this.generatePositionAlerts(tierCountsRemaining);
    
    // Default playstyle and scoring weights
    const playstyle = "value"; // Default, could be user configurable
    const scoringWeights = {
      w_vorp: 0.4,
      w_need: 0.2,
      w_adp: 0.15,
      w_stack: 0.1,
      w_bye: 0.05,
      w_risk: 0.05,
      w_snipe: 0.05
    };
    
    return {
      ...baseInput,
      candidates,
      tierCountsRemaining,
      opponentWindows,
      positionAlerts,
      playstyle,
      scoringWeights,
      kDefWindow: 12
    };
  }

  private buildCandidateFeatures(players: Player[], baseInput: any): CandidateFeature[] {
    const currentPick = baseInput.draftState.currentPick;
    const nextPick = currentPick + baseInput.picksUntilMyTurn;
    const userTeam = baseInput.userTeam;
    const kDefWindow = 12; // Default K/DEF window
    const playstyle = "value"; // Default playstyle
    
    const candidates = players
      .map(player => {
        // Calculate ADP delta (adp - currentPick, negative = reach)
        const adp_delta = player.adp ? player.adp - currentPick : 0;
        
        // Lightweight snipe risk heuristic
        const p_available_next_pick = this.calculateAvailabilityHeuristic(player, currentPick, nextPick, baseInput.picksUntilMyTurn);
        
        // Stack bonus calculation
        const stack_bonus = this.calculateStackBonus(player, userTeam);
        
        // Risk assessment (simple heuristic based on ADP variance)
        const risk = this.calculateRisk(player);
        
        return {
          id: player.id,
          name: player.name,
          pos: player.position as "QB" | "RB" | "WR" | "TE" | "K" | "DEF",
          team: player.team,
          bye: player.byeWeek,
          vorp: player.vorp || 0,
          tier: player.tier,
          adp: player.adp,
          adp_delta,
          stack_bonus,
          risk,
          p_available_next_pick
        };
      })
      .filter(candidate => {
        // K/DEF gating: only include if within window AND needs satisfied
        if (candidate.pos === 'K' || candidate.pos === 'DEF') {
          const picksUntilMyTurn = baseInput.picksUntilMyTurn;
          const needsSatisfied = this.checkCoreNeedsSatisfied(userTeam);
          return picksUntilMyTurn < kDefWindow && needsSatisfied;
        }
        
        // Playstyle risk filtering: if "floor" playstyle, cap high-risk candidates
        if (playstyle === "floor" && candidate.risk > 0.6) {
          // Only allow high-risk if position scarcity is extreme
          const tierCounts = this.calculateTierCounts([...baseInput.availablePlayers]);
          const tierPressure = this.calculateTierCliffPressure(candidate.pos as Position, tierCounts);
          return tierPressure > 0.8; // Extreme scarcity overrides risk preference
        }
        
        return true;
      });
      
    return candidates;
  }

  private checkCoreNeedsSatisfied(userTeam: Team): boolean {
    const roster = userTeam.roster;
    
    // Check if we have at least 1 QB, 2 RB, 2 WR, 1 TE
    const qbCount = (roster.QB || []).length;
    const rbCount = (roster.RB || []).length;
    const wrCount = (roster.WR || []).length;
    const teCount = (roster.TE || []).length;
    
    return qbCount >= 1 && rbCount >= 2 && wrCount >= 2 && teCount >= 1;
  }

  private calculateAvailabilityHeuristic(player: Player, currentPick: number, nextPick: number, picksUntilMyTurn: number): number {
    if (!player.adp) return 0.5; // Default if no ADP
    
    // Higher risk if ADP between currentPick and nextPick
    const clamp01 = (val: number) => Math.max(0, Math.min(1, val));
    return clamp01((player.adp - nextPick) / Math.max(12, picksUntilMyTurn));
  }

  private calculateStackBonus(player: Player, userTeam: Team): number {
    // Simple stack bonus calculation
    const qbs = userTeam.roster.QB || [];
    const teamPlayers = Object.values(userTeam.roster).flat().filter(p => p.team === player.team);
    
    if (player.position === 'WR' || player.position === 'TE') {
      // Bonus if we have QB from same team
      return qbs.some(qb => qb.team === player.team) ? 0.2 : 0;
    }
    
    if (player.position === 'QB') {
      // Bonus if we have WR/TE from same team
      return teamPlayers.some(p => p.position === 'WR' || p.position === 'TE') ? 0.15 : 0;
    }
    
    return 0;
  }

  private calculateRisk(player: Player): number {
    // Simple risk heuristic - could be enhanced with injury history, etc.
    if (!player.adp || !player.tier) return 0.3; // Default moderate risk
    
    // Higher tier players generally less risky
    const tierRisk = Math.min(0.6, (player.tier - 1) * 0.1);
    
    // Rookies might be riskier (simple heuristic)
    const rookieRisk = player.name.includes('(R)') ? 0.2 : 0;
    
    return Math.min(0.8, tierRisk + rookieRisk);
  }

  private calculateTierCounts(players: Player[]): Record<string, Record<number, number>> {
    const tierCounts: Record<string, Record<number, number>> = {};
    const positions: Position[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
    
    positions.forEach(pos => {
      tierCounts[pos] = {};
      const posPlayers = players.filter(p => p.position === pos && !p.isDrafted && !p.isDoNotDraft);
      
      // Count players by tier
      posPlayers.forEach(player => {
        const tier = player.tier || 5; // Default to tier 5 if no tier
        tierCounts[pos][tier] = (tierCounts[pos][tier] || 0) + 1;
      });
    });
    
    return tierCounts;
  }

  private analyzeOpponentWindows() {
    const userTeam = this.teams.find(t => t.isUser);
    if (!userTeam) return [];

    return this.teams
      .filter(team => !team.isUser)
      .map(team => {
        const picksBeforeMe = this.calculatePicksUntilTeamTurn(team);
        const needs = this.calculateRosterNeeds(team);
        
        return {
          team: team.name,
          picksBeforeMe,
          needs,
          stacksInProgress: this.detectStacksInProgress(team)
        };
      })
      .filter(window => window.picksBeforeMe <= 5) // Only teams picking soon
      .slice(0, 3); // Max 3 teams
  }

  private detectStacksInProgress(team: Team): string[] {
    const stacks: string[] = [];
    const roster = team.roster;
    
    // Check for QB-WR/TE stacks
    const qbs = roster.QB || [];
    const wrs = roster.WR || [];
    const tes = roster.TE || [];
    
    qbs.forEach(qb => {
      if (wrs.some(wr => wr.team === qb.team)) {
        stacks.push('QB-WR');
      }
      if (tes.some(te => te.team === qb.team)) {
        stacks.push('QB-TE');
      }
    });
    
    return [...new Set(stacks)]; // Remove duplicates
  }

  private generatePositionAlerts(tierCounts: Record<string, Record<number, number>>): string[] {
    const alerts: string[] = [];
    
    Object.entries(tierCounts).forEach(([pos, tiers]) => {
      const tier1Count = tiers[1] || 0;
      const tier2Count = tiers[2] || 0;
      
      if (tier1Count <= 1) {
        alerts.push(`${pos}: Tier-1 nearly empty (${tier1Count} left)`);
      } else if (tier2Count <= 2) {
        alerts.push(`${pos}: Tier-2 nearly empty (${tier2Count} left)`);
      }
    });
    
    return alerts;
  }

  calculateTierCliffPressure(pos: Position, tierCounts: Record<string, Record<number, number>>): number {
    const tiers = tierCounts[pos] || {};
    const tier1 = tiers[1] || 0;
    const tier2 = tiers[2] || 0;
    const tier3 = tiers[3] || 0;
    
    // High pressure if running out of top tier players
    if (tier1 <= 1) return 0.9;
    if (tier1 <= 2 && tier2 <= 2) return 0.7;
    if (tier2 <= 1) return 0.6;
    if (tier2 <= 3 && tier3 <= 3) return 0.4;
    
    return 0.1;
  }

  private filterTopPlayers(availablePlayers: Player[]): Player[] {
    // Position limits to avoid overwhelming AI
    const positionLimits = {
      QB: 4,
      RB: 6, 
      WR: 6,
      TE: 3,
      K: 2,
      DEF: 2
    };

    const filtered: Player[] = [];
    const positionCounts: Record<Position, number> = {
      QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DEF: 0
    };

    // Sort all players by VORP and filter
    const sortedPlayers = availablePlayers
      .filter(p => !p.isDrafted && !p.isDoNotDraft && (p.tier || 999) <= 4) // Only top 4 tiers
      .sort((a, b) => (b.vorp || 0) - (a.vorp || 0));

    // Ensure we keep at least 2 per hot position from tier analysis
    const tierCounts = this.calculateTierCounts(availablePlayers);
    const hotPositions = this.generatePositionAlerts(tierCounts)
      .map(alert => alert.split(':')[0] as Position);

    for (const player of sortedPlayers) {
      const position = player.position;
      const isHotPosition = hotPositions.includes(position);
      const currentCount = positionCounts[position];
      const limit = isHotPosition ? Math.max(positionLimits[position], 2) : positionLimits[position];
      
      if (currentCount < limit) {
        filtered.push(player);
        positionCounts[position]++;
      }
      
      // Stop at max 20 total players
      if (filtered.length >= 20) break;
    }

    console.log(`🎯 Filtered players for AI: ${filtered.length} total`, {
      QB: positionCounts.QB,
      RB: positionCounts.RB, 
      WR: positionCounts.WR,
      TE: positionCounts.TE,
      K: positionCounts.K,
      DEF: positionCounts.DEF
    });

    return filtered;
  }

  private analyzeImmediateCompetition(): OpponentAnalysis[] {
    const userTeam = this.teams.find(t => t.isUser);
    if (!userTeam) return [];

    // Only analyze teams picking in next 5 picks
    const immediateThreats = this.teams
      .filter(team => !team.isUser && team.id !== userTeam.id)
      .map(team => ({
        ...this.analyzeTeam(team),
        picksUntilTheirTurn: this.calculatePicksUntilTeamTurn(team)
      }))
      .filter(team => team.picksUntilTheirTurn <= 5) // Only immediate competition
      .slice(0, 3); // Max 3 teams to keep prompt focused

    return immediateThreats;
  }
}