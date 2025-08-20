import React, { useState, useMemo } from 'react';
import { 
  Crown, Target, TrendingUp, AlertTriangle, Clock, 
  Filter, ChevronDown, ChevronRight, Zap, BarChart3, 
  User, Users, Trophy, ThumbsUp, Brain
} from 'lucide-react';
import { useDraft } from '../../contexts/DraftContext';
import VisualVORPComparison from './VisualVORPComparison';
import VORPChart from './VORPChart';
import { AIStrategyOverlay } from '../ai';
import type { Player, Position } from '../../types';

interface QuickAction {
  id: string;
  label: string;
  action: () => void;
  variant: 'primary' | 'secondary' | 'danger';
  icon?: React.ReactNode;
}

const EnhancedDecisionDashboard: React.FC = () => {
  const { state, dispatch } = useDraft();
  const [selectedView, setSelectedView] = useState<'recommendations' | 'comparison' | 'chart' | 'ai'>('recommendations');
  const [positionFilter, setPositionFilter] = useState<Position | 'ALL'>('ALL');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  // Get current situation analysis
  const situationAnalysis = useMemo(() => {
    const availablePlayers = state.players.filter(p => !p.isDrafted && !p.isDoNotDraft);
    const isMyTurn = state.picksUntilMyTurn === 0;
    const userTeam = state.teams.find(t => t.isUser);
    
    // Top recommendation
    const topRecommendation = availablePlayers
      .sort((a, b) => (b.vorp || 0) - (a.vorp || 0))[0];

    // Critical alerts
    const criticalAlerts: string[] = [];
    
    // Check for tier breaks
    ['QB', 'RB', 'WR', 'TE'].forEach(position => {
      const posPlayers = availablePlayers.filter(p => p.position === position);
      const tier1Count = posPlayers.filter(p => p.tier <= 2).length;
      if (tier1Count <= 2 && tier1Count > 0) {
        criticalAlerts.push(`${position} Tier 1 ending (${tier1Count} left)`);
      }
    });

    // Position runs
    const recentPicks = state.picks.slice(-5);
    const positionCounts = recentPicks.reduce((acc, pick) => {
      if (pick.player?.position) {
        acc[pick.player.position] = (acc[pick.player.position] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    Object.entries(positionCounts).forEach(([pos, count]) => {
      if (count >= 3) {
        criticalAlerts.push(`${pos} run active (${count} in last 5)`);
      }
    });

    // Team needs
    const teamNeeds: Position[] = [];
    if (userTeam) {
      Object.entries(state.settings.rosterSlots).forEach(([pos, slots]) => {
        if (pos !== 'FLEX' && pos !== 'SUPERFLEX' && pos !== 'W/R/T') {
          const currentCount = userTeam.roster[pos as keyof typeof userTeam.roster]?.length || 0;
          if (currentCount < slots) {
            teamNeeds.push(pos as Position);
          }
        }
      });
    }

    return {
      isMyTurn,
      topRecommendation,
      criticalAlerts,
      teamNeeds,
      picksUntilTurn: state.picksUntilMyTurn,
      availableCount: availablePlayers.length
    };
  }, [state]);

  // Quick actions
  const getQuickActions = (): QuickAction[] => {
    const actions: QuickAction[] = [];
    
    if (situationAnalysis.topRecommendation && situationAnalysis.isMyTurn) {
      actions.push({
        id: 'draft-top',
        label: `Draft ${situationAnalysis.topRecommendation.name}`,
        action: () => {
          // In a real implementation, this would trigger the draft action
          console.log('Draft action for', situationAnalysis.topRecommendation?.name);
        },
        variant: 'primary',
        icon: <Crown className="h-4 w-4" />
      });
    }

    if (situationAnalysis.topRecommendation) {
      actions.push({
        id: 'target-top',
        label: situationAnalysis.topRecommendation.isTargeted ? 'Remove Target' : 'Add to Targets',
        action: () => {
          if (situationAnalysis.topRecommendation) {
            dispatch({ type: 'TOGGLE_TARGET', payload: situationAnalysis.topRecommendation.id });
          }
        },
        variant: 'secondary',
        icon: <Target className="h-4 w-4" />
      });
    }

    // Position-specific actions
    if (situationAnalysis.teamNeeds.length > 0) {
      const criticalNeed = situationAnalysis.teamNeeds[0];
      const bestAtPosition = state.players
        .filter(p => !p.isDrafted && !p.isDoNotDraft && p.position === criticalNeed)
        .sort((a, b) => (b.vorp || 0) - (a.vorp || 0))[0];
      
      if (bestAtPosition) {
        actions.push({
          id: 'address-need',
          label: `Best ${criticalNeed}: ${bestAtPosition.name}`,
          action: () => {
            dispatch({ type: 'TOGGLE_TARGET', payload: bestAtPosition.id });
          },
          variant: 'secondary',
          icon: <Users className="h-4 w-4" />
        });
      }
    }

    return actions;
  };

  const filteredPlayers = useMemo(() => {
    let players = state.players.filter(p => !p.isDrafted && !p.isDoNotDraft);
    
    if (positionFilter !== 'ALL') {
      players = players.filter(p => p.position === positionFilter);
    }

    return players.sort((a, b) => (b.vorp || 0) - (a.vorp || 0));
  }, [state.players, positionFilter]);


  const quickActions = getQuickActions();

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Zap className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Decision Command Center</h2>
              <p className="text-sm text-gray-600">
                {situationAnalysis.isMyTurn ? '🔥 Your pick!' : `${situationAnalysis.picksUntilTurn} picks until your turn`}
              </p>
            </div>
          </div>
          
          {/* Quick Status */}
          <div className="flex items-center space-x-4 text-sm">
            <div className="text-center">
              <div className="font-bold text-gray-900">#{state.currentPick}</div>
              <div className="text-gray-500">Current Pick</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-gray-900">{situationAnalysis.availableCount}</div>
              <div className="text-gray-500">Available</div>
            </div>
          </div>
        </div>
      </div>

      {/* Critical Alerts Bar */}
      {situationAnalysis.criticalAlerts.length > 0 && (
        <div className="px-6 py-3 bg-red-50 border-b border-red-200">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <div className="flex-1">
              <div className="text-sm font-medium text-red-800">
                Critical Alerts: {situationAnalysis.criticalAlerts.join(' • ')}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top Recommendation & Quick Actions */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Recommendation */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <Trophy className="h-5 w-5 text-yellow-500 mr-2" />
                Top Recommendation
              </h3>
              {situationAnalysis.isMyTurn && (
                <div className="flex items-center text-green-600 text-sm font-medium">
                  <Clock className="h-4 w-4 mr-1" />
                  Your Turn
                </div>
              )}
            </div>
            
            {situationAnalysis.topRecommendation ? (
              <div 
                className="p-4 border-2 border-blue-200 rounded-lg bg-blue-50 cursor-pointer hover:bg-blue-100 transition-colors"
                onClick={() => setSelectedPlayer(situationAnalysis.topRecommendation)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-bold text-lg text-gray-900">
                      {situationAnalysis.topRecommendation.name}
                    </div>
                    <div className="text-sm text-gray-600">
                      {situationAnalysis.topRecommendation.position} • {situationAnalysis.topRecommendation.team} • 
                      Tier {situationAnalysis.topRecommendation.tier}
                    </div>
                    <div className="text-lg font-bold text-blue-600 mt-1">
                      VORP: {(situationAnalysis.topRecommendation.vorp || 0).toFixed(1)}
                    </div>
                  </div>
                  {situationAnalysis.topRecommendation.isTargeted && (
                    <Target className="h-6 w-6 text-blue-500" />
                  )}
                </div>
              </div>
            ) : (
              <div className="p-4 border-2 border-gray-200 rounded-lg bg-gray-50 text-center text-gray-500">
                No recommendations available
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
              <ThumbsUp className="h-5 w-5 text-green-500 mr-2" />
              Quick Actions
            </h3>
            
            <div className="space-y-2">
              {quickActions.map(action => (
                <button
                  key={action.id}
                  onClick={action.action}
                  className={`w-full flex items-center justify-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    action.variant === 'primary'
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : action.variant === 'danger'
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  {action.icon}
                  <span>{action.label}</span>
                </button>
              ))}
              
              {quickActions.length === 0 && (
                <div className="text-center text-gray-500 py-4">
                  No quick actions available
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* View Controls */}
      <div className="px-6 py-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1">
            {[
              { id: 'recommendations', label: 'Top Players', icon: Crown },
              { id: 'comparison', label: 'VORP Bars', icon: BarChart3 },
              { id: 'chart', label: 'VORP Chart', icon: TrendingUp },
              { id: 'ai', label: 'AI Strategy', icon: Brain }
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setSelectedView(id as any)}
                className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  selectedView === id
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center space-x-4">
            {/* Position Filter */}
            <select
              value={positionFilter}
              onChange={(e) => setPositionFilter(e.target.value as Position | 'ALL')}
              className="text-sm border border-gray-300 rounded px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Positions</option>
              <option value="QB">QB</option>
              <option value="RB">RB</option>
              <option value="WR">WR</option>
              <option value="TE">TE</option>
              <option value="K">K</option>
              <option value="DEF">DEF</option>
            </select>

            {/* Advanced Toggle */}
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center space-x-1 text-sm text-gray-600 hover:text-gray-900"
            >
              {showAdvanced ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <span>Advanced</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6">
        {selectedView === 'recommendations' && (
          <div className="space-y-4">
            {filteredPlayers.slice(0, 12).map((player, index) => (
              <div
                key={player.id}
                className={`flex items-center space-x-4 p-3 rounded-lg border transition-colors cursor-pointer ${
                  player.isTargeted 
                    ? 'border-blue-300 bg-blue-50 hover:bg-blue-100'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
                onClick={() => setSelectedPlayer(player)}
              >
                <div className="w-8 text-center">
                  <span className="text-sm font-bold text-gray-500">#{index + 1}</span>
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-gray-900">{player.name}</span>
                    {player.isTargeted && <Target className="h-4 w-4 text-blue-500" />}
                  </div>
                  <div className="text-sm text-gray-600">
                    {player.position} • {player.team} • Tier {player.tier}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-lg font-bold text-blue-600">
                    {(player.vorp || 0).toFixed(1)}
                  </div>
                  <div className="text-xs text-gray-500">VORP</div>
                </div>

                <div className="text-right">
                  <div className="text-sm text-gray-600">
                    ADP: {player.adp?.toFixed(0) || 'N/A'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {selectedView === 'comparison' && (
          <VisualVORPComparison
            players={filteredPlayers}
            title={`VORP Comparison${positionFilter !== 'ALL' ? ` - ${positionFilter}` : ''}`}
            maxDisplay={15}
          />
        )}

        {selectedView === 'chart' && (
          <VORPChart
            height={250}
            showPositions={positionFilter === 'ALL' ? ['QB', 'RB', 'WR', 'TE'] : [positionFilter as Position]}
            maxPlayers={20}
          />
        )}

        {selectedView === 'ai' && (
          <AIStrategyOverlay 
            className="border-0 shadow-none" 
            collapsed={false}
          />
        )}
      </div>

      {/* Advanced Section */}
      {showAdvanced && (
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Team Needs</h4>
              <div className="space-y-1">
                {situationAnalysis.teamNeeds.map(need => (
                  <div key={need} className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <span>{need}</span>
                  </div>
                ))}
                {situationAnalysis.teamNeeds.length === 0 && (
                  <span className="text-gray-500">All positions filled</span>
                )}
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Next 3 Picks</h4>
              <div className="space-y-1">
                {state.picks
                  .filter(p => p.overall > state.currentPick)
                  .slice(0, 3)
                  .map(pick => (
                    <div key={pick.overall}>
                      Pick {pick.overall}: {state.teams.find(t => t.id === pick.team)?.name}
                    </div>
                  ))}
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Draft Stats</h4>
              <div className="space-y-1">
                <div>Round: {Math.ceil(state.currentPick / state.settings.numberOfTeams)}</div>
                <div>Total Picks: {state.picks.length}</div>
                <div>Remaining: {(state.settings.numberOfTeams * state.settings.numberOfRounds) - state.picks.length}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedDecisionDashboard;