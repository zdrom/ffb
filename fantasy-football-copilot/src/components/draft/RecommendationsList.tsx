import React, { useMemo } from 'react';
import { TrendingUp, Star, Target, AlertTriangle, CheckCircle, Clock, BarChart3 } from 'lucide-react';
import { useDraft } from '../../contexts/DraftContext';
import { VORPOnlyRecommendationsEngine } from '../../utils/vorpOnlyRecommendations';
import type { Recommendation } from '../../types';

const RecommendationsList: React.FC = () => {
  const { state, dispatch } = useDraft();

  const recommendations: Recommendation[] = useMemo(() => {
    const userTeam = state.teams.find(t => t.isUser);
    if (!userTeam || state.players.length === 0) return [];

    const engine = new VORPOnlyRecommendationsEngine(
      state.players,
      userTeam,
      state.teams,
      state.settings,
      state.currentPick,
      state.picks
    );

    return engine.getRecommendations(12);
  }, [state.players, state.teams, state.settings, state.currentPick, state.picks]);

  const handleDraftPlayer = (playerId: string) => {
    const userTeam = state.teams.find(t => t.isUser);
    if (userTeam && state.picksUntilMyTurn === 0) {
      dispatch({ 
        type: 'MAKE_PICK', 
        payload: { playerId, teamId: userTeam.id }
      });
    }
  };

  const handleToggleTarget = (playerId: string) => {
    dispatch({ type: 'TOGGLE_TARGET', payload: playerId });
  };

  const getUrgencyColor = (urgency: 'High' | 'Medium' | 'Low') => {
    switch (urgency) {
      case 'High': return 'text-red-600 bg-red-50 border-red-200';
      case 'Medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'Low': return 'text-green-600 bg-green-50 border-green-200';
    }
  };

  const getUrgencyIcon = (urgency: 'High' | 'Medium' | 'Low') => {
    switch (urgency) {
      case 'High': return <AlertTriangle className="h-4 w-4" />;
      case 'Medium': return <Clock className="h-4 w-4" />;
      case 'Low': return <CheckCircle className="h-4 w-4" />;
    }
  };

  const getPositionColor = (position: string) => {
    const colors: { [key: string]: string } = {
      QB: 'bg-red-100 text-red-800',
      RB: 'bg-green-100 text-green-800',
      WR: 'bg-blue-100 text-blue-800',
      TE: 'bg-yellow-100 text-yellow-800',
      K: 'bg-purple-100 text-purple-800',
      DEF: 'bg-gray-100 text-gray-800'
    };
    return colors[position] || 'bg-gray-100 text-gray-800';
  };

  const getTierColor = (tier: number) => {
    const colors: { [key: number]: string } = {
      1: 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-yellow-900', // Elite - Gold
      2: 'bg-gradient-to-r from-blue-400 to-blue-500 text-blue-900',       // Very Good - Blue  
      3: 'bg-gradient-to-r from-green-400 to-green-500 text-green-900',    // Startable - Green
      4: 'bg-gradient-to-r from-gray-400 to-gray-500 text-gray-900'        // Replacement - Gray
    };
    return colors[tier] || colors[4];
  };

  const getTierLabel = (tier: number) => {
    const labels: { [key: number]: string } = {
      1: 'ELITE',
      2: 'TIER 1', 
      3: 'TIER 2',
      4: 'TIER 3'
    };
    return labels[tier] || 'TIER 3';
  };

  const isMyTurn = state.picksUntilMyTurn === 0 && state.isActive;

  if (recommendations.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center mb-4">
          <TrendingUp className="h-5 w-5 text-gray-500 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">Player Recommendations</h2>
        </div>
        <div className="text-center py-8">
          <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">
            VORP-based recommendations will appear here once you've imported your VORP rankings.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <BarChart3 className="h-5 w-5 text-blue-600 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">VORP-Based Recommendations</h2>
          </div>
          <div className="text-sm text-gray-500">
            {isMyTurn ? 'Your pick!' : `${state.picksUntilMyTurn} picks until your turn`}
          </div>
        </div>
      </div>

      <div className="divide-y divide-gray-200">
        {recommendations.map((rec, index) => (
          <div key={rec.player.id} className="p-4 hover:bg-gray-50">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center mb-2">
                  <div className="flex items-center space-x-3">
                    <span className="text-lg font-semibold text-gray-900">
                      #{index + 1}
                    </span>
                    
                    {/* Prominent Tier Badge */}
                    <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold shadow-sm ${getTierColor(rec.player.tier)}`}>
                      {getTierLabel(rec.player.tier)}
                    </div>
                    
                    <span className="font-medium text-gray-900">
                      {rec.player.name}
                    </span>
                    
                    {rec.reasons.some(reason => reason.includes('Elite VORP')) && (
                      <div className="flex items-center px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium border border-green-200">
                        <BarChart3 className="h-3 w-3 mr-1" />
                        Elite VORP
                      </div>
                    )}
                    {rec.player.isTargeted && (
                      <Star className="h-4 w-4 text-yellow-400 fill-current" />
                    )}
                  </div>
                  <div className="ml-auto flex items-center space-x-2">
                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border ${getUrgencyColor(rec.urgency)}`}>
                      {getUrgencyIcon(rec.urgency)}
                      <span className="ml-1">{rec.urgency}</span>
                    </span>
                    {rec.isValue && (
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                        Value
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-4 text-sm text-gray-600 mb-2">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPositionColor(rec.player.position)}`}>
                    {rec.player.position}
                  </span>
                  <span>{rec.player.team}</span>
                  <span>Rank: {rec.player.rank}</span>
                  <span>Tier: {rec.player.tier}</span>
                  {rec.player.adp !== 999 && (
                    <span>ADP: {rec.player.adp.toFixed(1)}</span>
                  )}
                  <span className="font-semibold">VORP: {rec.score}</span>
                </div>

                {rec.reasons.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {rec.reasons.map((reason, reasonIndex) => {
                      const isEliteVORP = reason.includes('Elite VORP');
                      const isStrongVORP = reason.includes('Strong VORP');
                      const isGoodVORP = reason.includes('Good VORP') || reason.includes('vs replacement');
                      const isPositionLeader = reason.includes('Best VORP available');
                      const isNeed = reason.includes('need') || reason.includes('depth');
                      
                      let reasonClass = 'inline-flex items-center px-2 py-1 rounded text-xs border';
                      
                      if (isEliteVORP) {
                        reasonClass += ' bg-green-50 text-green-700 border-green-200 font-medium';
                      } else if (isStrongVORP) {
                        reasonClass += ' bg-green-50 text-green-600 border-green-200';
                      } else if (isGoodVORP) {
                        reasonClass += ' bg-blue-50 text-blue-700 border-blue-200';
                      } else if (isPositionLeader) {
                        reasonClass += ' bg-yellow-50 text-yellow-700 border-yellow-200';
                      } else if (isNeed) {
                        reasonClass += ' bg-orange-50 text-orange-700 border-orange-200';
                      } else {
                        reasonClass += ' bg-gray-50 text-gray-700 border-gray-200';
                      }
                      
                      return (
                        <span
                          key={reasonIndex}
                          className={reasonClass}
                        >
                          {reason}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-2 ml-4">
                <button
                  onClick={() => handleToggleTarget(rec.player.id)}
                  className={`p-2 rounded-full hover:bg-gray-100 ${rec.player.isTargeted ? 'text-yellow-600' : 'text-gray-400'}`}
                  title={rec.player.isTargeted ? 'Remove from targets' : 'Add to targets'}
                >
                  <Star className={`h-4 w-4 ${rec.player.isTargeted ? 'fill-current' : ''}`} />
                </button>

                {isMyTurn && (
                  <button
                    onClick={() => handleDraftPlayer(rec.player.id)}
                    className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                  >
                    <Target className="h-4 w-4 mr-1 inline" />
                    Draft
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RecommendationsList;