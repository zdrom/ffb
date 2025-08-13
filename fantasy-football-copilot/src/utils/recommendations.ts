import type { Player, Team, DraftSettings, Recommendation, Position, DraftPick } from '../types';

export class RecommendationsEngine {
  private players: Player[];
  private userTeam: Team;
  private allTeams: Team[];
  private settings: DraftSettings;
  private currentPick: number;
  private draftPicks: DraftPick[];

  constructor(players: Player[], userTeam: Team, allTeams: Team[], settings: DraftSettings, currentPick: number, draftPicks: DraftPick[] = []) {
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
      score: this.calculatePlayerScore(player),
      reasons: this.getRecommendationReasons(player),
      isValue: this.isValuePick(player),
      urgency: this.getUrgencyLevel(player)
    }));

    // Apply hidden gems detection
    this.identifyHiddenGems(scoredPlayers);
    
    return scoredPlayers
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  private identifyHiddenGems(scoredPlayers: Recommendation[]): void {
    scoredPlayers.forEach(rec => {
      const hiddenGemFactors = this.analyzeHiddenGemFactors(rec.player);
      
      if (hiddenGemFactors.isHiddenGem) {
        // Boost score for hidden gems
        rec.score += hiddenGemFactors.gemBonus;
        rec.reasons.unshift('🔍 Hidden Gem Detected');
        rec.reasons.push(...hiddenGemFactors.gemReasons);
      }
    });
  }

  private analyzeHiddenGemFactors(player: Player) {
    let gemScore = 0;
    const gemReasons: string[] = [];
    
    // Factor 1: Position scarcity cliff detection
    const scarcityCliff = this.detectScarcityCliff(player);
    if (scarcityCliff.isAtCliff) {
      gemScore += 40;
      gemReasons.push(`Last quality ${player.position} before talent cliff`);
    }
    
    // Factor 2: Opponent drafting convergence
    const convergence = this.detectOpponentConvergence(player);
    if (convergence.isConverging) {
      gemScore += 30;
      gemReasons.push(`${convergence.teamsConverging} teams likely targeting similar players`);
    }
    
    // Factor 3: Tier breakpoint analysis
    const tierBreak = this.analyzeTierBreakpoint(player);
    if (tierBreak.isAtBreakpoint) {
      gemScore += 35;
      gemReasons.push(`Significant talent drop after this tier`);
    }
    
    // Factor 4: Advanced value metrics
    const advancedValue = this.calculateAdvancedValueMetrics(player);
    if (advancedValue.isUndervalued) {
      gemScore += advancedValue.valueBonus;
      gemReasons.push(advancedValue.valueReason);
    }
    
    // Factor 5: Positional opportunity cost
    const opportunityCost = this.calculateOpportunityCost(player);
    if (opportunityCost.isOptimal) {
      gemScore += 25;
      gemReasons.push('Optimal timing vs other position needs');
    }
    
    const isHiddenGem = gemScore >= 50; // Threshold for hidden gem classification
    
    return {
      isHiddenGem,
      gemScore,
      gemBonus: Math.min(gemScore, 100), // Cap bonus at 100
      gemReasons
    };
  }

  private detectScarcityCliff(player: Player) {
    const availableAtPosition = this.players.filter(p => 
      p.position === player.position && !p.isDrafted && !p.isDoNotDraft
    ).sort((a, b) => a.rank - b.rank);
    
    const playerIndex = availableAtPosition.findIndex(p => p.id === player.id);
    if (playerIndex === -1 || playerIndex >= availableAtPosition.length - 1) {
      return { isAtCliff: false };
    }
    
    const nextPlayer = availableAtPosition[playerIndex + 1];
    const pointsDropoff = player.projectedPoints - nextPlayer.projectedPoints;
    const tierGap = nextPlayer.tier - player.tier;
    
    // Significant cliff if large points drop or tier jump
    const isAtCliff = pointsDropoff > 15 || tierGap >= 2;
    
    return { isAtCliff, pointsDropoff, tierGap };
  }

  private detectOpponentConvergence(player: Player) {
    const opponentNeeds = this.analyzeOpponentNeeds();
    const positionDemand = opponentNeeds[player.position] || 0;
    
    // Check if multiple teams are converging on similar tier players
    const samePositionSameTier = this.players.filter(p => 
      p.position === player.position && 
      p.tier === player.tier && 
      !p.isDrafted && 
      !p.isDoNotDraft
    ).length;
    
    const isConverging = positionDemand >= 3 && samePositionSameTier <= 2;
    
    return {
      isConverging,
      teamsConverging: positionDemand,
      playersInTier: samePositionSameTier
    };
  }

  private analyzeTierBreakpoint(player: Player) {
    const availableAtPosition = this.players.filter(p => 
      p.position === player.position && !p.isDrafted && !p.isDoNotDraft
    );
    
    const currentTierPlayers = availableAtPosition.filter(p => p.tier === player.tier);
    const nextTierPlayers = availableAtPosition.filter(p => p.tier === player.tier + 1);
    
    if (currentTierPlayers.length === 0 || nextTierPlayers.length === 0) {
      return { isAtBreakpoint: false };
    }
    
    const currentTierAvg = currentTierPlayers.reduce((sum, p) => sum + p.projectedPoints, 0) / currentTierPlayers.length;
    const nextTierAvg = nextTierPlayers.reduce((sum, p) => sum + p.projectedPoints, 0) / nextTierPlayers.length;
    
    const tierDropoff = (currentTierAvg - nextTierAvg) / currentTierAvg;
    const isAtBreakpoint = tierDropoff > 0.15 && currentTierPlayers.length <= 2;
    
    return { isAtBreakpoint, tierDropoff };
  }

  private calculateAdvancedValueMetrics(player: Player) {
    const valueData = this.calculateEnhancedValue(player);
    
    // Look for players who are undervalued relative to position strength
    const positionStrength = this.calculateRemainingPoolStrength(player.position);
    
    let isUndervalued = false;
    let valueBonus = 0;
    let valueReason = '';
    
    // Strong player in weak position pool
    if (player.tier <= 4 && positionStrength.isWeak) {
      isUndervalued = true;
      valueBonus = 30;
      valueReason = 'Quality player in thin position pool';
    }
    
    // High projected points vs ADP
    if (valueData.roundsAhead > 1.0 && player.projectedPoints > 150) {
      isUndervalued = true;
      valueBonus = Math.max(valueBonus, 25);
      valueReason = 'High scorer available below ADP';
    }
    
    return { isUndervalued, valueBonus, valueReason };
  }

  private calculateOpportunityCost(player: Player) {
    // Analyze if taking this player now vs waiting gives better overall value
    const myNeeds = this.getUserTeamNeeds();
    const positionPriority = myNeeds.indexOf(player.position);
    
    if (positionPriority === -1) {
      return { isOptimal: false }; // Don't need this position
    }
    
    // Check what we'd miss at other needed positions if we take this player
    const alternativeValues = myNeeds.slice(0, 3).map(needPos => {
      if (needPos === player.position) return 0;
      
      const bestAtPosition = this.players
        .filter(p => p.position === needPos && !p.isDrafted && !p.isDoNotDraft)
        .sort((a, b) => a.rank - b.rank)[0];
        
      return bestAtPosition ? this.calculatePlayerScore(bestAtPosition) : 0;
    });
    
    const maxAlternativeValue = Math.max(...alternativeValues);
    const thisPlayerValue = this.calculatePlayerScore(player);
    
    const isOptimal = thisPlayerValue > maxAlternativeValue * 1.1; // 10% better than alternatives
    
    return { isOptimal };
  }

  private getUserTeamNeeds(): Position[] {
    const needs: Position[] = [];
    
    // Check required positions first
    Object.entries(this.settings.rosterSlots).forEach(([pos, required]) => {
      if (pos === 'FLEX' || pos === 'SUPERFLEX' || pos === 'W/R/T' || pos === 'BENCH') return;
      
      const position = pos as Position;
      const current = this.userTeam.roster[position]?.length || 0;
      
      if (current < required) {
        for (let i = 0; i < required - current; i++) {
          needs.push(position);
        }
      }
    });
    
    // Add flex needs
    const skillPositions: Position[] = ['RB', 'WR', 'TE'];
    const totalSkill = skillPositions.reduce((sum, pos) => 
      sum + (this.userTeam.roster[pos]?.length || 0), 0
    );
    
    const flexNeeded = (this.settings.rosterSlots.FLEX || 0) + 
                      (this.settings.rosterSlots['W/R/T'] || 0);
    const totalSkillNeeded = this.settings.rosterSlots.RB + 
                            this.settings.rosterSlots.WR + 
                            this.settings.rosterSlots.TE + 
                            flexNeeded;
    
    if (totalSkill < totalSkillNeeded) {
      // Add most needed skill positions
      skillPositions.forEach(pos => {
        const current = this.userTeam.roster[pos]?.length || 0;
        const base = this.settings.rosterSlots[pos];
        if (current < base + 1) {
          needs.push(pos);
        }
      });
    }
    
    return needs;
  }

  private calculatePlayerScore(player: Player): number {
    let score = 0;

    // Base score from rankings with league-specific adjustments
    const leagueAdjustedRanking = this.getLeagueAdjustedRanking(player);
    score += Math.max(0, 500 - leagueAdjustedRanking);

    // Position need bonus
    const positionNeed = this.getPositionNeed(player.position);
    score += positionNeed * 100;

    // Tier considerations
    const tierBonus = this.getTierBonus(player);
    score += tierBonus;

    // Enhanced value pick bonus
    const valueData = this.calculateEnhancedValue(player);
    if (valueData.isValue) {
      score += valueData.valueScore;
    }

    // Target player bonus
    if (player.isTargeted) {
      score += 200;
    }

    // Bye week conflicts penalty
    const byeConflict = this.getByeWeekConflict(player);
    score -= byeConflict * 25;

    // Playoff schedule bonus/penalty
    const playoffBonus = this.getPlayoffScheduleBonus(player);
    score += playoffBonus;

    // Position scarcity bonus
    const scarcityBonus = this.getPositionScarcityBonus(player);
    score += scarcityBonus;

    // Opponent drafting pattern bonus
    const opponentPatternBonus = this.getOpponentPatternBonus(player);
    score += opponentPatternBonus;

    return Math.round(score);
  }

  private getLeagueAdjustedRanking(player: Player): number {
    let adjustedRank = player.rank;
    
    // Adjust based on scoring system
    const scoringAdjustment = this.getScoringAdjustment(player);
    adjustedRank = Math.max(1, adjustedRank - scoringAdjustment);
    
    // Adjust based on league format (roster slots)
    const formatAdjustment = this.getFormatAdjustment(player);
    adjustedRank = Math.max(1, adjustedRank - formatAdjustment);
    
    return adjustedRank;
  }

  private getScoringAdjustment(player: Player): number {
    if (!this.settings.customScoring) {
      // Standard scoring adjustments for preset systems
      switch (this.settings.scoringType) {
        case 'PPR':
          return this.getPPRAdjustment(player);
        case 'Half-PPR':
          return this.getHalfPPRAdjustment(player);
        case 'Standard':
          return this.getStandardAdjustment(player);
        default:
          return 0;
      }
    }
    
    // Custom scoring adjustments
    return this.getCustomScoringAdjustment(player);
  }

  private getPPRAdjustment(player: Player): number {
    switch (player.position) {
      case 'WR':
        return -5; // WRs get boost in PPR
      case 'RB':
        // Pass-catching RBs get bigger boost (simplified heuristic)
        return player.tier <= 4 ? -3 : 0;
      case 'TE':
        return -3; // TEs get moderate boost
      default:
        return 0;
    }
  }

  private getHalfPPRAdjustment(player: Player): number {
    const pprAdjustment = this.getPPRAdjustment(player);
    return Math.round(pprAdjustment * 0.5);
  }

  private getStandardAdjustment(player: Player): number {
    switch (player.position) {
      case 'RB':
        return -2; // RBs slightly more valuable in standard
      case 'WR':
        return 2; // WRs slightly less valuable in standard
      default:
        return 0;
    }
  }

  private getCustomScoringAdjustment(player: Player): number {
    const custom = this.settings.customScoring!;
    let adjustment = 0;
    
    // Receiving-heavy scoring boosts pass catchers
    if (custom.receiving.receptions > 0.5) {
      if (player.position === 'WR') adjustment -= 5;
      if (player.position === 'TE') adjustment -= 3;
      if (player.position === 'RB' && player.tier <= 4) adjustment -= 2;
    }
    
    // High passing TD scoring boosts QBs
    if (custom.passing.touchdowns > 4) {
      if (player.position === 'QB') adjustment -= 3;
    }
    
    // Defensive scoring emphasis
    if (custom.defense.sack > 1 || custom.defense.interception > 2) {
      if (player.position === 'DEF') adjustment -= 5;
    }
    
    return adjustment;
  }

  private getFormatAdjustment(player: Player): number {
    const slots = this.settings.rosterSlots;
    let adjustment = 0;
    
    // Superflex leagues boost QB value significantly
    if (slots.SUPERFLEX && slots.SUPERFLEX > 0 && player.position === 'QB') {
      adjustment -= 15;
    }
    
    // Multiple flex spots boost skill position players
    const totalFlex = (slots.FLEX || 0) + (slots['W/R/T'] || 0);
    if (totalFlex >= 2 && ['RB', 'WR', 'TE'].includes(player.position)) {
      adjustment -= 3;
    }
    
    // TE premium leagues (multiple TE slots)
    if (slots.TE >= 2 && player.position === 'TE') {
      adjustment -= 8;
    }
    
    // 2QB leagues without superflex
    if (slots.QB >= 2 && !slots.SUPERFLEX && player.position === 'QB') {
      adjustment -= 10;
    }
    
    return adjustment;
  }

  private getPositionNeed(position: Position): number {
    const currentCount = this.userTeam.roster[position].length;
    const requiredCount = this.settings.rosterSlots[position];
    const flexCount = this.userTeam.roster.RB.length + this.userTeam.roster.WR.length + this.userTeam.roster.TE.length;
    const flexRequired = this.settings.rosterSlots.FLEX || 0;

    if (currentCount < requiredCount) {
      // High need for unfilled position
      return 3;
    } else if ((position === 'RB' || position === 'WR' || position === 'TE') && flexCount < flexRequired) {
      // Medium need for flex positions
      return 2;
    } else if (currentCount < requiredCount + 1) {
      // Low need for depth
      return 1;
    }
    
    return 0;
  }

  private getTierBonus(player: Player): number {
    const samePositionPlayers = this.players.filter(p => 
      p.position === player.position && !p.isDrafted && !p.isDoNotDraft
    );
    
    const playersInTier = samePositionPlayers.filter(p => p.tier === player.tier);
    const isLastInTier = playersInTier.length === 1;
    
    if (isLastInTier && player.tier <= 5) {
      return 75; // Big bonus for last player in a top tier
    } else if (playersInTier.length <= 2 && player.tier <= 8) {
      return 40; // Medium bonus for tier about to collapse
    }
    
    return 0;
  }

  private isValuePick(player: Player): boolean {
    if (player.adp === 999) return false;
    
    const enhancedValue = this.calculateEnhancedValue(player);
    return enhancedValue.isValue;
  }

  private calculateEnhancedValue(player: Player) {
    const currentRound = Math.ceil(this.currentPick / this.settings.numberOfTeams);
    const adpRound = Math.ceil(player.adp / this.settings.numberOfTeams);
    
    // Base ADP value calculation
    const roundsAhead = adpRound - currentRound;
    const isBasicValue = roundsAhead > 1.5;
    
    // Enhanced value calculation considering remaining player pool
    const positionValue = this.calculatePositionalValue(player);
    const remainingPoolStrength = this.calculateRemainingPoolStrength(player.position);
    
    // If the remaining pool at this position is weak, even smaller ADP gaps become valuable
    const adjustedValueThreshold = remainingPoolStrength.isWeak ? 0.75 : 1.5;
    const isEnhancedValue = roundsAhead > adjustedValueThreshold;
    
    return {
      isValue: isBasicValue || isEnhancedValue,
      roundsAhead,
      positionValue,
      poolStrength: remainingPoolStrength,
      valueScore: this.calculateValueScore(player, roundsAhead, positionValue, remainingPoolStrength)
    };
  }

  private calculatePositionalValue(player: Player): number {
    const availableAtPosition = this.players.filter(p => 
      p.position === player.position && !p.isDrafted && !p.isDoNotDraft
    ).sort((a, b) => a.rank - b.rank);
    
    const playerIndex = availableAtPosition.findIndex(p => p.id === player.id);
    if (playerIndex === -1) return 0;
    
    // Value based on position in remaining rankings (0-1 scale)
    return Math.max(0, 1 - (playerIndex / availableAtPosition.length));
  }

  private calculateRemainingPoolStrength(position: Position) {
    const availableAtPosition = this.players.filter(p => 
      p.position === position && !p.isDrafted && !p.isDoNotDraft
    ).sort((a, b) => a.rank - b.rank);
    
    if (availableAtPosition.length === 0) {
      return { isWeak: true, strength: 0, qualityPlayers: 0 };
    }
    
    // Count quality players remaining (top 3 tiers)
    const qualityPlayers = availableAtPosition.filter(p => p.tier <= 3).length;
    const totalRemaining = availableAtPosition.length;
    
    // Calculate average projected points of remaining players
    const avgPoints = availableAtPosition.reduce((sum, p) => sum + p.projectedPoints, 0) / totalRemaining;
    
    // Weak pool if fewer than 3 quality players or low average points
    const isWeak = qualityPlayers < 3 || avgPoints < 100;
    
    return {
      isWeak,
      strength: qualityPlayers / Math.max(totalRemaining, 1),
      qualityPlayers,
      avgPoints
    };
  }

  private calculateValueScore(player: Player, roundsAhead: number, positionValue: number, poolStrength: { isWeak: boolean }): number {
    let score = 0;
    
    // Base value from ADP
    score += Math.max(0, roundsAhead * 20);
    
    // Positional value bonus
    score += positionValue * 30;
    
    // Pool strength adjustment
    if (poolStrength.isWeak) {
      score += 25; // Bonus for getting quality when pool is weak
    }
    
    // Tier-based bonus
    if (player.tier <= 3) {
      score += (4 - player.tier) * 10;
    }
    
    return Math.round(score);
  }

  private getByeWeekConflict(player: Player): number {
    if (player.byeWeek === 0) return 0;
    
    const sameByeWeekPlayers = Object.values(this.userTeam.roster)
      .flat()
      .filter(p => p.byeWeek === player.byeWeek);
      
    // Penalty increases with number of players on same bye week
    return sameByeWeekPlayers.length;
  }

  private getPlayoffScheduleBonus(player: Player): number {
    if (!player.playoffSchedule) return 0;
    
    switch (player.playoffSchedule) {
      case 'Good': return 25;
      case 'Avg': return 0;
      case 'Tough': return -15;
      default: return 0;
    }
  }

  private getPositionScarcityBonus(player: Player): number {
    const scarcityData = this.calculateAdvancedPositionScarcity(player.position);
    
    // Enhanced scarcity bonus based on multiple factors
    let bonus = 0;
    
    // Tier-based scarcity
    if (scarcityData.isLastInTopTiers) {
      bonus += 60;
    } else if (scarcityData.topTierRemaining <= 2 && player.tier <= 3) {
      bonus += 40;
    }
    
    // Value dropoff bonus
    if (scarcityData.valueDropoffSeverity > 0.3) {
      bonus += Math.round(scarcityData.valueDropoffSeverity * 50);
    }
    
    // Positional run prediction bonus
    if (scarcityData.isRunPredicted) {
      bonus += 25;
    }
    
    // League-specific scarcity
    const leagueSpecificBonus = this.getLeagueSpecificScarcityBonus(player.position, scarcityData);
    bonus += leagueSpecificBonus;
    
    return bonus;
  }

  private calculateAdvancedPositionScarcity(position: Position) {
    const availableAtPosition = this.players.filter(p => 
      p.position === position && !p.isDrafted && !p.isDoNotDraft
    ).sort((a, b) => a.rank - b.rank);
    
    const topTierRemaining = availableAtPosition.filter(p => p.tier <= 3).length;
    const totalRemaining = availableAtPosition.length;
    
    // Calculate value dropoff between tiers
    const valueDropoff = this.calculateValueDropoff(availableAtPosition);
    
    // Predict if a positional run is likely
    const runPrediction = this.predictPositionalRun(position);
    
    // Check if this is the last player in top tiers
    const isLastInTopTiers = topTierRemaining === 1 && availableAtPosition[0]?.tier <= 3;
    
    const tierPressure = this.calculateTierPressure(position);
    
    return {
      totalRemaining,
      topTierRemaining,
      valueDropoffSeverity: valueDropoff,
      isRunPredicted: runPrediction,
      isLastInTopTiers,
      tierPressure
    };
  }

  private calculateValueDropoff(sortedPlayers: Player[]): number {
    if (sortedPlayers.length < 2) return 0;
    
    const topPlayerPoints = sortedPlayers[0].projectedPoints;
    const secondPlayerPoints = sortedPlayers[1].projectedPoints;
    
    if (topPlayerPoints === 0) return 0;
    
    return Math.max(0, (topPlayerPoints - secondPlayerPoints) / topPlayerPoints);
  }

  private predictPositionalRun(position: Position): boolean {
    // Enhanced positional run detection
    const runData = this.analyzePositionalRunTrends(position);
    
    return runData.isActiveRun || runData.isLikelyToStart;
  }

  private analyzePositionalRunTrends(position: Position) {
    const recentPicks = this.draftPicks.slice(-8); // Last 8 picks
    const positionPicks = recentPicks.filter(pick => 
      pick.player?.position === position
    );
    
    // Check for active run (2+ of same position in last 4 picks)
    const veryRecentPicks = recentPicks.slice(-4);
    const veryRecentPositionPicks = veryRecentPicks.filter(pick => 
      pick.player?.position === position
    ).length;
    
    const isActiveRun = veryRecentPositionPicks >= 2;
    
    // Predict if a run is likely to start
    const opponentNeeds = this.analyzeOpponentNeeds();
    const upcomingTeamsNeedingPosition = this.getUpcomingTeamsNeedingPosition(position);
    const isLikelyToStart = upcomingTeamsNeedingPosition >= 2 && opponentNeeds[position] >= 3;
    
    // Check for tier clustering (multiple teams likely to target same tier)
    const tierPressure = this.calculateTierPressure(position);
    
    return {
      isActiveRun,
      isLikelyToStart,
      recentActivity: positionPicks.length,
      tierPressure,
      upcomingDemand: upcomingTeamsNeedingPosition
    };
  }

  private getUpcomingTeamsNeedingPosition(position: Position): number {
    const nextFewPicks = 4; // Look ahead 4 picks
    
    let teamsNeedingPosition = 0;
    
    for (let i = 1; i <= nextFewPicks; i++) {
      const nextPickNumber = this.currentPick + i;
      const nextTeamIndex = this.getTeamIndexForPick(nextPickNumber);
      
      if (nextTeamIndex >= 0 && nextTeamIndex < this.allTeams.length) {
        const team = this.allTeams[nextTeamIndex];
        if (this.teamNeedsPosition(team, position)) {
          teamsNeedingPosition++;
        }
      }
    }
    
    return teamsNeedingPosition;
  }

  private getTeamIndexForPick(pickNumber: number): number {
    const round = Math.ceil(pickNumber / this.settings.numberOfTeams);
    const pickInRound = ((pickNumber - 1) % this.settings.numberOfTeams) + 1;
    
    if (this.settings.draftType === 'Snake' && round % 2 === 0) {
      // Even rounds in snake draft go in reverse order
      return this.settings.numberOfTeams - pickInRound;
    } else {
      // Odd rounds or linear draft
      return pickInRound - 1;
    }
  }

  private teamNeedsPosition(team: Team, position: Position): boolean {
    const current = team.roster[position]?.length || 0;
    const required = this.settings.rosterSlots[position];
    
    // Basic position need
    if (current < required) return true;
    
    // Flex position need for skill positions
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
      
      return totalSkill < totalSkillNeeded;
    }
    
    // Superflex need for QB
    if (position === 'QB') {
      const superflexNeeded = this.settings.rosterSlots.SUPERFLEX || 0;
      return current < required + superflexNeeded;
    }
    
    return false;
  }

  private calculateTierPressure(position: Position): number {
    const availableAtPosition = this.players.filter(p => 
      p.position === position && !p.isDrafted && !p.isDoNotDraft
    );
    
    // Group by tier
    const tierCounts: Record<number, number> = {};
    availableAtPosition.forEach(player => {
      tierCounts[player.tier] = (tierCounts[player.tier] || 0) + 1;
    });
    
    // Calculate pressure on top tiers
    const topTiers = [1, 2, 3, 4];
    let pressure = 0;
    
    topTiers.forEach(tier => {
      const playersInTier = tierCounts[tier] || 0;
      const teamsNeedingPosition = this.analyzeOpponentNeeds()[position] || 0;
      
      if (playersInTier > 0 && teamsNeedingPosition > playersInTier) {
        pressure += (teamsNeedingPosition - playersInTier) * (5 - tier); // Higher weight for better tiers
      }
    });
    
    return pressure;
  }

  private getLeagueSpecificScarcityBonus(position: Position, scarcityData: { totalRemaining: number }): number {
    const rosterSlots = this.settings.rosterSlots;
    const numTeams = this.settings.numberOfTeams;
    
    // Calculate total demand for this position across all teams
    let totalDemand = rosterSlots[position] * numTeams;
    
    // Add flex demand for skill positions
    if (['RB', 'WR', 'TE'].includes(position)) {
      totalDemand += (rosterSlots.FLEX || 0) * numTeams;
      totalDemand += (rosterSlots['W/R/T'] || 0) * numTeams;
    }
    
    // Add superflex demand for QB
    if (position === 'QB') {
      totalDemand += (rosterSlots.SUPERFLEX || 0) * numTeams;
    }
    
    const demandRatio = totalDemand / scarcityData.totalRemaining;
    
    // Higher bonus for positions with high demand relative to supply
    if (demandRatio > 2.0) return 30;
    if (demandRatio > 1.5) return 20;
    if (demandRatio > 1.2) return 10;
    
    return 0;
  }

  private getOpponentPatternBonus(player: Player): number {
    const opponentNeeds = this.analyzeOpponentNeeds();
    const positionDemand = opponentNeeds[player.position] || 0;
    
    // If many opponents need this position, increase urgency
    if (positionDemand >= 4) {
      return 35; // High demand from opponents
    } else if (positionDemand >= 2) {
      return 20; // Medium demand
    }
    
    return 0;
  }

  private analyzeOpponentNeeds(): Record<Position, number> {
    const needs: Record<Position, number> = {
      QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DEF: 0
    };
    
    // Analyze each opponent team
    this.allTeams.forEach(team => {
      if (team.isUser) return; // Skip user team
      
      // Count unfilled required positions
      Object.entries(this.settings.rosterSlots).forEach(([pos, required]) => {
        if (pos === 'FLEX' || pos === 'SUPERFLEX' || pos === 'W/R/T' || pos === 'BENCH') return;
        
        const position = pos as Position;
        const current = team.roster[position]?.length || 0;
        
        if (current < required) {
          needs[position]++;
        }
      });
      
      // Add flex position needs for skill positions
      const skillPositions: Position[] = ['RB', 'WR', 'TE'];
      const totalSkillPlayers = skillPositions.reduce((sum, pos) => 
        sum + (team.roster[pos]?.length || 0), 0
      );
      
      const flexRequired = (this.settings.rosterSlots.FLEX || 0) + 
                          (this.settings.rosterSlots['W/R/T'] || 0);
      
      const skillPositionsNeeded = this.settings.rosterSlots.RB + 
                                  this.settings.rosterSlots.WR + 
                                  this.settings.rosterSlots.TE + 
                                  flexRequired;
      
      if (totalSkillPlayers < skillPositionsNeeded) {
        // Distribute flex need across skill positions based on current gaps
        skillPositions.forEach(pos => {
          const current = team.roster[pos]?.length || 0;
          const required = this.settings.rosterSlots[pos];
          if (current < required + 1) { // Need depth
            needs[pos] += 0.5;
          }
        });
      }
    });
    
    return needs;
  }

  private getRecommendationReasons(player: Player): string[] {
    const reasons: string[] = [];
    
    const positionNeed = this.getPositionNeed(player.position);
    if (positionNeed >= 3) {
      reasons.push(`High need at ${player.position}`);
    } else if (positionNeed >= 2) {
      reasons.push(`Flex depth needed`);
    }

    if (player.isTargeted) {
      reasons.push('On your target list');
    }

    const valueData = this.calculateEnhancedValue(player);
    if (valueData.isValue) {
      if (valueData.roundsAhead > 2) {
        reasons.push(`Great value (${valueData.roundsAhead.toFixed(1)} rounds ahead of ADP)`);
      } else {
        reasons.push('Value pick vs ADP');
      }
      
      if (valueData.poolStrength.isWeak) {
        reasons.push('Weak remaining pool at position');
      }
    }

    const tierBonus = this.getTierBonus(player);
    if (tierBonus >= 75) {
      reasons.push('Last elite player in tier');
    } else if (tierBonus >= 40) {
      reasons.push('Tier about to collapse');
    }

    const byeConflict = this.getByeWeekConflict(player);
    if (byeConflict >= 2) {
      reasons.push(`Bye week conflict (Week ${player.byeWeek})`);
    }

    if (player.playoffSchedule === 'Good') {
      reasons.push('Great playoff matchups');
    } else if (player.playoffSchedule === 'Tough') {
      reasons.push('Tough playoff schedule');
    }

    const scarcityBonus = this.getPositionScarcityBonus(player);
    if (scarcityBonus > 0) {
      reasons.push(`${player.position} position getting scarce`);
    }

    const opponentPatternBonus = this.getOpponentPatternBonus(player);
    if (opponentPatternBonus >= 35) {
      reasons.push(`High demand from other teams`);
    } else if (opponentPatternBonus >= 20) {
      reasons.push(`Multiple teams need ${player.position}`);
    }

    return reasons;
  }

  private getUrgencyLevel(player: Player): 'High' | 'Medium' | 'Low' {
    const tierBonus = this.getTierBonus(player);
    const positionNeed = this.getPositionNeed(player.position);
    const scarcityBonus = this.getPositionScarcityBonus(player);
    const hiddenGemFactors = this.analyzeHiddenGemFactors(player);

    if (hiddenGemFactors.isHiddenGem || tierBonus >= 75 || positionNeed >= 3 || scarcityBonus >= 30) {
      return 'High';
    } else if (tierBonus >= 40 || positionNeed >= 2 || scarcityBonus >= 20) {
      return 'Medium';
    } else {
      return 'Low';
    }
  }
}