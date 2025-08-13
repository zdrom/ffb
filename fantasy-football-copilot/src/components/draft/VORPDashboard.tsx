import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus, Crown, BarChart3, AlertTriangle } from 'lucide-react';
import { useDraft } from '../../contexts/DraftContext';
import { VORPOnlyRecommendationsEngine } from '../../utils/vorpOnlyRecommendations';
import { DynamicVORPEngine } from '../../utils/dynamicVORP';
import type { Position } from '../../types';

const VORPDashboard: React.FC = () => {
  const { state } = useDraft();

  const { bestByPosition, lastDraftedChanges, positionAnalysis } = useMemo(() => {
    const userTeam = state.teams.find(t => t.isUser);
    if (!userTeam || state.players.length === 0) {
      return { bestByPosition: {} as any, lastDraftedChanges: {} as any, positionAnalysis: {} as any };
    }

    const engine = new VORPOnlyRecommendationsEngine(
      state.players,
      userTeam,
      state.teams,
      state.settings,
      state.currentPick,
      state.picks
    );

    const dynamicVORP = new DynamicVORPEngine(state.players, state.settings, state.teams);

    const bestByPosition = engine.getBestVORPByPosition();
    
    // Calculate VORP changes from last drafted player
    let lastDraftedChanges = {} as Record<Position, number>;
    if (state.picks.length > 0) {
      const lastPick = state.picks[state.picks.length - 1];
      if (lastPick.player) {
        lastDraftedChanges = engine.getVORPChangesAfterDraft(lastPick.player);
      }
    }

    // Get position depth analysis
    const positions: Position[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
    const positionAnalysis: Record<Position, any> = {} as any;
    positions.forEach(position => {
      positionAnalysis[position] = dynamicVORP.getPositionDepthAnalysis(position);
    });

    return { bestByPosition, lastDraftedChanges, positionAnalysis };
  }, [state.players, state.teams, state.settings, state.currentPick, state.picks]);

  const getPositionColor = (position: Position) => {
    const colors: Record<Position, string> = {
      QB: 'bg-red-100 text-red-800 border-red-200',
      RB: 'bg-green-100 text-green-800 border-green-200',
      WR: 'bg-blue-100 text-blue-800 border-blue-200',
      TE: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      K: 'bg-purple-100 text-purple-800 border-purple-200',
      DEF: 'bg-gray-100 text-gray-800 border-gray-200'
    };
    return colors[position];
  };

  const getVORPColor = (vorp: number) => {
    if (vorp >= 80) return 'text-green-600 font-bold';
    if (vorp >= 50) return 'text-green-500 font-semibold';
    if (vorp >= 30) return 'text-blue-600';
    if (vorp >= 15) return 'text-yellow-600';
    return 'text-gray-600';
  };

  const formatVORPChange = (change: number) => {
    if (change === 0) return { icon: <Minus className="h-4 w-4" />, text: '0', color: 'text-gray-500' };
    if (change > 0) return { 
      icon: <TrendingUp className="h-4 w-4" />, 
      text: `+${change.toFixed(1)}`, 
      color: 'text-green-600' 
    };
    return { 
      icon: <TrendingDown className="h-4 w-4" />, 
      text: change.toFixed(1), 
      color: 'text-red-600' 
    };
  };

  const positions: Position[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center">
          <BarChart3 className="h-5 w-5 text-blue-600 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">VORP Leaders by Position</h2>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          Best available VORP (Value Over Replacement Player) at each position
        </p>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {positions.map(position => {
            const positionData = bestByPosition[position];
            const change = lastDraftedChanges[position] || 0;
            const changeData = formatVORPChange(change);
            const analysis = positionAnalysis[position];

            return (
              <div key={position} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <div className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getPositionColor(position)}`}>
                    {position}
                    {analysis?.isPositionScarce && (
                      <AlertTriangle className="h-3 w-3 ml-1 text-orange-500" />
                    )}
                  </div>
                  {positionData && (
                    <Crown className="h-4 w-4 text-yellow-500" />
                  )}
                </div>

                {positionData ? (
                  <>
                    <div className="mb-2">
                      <h3 className="font-medium text-gray-900 truncate" title={positionData.player.name}>
                        {positionData.player.name}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {positionData.player.team} • Rank #{positionData.player.rank}
                      </p>
                    </div>

                    <div className="flex items-center justify-between mb-2">
                      <div className="text-center">
                        <div className={`text-lg font-bold ${getVORPColor(positionData.vorp)}`}>
                          {positionData.vorp.toFixed(1)}
                        </div>
                        <div className="text-xs text-gray-500">Dynamic VORP</div>
                      </div>

                      {change !== 0 && (
                        <div className={`flex items-center ${changeData.color}`}>
                          {changeData.icon}
                          <span className="ml-1 text-sm font-medium">
                            {changeData.text}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Dynamic Analysis Info */}
                    {analysis && (
                      <div className="text-xs text-gray-600 space-y-1">
                        <div className="flex justify-between">
                          <span>Available:</span>
                          <span className={analysis.totalAvailable <= 5 ? 'text-red-600 font-medium' : ''}>
                            {analysis.totalAvailable}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Quality left:</span>
                          <span className={analysis.qualityPlayersRemaining <= 2 ? 'text-orange-600 font-medium' : ''}>
                            {analysis.qualityPlayersRemaining}
                          </span>
                        </div>
                        {analysis.isPositionScarce && (
                          <div className="text-orange-600 font-medium">Position Scarce!</div>
                        )}
                      </div>
                    )}

                    {positionData.player.isTargeted && (
                      <div className="mt-2 text-xs text-yellow-600 font-medium">
                        ⭐ On target list
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-4">
                    <div className="text-gray-400 mb-1">No players available</div>
                    <div className="text-xs text-gray-500">All {position}s drafted</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Dynamic VORP Legend */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Dynamic VORP System</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <h5 className="font-medium text-gray-800 mb-1">VORP Value Scale:</h5>
              <div className="space-y-1">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-green-600 rounded mr-2"></div>
                  <span>80+ Elite vs Current Replacement</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-green-500 rounded mr-2"></div>
                  <span>50-79 Strong</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-blue-600 rounded mr-2"></div>
                  <span>30-49 Good</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-yellow-600 rounded mr-2"></div>
                  <span>15-29 Moderate</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-gray-600 rounded mr-2"></div>
                  <span>&lt;15 Low</span>
                </div>
              </div>
            </div>
            <div>
              <h5 className="font-medium text-gray-800 mb-1">Key Features:</h5>
              <div className="space-y-1 text-gray-600">
                <div>• Replacement level adjusts as players are drafted</div>
                <div>• <AlertTriangle className="h-3 w-3 inline text-orange-500" /> indicates position scarcity</div>
                <div>• Quality count shows high-value players remaining</div>
                <div>• VORP recalculates based on actual draft demand</div>
              </div>
            </div>
          </div>
        </div>

        {/* Last Pick Impact */}
        {state.picks.length > 0 && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="text-sm font-medium text-blue-900 mb-1">
              Last Pick Impact: {state.picks[state.picks.length - 1].player?.name || 'Unknown'}
            </h4>
            <div className="flex flex-wrap gap-2 text-xs">
              {positions.map(pos => {
                const change = lastDraftedChanges[pos];
                if (change === 0) return null;
                const changeData = formatVORPChange(change);
                return (
                  <div key={pos} className={`flex items-center ${changeData.color}`}>
                    <span className="mr-1">{pos}:</span>
                    {changeData.icon}
                    <span className="ml-1">{changeData.text}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VORPDashboard;