import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { X, AlertTriangle, TrendingUp, Target, Clock, Zap, Brain } from 'lucide-react';
import { useDraft } from '../../contexts/DraftContext';
import type { Player, Position } from '../../types';

interface SmartAlert {
  id: string;
  type: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  category: 'TIER_BREAK' | 'RUN_STARTING' | 'VALUE_OPPORTUNITY' | 'STRATEGY_PIVOT' | 'TARGET_RISK';
  title: string;
  message: string;
  suggestedAction?: string;
  actionable?: boolean;
  autoAction?: () => void;
  timing: number; // seconds to display
  player?: Player;
  position?: Position;
  confidence: number; // 0-100
  reasoning: string[];
}

const SmartContextualAlerts: React.FC = () => {
  const { state, dispatch } = useDraft();
  const [alerts, setAlerts] = useState<SmartAlert[]>([]);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());

  // Generate smart contextual alerts based on current draft state
  const generateAlerts = useCallback((): SmartAlert[] => {
    const newAlerts: SmartAlert[] = [];
    const availablePlayers = state.players.filter(p => !p.isDrafted && !p.isDoNotDraft);
    const targetedPlayers = state.players.filter(p => p.isTargeted && !p.isDrafted);
    const userTeam = state.teams.find(t => t.isUser);
    const recentPicks = state.picks.slice(-5); // Last 5 picks

    // 1. CRITICAL: Tier Break Detection with Smart Context
    ['QB', 'RB', 'WR', 'TE'].forEach(position => {
      const posPlayers = availablePlayers.filter(p => p.position === position);
      const tier1Players = posPlayers.filter(p => p.tier <= 2);
      const tier2Players = posPlayers.filter(p => p.tier === 3);
      
      if (tier1Players.length <= 2 && tier1Players.length > 0) {
        const picksUntilMyTurn = state.picksUntilMyTurn;
        const likelihoodGone = Math.min(95, picksUntilMyTurn * 30); // Rough probability
        
        newAlerts.push({
          id: `tier-break-${position}`,
          type: 'CRITICAL',
          category: 'TIER_BREAK',
          title: `${position} Tier 1 Collapsing`,
          message: `Only ${tier1Players.length} elite ${position}s left. ${likelihoodGone}% chance none available at your turn.`,
          suggestedAction: tier1Players.length === 1 ? 'Consider reaching now' : `Target one of: ${tier1Players.slice(0, 2).map(p => p.name).join(', ')}`,
          actionable: true,
          timing: 15,
          position: position as Position,
          confidence: 85,
          reasoning: [
            `Only ${tier1Players.length} elite ${position} players remain`,
            `${picksUntilMyTurn} picks before your turn`,
            `Recent run: ${recentPicks.filter(p => p.player?.position === position).length} ${position}s in last 5 picks`
          ]
        });
      }
    });

    // 2. HIGH: Position Run Detection
    const positionCounts = recentPicks.reduce((acc, pick) => {
      if (pick.player?.position) {
        acc[pick.player.position] = (acc[pick.player.position] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    Object.entries(positionCounts).forEach(([pos, count]) => {
      if (count >= 3) {
        const remaining = availablePlayers.filter(p => p.position === pos && p.tier <= 3);
        newAlerts.push({
          id: `run-${pos}`,
          type: 'HIGH',
          category: 'RUN_STARTING',
          title: `${pos} Run Active`,
          message: `${count} ${pos}s drafted in last 5 picks. Only ${remaining.length} quality options left.`,
          suggestedAction: remaining.length <= 3 ? `Act now - consider ${remaining[0]?.name}` : 'Monitor closely',
          timing: 12,
          position: pos as Position,
          confidence: 75,
          reasoning: [
            `${count} ${pos} players picked recently`,
            `${remaining.length} tier 1-3 players remaining`,
            'Position run indicates high demand'
          ]
        });
      }
    });

    // 3. MEDIUM: Value Opportunity Detection
    availablePlayers.slice(0, 30).forEach(player => {
      const playerADP = player.adp || 0;
      const adpDiff = state.currentPick - playerADP; // Positive = drafting later than ADP (value)
      if (adpDiff > 12 && player.vorp && player.vorp > 10) { // Available significantly later than ADP
        newAlerts.push({
          id: `value-${player.id}`,
          type: 'MEDIUM',
          category: 'VALUE_OPPORTUNITY',
          title: 'Value Opportunity',
          message: `${player.name} (${player.position}) still available ${Math.round(adpDiff)} picks after ADP`,
          suggestedAction: 'Great value - consider drafting',
          timing: 10,
          player,
          confidence: 80,
          reasoning: [
            `ADP: ${playerADP.toFixed(1)}, Current pick: ${state.currentPick}`,
            `Available ${Math.round(adpDiff)} picks later than expected`,
            `Strong VORP: ${player.vorp.toFixed(1)}`,
            'Market undervaluing this player!'
          ]
        });
      }
    });

    // 4. HIGH: Target Risk Assessment
    targetedPlayers.forEach(player => {
      const similarPositionPicks = recentPicks.filter(p => p.player?.position === player.position).length;
      const riskScore = Math.min(95, state.picksUntilMyTurn * 25 + similarPositionPicks * 15);
      
      if (riskScore > 70) {
        newAlerts.push({
          id: `target-risk-${player.id}`,
          type: 'HIGH',
          category: 'TARGET_RISK',
          title: 'Target at Risk',
          message: `${player.name} has ${riskScore}% chance of being drafted before your turn`,
          suggestedAction: riskScore > 85 ? 'Consider drafting now if possible' : 'Have backup ready',
          timing: 12,
          player,
          confidence: 80,
          reasoning: [
            `${state.picksUntilMyTurn} picks until your turn`,
            `${similarPositionPicks} recent ${player.position} picks`,
            `Player VORP ranking: #${availablePlayers.sort((a, b) => (b.vorp || 0) - (a.vorp || 0)).findIndex(p => p.id === player.id) + 1}`
          ]
        });
      }
    });

    // 5. MEDIUM: Strategy Pivot Suggestions
    if (userTeam) {
      const positionNeeds = Object.entries(state.settings.rosterSlots).filter(([pos, slots]) => {
        const currentCount = userTeam.roster[pos as keyof typeof userTeam.roster]?.length || 0;
        return currentCount < slots && pos !== 'FLEX' && pos !== 'SUPERFLEX' && pos !== 'W/R/T';
      });

      if (positionNeeds.length > 0) {
        const criticalNeed = positionNeeds.find(([pos]) => {
          const needed = pos as Position;
          const available = availablePlayers.filter(p => p.position === needed && p.tier <= 4);
          return available.length <= 3;
        });

        if (criticalNeed) {
          const [pos] = criticalNeed;
          const available = availablePlayers.filter(p => p.position === pos && p.tier <= 4);
          
          newAlerts.push({
            id: `strategy-${pos}`,
            type: 'MEDIUM',
            category: 'STRATEGY_PIVOT',
            title: 'Strategy Pivot Needed',
            message: `Critical need at ${pos} - only ${available.length} quality options left`,
            suggestedAction: `Prioritize ${pos} over BPA`,
            timing: 15,
            position: pos as Position,
            confidence: 75,
            reasoning: [
              `Current ${pos} count: ${userTeam.roster[pos as keyof typeof userTeam.roster]?.length || 0}`,
              `Required: ${state.settings.rosterSlots[pos as keyof typeof state.settings.rosterSlots]}`,
              `Quality options remaining: ${available.length}`
            ]
          });
        }
      }
    }

    return newAlerts.filter(alert => !dismissedAlerts.has(alert.id));
  }, [state, dismissedAlerts]);

  const smartAlerts = useMemo(generateAlerts, [generateAlerts]);

  // Auto-dismiss alerts based on timing
  useEffect(() => {
    smartAlerts.forEach(alert => {
      if (alert.timing > 0) {
        const timer = setTimeout(() => {
          setDismissedAlerts(prev => new Set([...prev, alert.id]));
        }, alert.timing * 1000);
        
        return () => clearTimeout(timer);
      }
    });
  }, [smartAlerts]);

  const dismissAlert = (alertId: string) => {
    setDismissedAlerts(prev => new Set([...prev, alertId]));
  };

  const executeAction = (alert: SmartAlert) => {
    if (alert.autoAction) {
      alert.autoAction();
    } else if (alert.player) {
      // Default actions based on category
      switch (alert.category) {
        case 'VALUE_OPPORTUNITY':
          dispatch({ type: 'TOGGLE_TARGET', payload: alert.player.id });
          break;
        case 'TARGET_RISK':
          // Could open detailed player view or comparison
          break;
      }
    }
    dismissAlert(alert.id);
  };

  const getAlertStyle = (type: SmartAlert['type']) => {
    switch (type) {
      case 'CRITICAL':
        return 'border-red-500 bg-red-50 shadow-red-100';
      case 'HIGH':
        return 'border-orange-500 bg-orange-50 shadow-orange-100';
      case 'MEDIUM':
        return 'border-yellow-500 bg-yellow-50 shadow-yellow-100';
      case 'LOW':
        return 'border-blue-500 bg-blue-50 shadow-blue-100';
    }
  };

  const getAlertIcon = (category: SmartAlert['category']) => {
    switch (category) {
      case 'TIER_BREAK':
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      case 'RUN_STARTING':
        return <TrendingUp className="h-5 w-5 text-orange-500" />;
      case 'VALUE_OPPORTUNITY':
        return <Target className="h-5 w-5 text-green-500" />;
      case 'STRATEGY_PIVOT':
        return <Brain className="h-5 w-5 text-purple-500" />;
      case 'TARGET_RISK':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      default:
        return <Zap className="h-5 w-5 text-blue-500" />;
    }
  };

  const sortedAlerts = smartAlerts.sort((a, b) => {
    const typeOrder = { 'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3 };
    return typeOrder[a.type] - typeOrder[b.type];
  });

  if (sortedAlerts.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 max-w-md space-y-3">
      {sortedAlerts.slice(0, 3).map((alert) => (
        <div
          key={alert.id}
          className={`border-2 rounded-lg p-4 shadow-lg transition-all duration-300 transform hover:scale-105 ${getAlertStyle(alert.type)}`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3 flex-1">
              {getAlertIcon(alert.category)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-sm font-semibold text-gray-900 truncate">
                    {alert.title}
                  </h4>
                  <span className="text-xs font-medium text-gray-500 ml-2">
                    {alert.confidence}%
                  </span>
                </div>
                
                <p className="text-sm text-gray-700 mb-2">
                  {alert.message}
                </p>
                
                {alert.suggestedAction && (
                  <div className="text-xs text-gray-600 mb-2">
                    <strong>Suggestion:</strong> {alert.suggestedAction}
                  </div>
                )}

                {alert.reasoning.length > 0 && (
                  <details className="text-xs text-gray-600 mb-3">
                    <summary className="cursor-pointer font-medium">Why?</summary>
                    <ul className="mt-1 list-disc list-inside space-y-1">
                      {alert.reasoning.map((reason, idx) => (
                        <li key={idx}>{reason}</li>
                      ))}
                    </ul>
                  </details>
                )}

                {alert.actionable && (
                  <div className="flex space-x-2">
                    <button
                      onClick={() => executeAction(alert)}
                      className="text-xs bg-gray-900 text-white px-3 py-1 rounded hover:bg-gray-800 transition-colors"
                    >
                      Take Action
                    </button>
                  </div>
                )}
              </div>
            </div>
            
            <button
              onClick={() => dismissAlert(alert.id)}
              className="ml-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          
          {/* Progress bar for timing */}
          {alert.timing > 0 && (
            <div className="mt-3 bg-gray-200 rounded-full h-1">
              <div 
                className="bg-gray-400 rounded-full h-1 transition-all duration-1000 ease-linear"
                style={{
                  animation: `shrink ${alert.timing}s linear`,
                  width: '100%'
                }}
              />
            </div>
          )}
        </div>
      ))}
      
      {sortedAlerts.length > 3 && (
        <div className="text-center">
          <div className="inline-block bg-gray-100 text-gray-600 text-xs px-3 py-1 rounded-full">
            +{sortedAlerts.length - 3} more alerts
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
};

export default SmartContextualAlerts;