import type { DraftPick, Player, Position, PositionalRun, TierAlert } from '../types';

export class AlertsEngine {
  private picks: DraftPick[];
  private players: Player[];

  constructor(picks: DraftPick[], players: Player[]) {
    this.picks = picks;
    this.players = players;
  }

  detectPositionalRuns(): PositionalRun[] {
    const runs: PositionalRun[] = [];
    const positions: Position[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
    
    // Look at last 8 picks for runs
    const recentPicks = this.picks.slice(-8);
    
    positions.forEach(position => {
      const positionPicks = recentPicks.filter(pick => 
        pick.player && pick.player.position === position
      );
      
      if (positionPicks.length >= 4) {
        runs.push({
          position,
          count: positionPicks.length,
          inLastPicks: 8,
          isActive: true
        });
      } else if (positionPicks.length >= 3) {
        runs.push({
          position,
          count: positionPicks.length,
          inLastPicks: 8,
          isActive: false
        });
      }
    });

    return runs;
  }

  detectTierAlerts(): TierAlert[] {
    const alerts: TierAlert[] = [];
    const positions: Position[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];

    positions.forEach(position => {
      const availablePlayers = this.players.filter(p => 
        p.position === position && !p.isDrafted
      );

      // Group by tiers for this position
      const tierGroups = this.groupPlayersByTier(availablePlayers);
      
      // Check tiers 1-8 for collapse risk
      for (let tier = 1; tier <= 8; tier++) {
        const playersInTier = tierGroups[tier] || [];
        
        if (playersInTier.length === 1) {
          alerts.push({
            position,
            tier,
            remainingPlayers: 1,
            isCollapsing: true
          });
        } else if (playersInTier.length === 2) {
          alerts.push({
            position,
            tier,
            remainingPlayers: 2,
            isCollapsing: false
          });
        }
      }
    });

    return alerts.sort((a, b) => {
      // Sort by tier first (lower tier = higher priority)
      if (a.tier !== b.tier) return a.tier - b.tier;
      // Then by collapsing status (collapsing = higher priority)
      if (a.isCollapsing !== b.isCollapsing) return a.isCollapsing ? -1 : 1;
      // Finally by remaining players (fewer = higher priority)
      return a.remainingPlayers - b.remainingPlayers;
    });
  }

  private groupPlayersByTier(players: Player[]): Record<number, Player[]> {
    const groups: Record<number, Player[]> = {};
    
    players.forEach(player => {
      if (!groups[player.tier]) {
        groups[player.tier] = [];
      }
      groups[player.tier].push(player);
    });

    return groups;
  }

  getPositionScarcity(position: Position): {
    tier1: number;
    tier2: number;
    tier3: number;
    total: number;
  } {
    const available = this.players.filter(p => 
      p.position === position && !p.isDrafted
    );

    return {
      tier1: available.filter(p => p.tier === 1).length,
      tier2: available.filter(p => p.tier === 2).length,
      tier3: available.filter(p => p.tier === 3).length,
      total: available.length
    };
  }

  shouldFlashTab(): boolean {
    const runs = this.detectPositionalRuns();
    const alerts = this.detectTierAlerts();
    
    // Flash if there's an active run or tier about to collapse
    return runs.some(run => run.isActive) || 
           alerts.some(alert => alert.isCollapsing);
  }

  getAlertSound(): string | null {
    const runs = this.detectPositionalRuns();
    const alerts = this.detectTierAlerts();
    
    if (runs.some(run => run.isActive && run.count >= 5)) {
      return 'position-run-major'; // Major run alert
    } else if (runs.some(run => run.isActive)) {
      return 'position-run'; // Position run alert
    } else if (alerts.some(alert => alert.isCollapsing && alert.tier <= 3)) {
      return 'tier-collapse'; // Important tier collapse
    }
    
    return null;
  }
}