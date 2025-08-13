import type { Player, TrendData, PositionScarcity, Position } from '../types';

// Simulated ADP tracking data - in a real app this would come from external API
const ADP_HISTORY: Record<string, { date: Date; adp: number }[]> = {};

export const initializeTrendTracking = (players: Player[]) => {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  
  players.forEach(player => {
    if (!ADP_HISTORY[player.id]) {
      // Generate some sample trend data
      const baseAdp = player.adp;
      const variation = Math.random() * 10 - 5; // Random variation of -5 to +5
      
      ADP_HISTORY[player.id] = [
        { date: twoDaysAgo, adp: baseAdp + variation * 2 },
        { date: yesterday, adp: baseAdp + variation },
        { date: now, adp: baseAdp }
      ];
    }
  });
};

export const updatePlayerADP = (playerId: string, newAdp: number) => {
  if (!ADP_HISTORY[playerId]) {
    ADP_HISTORY[playerId] = [];
  }
  
  ADP_HISTORY[playerId].push({
    date: new Date(),
    adp: newAdp
  });
  
  // Keep only last 7 days of data
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  ADP_HISTORY[playerId] = ADP_HISTORY[playerId].filter(entry => entry.date >= weekAgo);
};

export const calculateTrendData = (players: Player[]): TrendData[] => {
  return players.map(player => {
    const history = ADP_HISTORY[player.id] || [];
    
    if (history.length < 2) {
      return {
        playerId: player.id,
        playerName: player.name,
        position: player.position,
        currentADP: player.adp,
        previousADP: player.adp,
        adpChange: 0,
        adpTrend: 'Stable' as const,
        velocityScore: 0,
        lastUpdated: new Date()
      };
    }
    
    const currentEntry = history[history.length - 1];
    const previousEntry = history[history.length - 2];
    const adpChange = previousEntry.adp - currentEntry.adp; // Negative = ADP getting worse (higher number)
    
    // Calculate velocity (rate of change)
    let velocityScore = 0;
    if (history.length >= 3) {
      const changes = [];
      for (let i = 1; i < history.length; i++) {
        changes.push(history[i - 1].adp - history[i].adp);
      }
      velocityScore = changes.reduce((sum, change) => sum + Math.abs(change), 0) / changes.length;
    }
    
    let adpTrend: 'Rising' | 'Falling' | 'Stable';
    if (Math.abs(adpChange) < 2) {
      adpTrend = 'Stable';
    } else if (adpChange > 0) {
      adpTrend = 'Rising'; // ADP getting better (lower number)
    } else {
      adpTrend = 'Falling'; // ADP getting worse (higher number)
    }
    
    return {
      playerId: player.id,
      playerName: player.name,
      position: player.position,
      currentADP: currentEntry.adp,
      previousADP: previousEntry.adp,
      adpChange,
      adpTrend,
      velocityScore,
      lastUpdated: currentEntry.date
    };
  }).filter(trend => Math.abs(trend.adpChange) > 1 || trend.velocityScore > 3) // Only show significant trends
    .sort((a, b) => Math.abs(b.adpChange) - Math.abs(a.adpChange)); // Sort by biggest movers
};

export const calculatePositionScarcity = (players: Player[], draftedPlayers: Player[]): PositionScarcity[] => {
  const positions: Position[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
  
  return positions.map(position => {
    const availablePlayers = players.filter(p => 
      p.position === position && !draftedPlayers.some(drafted => drafted.id === p.id)
    );
    
    const tier1 = availablePlayers.filter(p => p.tier <= 2).length;
    const tier2 = availablePlayers.filter(p => p.tier === 3 || p.tier === 4).length;
    const tier3 = availablePlayers.filter(p => p.tier === 5 || p.tier === 6).length;
    
    // Estimate picks until next tier based on position demand
    const positionDemand = getPositionDemand(position);
    const avgPicksUntilNextTier = Math.ceil(tier1 / positionDemand);
    
    let scarcityLevel: 'Critical' | 'High' | 'Medium' | 'Low';
    if (tier1 <= 2) scarcityLevel = 'Critical';
    else if (tier1 <= 5) scarcityLevel = 'High';
    else if (tier1 <= 10) scarcityLevel = 'Medium';
    else scarcityLevel = 'Low';
    
    return {
      position,
      tier1Remaining: tier1,
      tier2Remaining: tier2,
      tier3Remaining: tier3,
      avgPicksUntilNextTier,
      scarcityLevel
    };
  });
};

const getPositionDemand = (position: Position): number => {
  // Average number of players drafted at each position per round
  switch (position) {
    case 'RB': return 0.4; // High demand
    case 'WR': return 0.5; // Highest demand
    case 'QB': return 0.15; // Low early demand
    case 'TE': return 0.2; // Medium demand
    case 'K': return 0.08; // Very late
    case 'DEF': return 0.08; // Very late
    default: return 0.3;
  }
};

export const getTopMovers = (trendData: TrendData[], limit = 10): {
  rising: TrendData[];
  falling: TrendData[];
} => {
  const rising = trendData
    .filter(t => t.adpTrend === 'Rising')
    .sort((a, b) => b.adpChange - a.adpChange)
    .slice(0, limit);
    
  const falling = trendData
    .filter(t => t.adpTrend === 'Falling')
    .sort((a, b) => a.adpChange - b.adpChange) // More negative first
    .slice(0, limit);
    
  return { rising, falling };
};