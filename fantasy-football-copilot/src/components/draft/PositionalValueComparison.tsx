import React, { useMemo } from 'react';
import { BarChart3, Crown, Target } from 'lucide-react';
import { useDraft } from '../../contexts/DraftContext';
import { DynamicVORPEngine } from '../../utils/dynamicVORP';
import { VORPOnlyRecommendationsEngine } from '../../utils/vorpOnlyRecommendations';
import type { Position } from '../../types';

const PositionalValueComparison: React.FC = () => {
  const { state } = useDraft();

  const { vorpByPosition, starterSatisfaction, topRecommendation, vorpEngine, userTeam } = useMemo(() => {
    const userTeam = state.teams.find(t => t.isUser);
    if (!userTeam || state.players.length === 0) {
      return { vorpByPosition: new Map(), starterSatisfaction: new Map(), topRecommendation: null, vorpEngine: null, userTeam: null };
    }

    const vorpEngine = new DynamicVORPEngine(state.players, state.settings, state.teams);
    const positions: Position[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
    const vorpByPosition = new Map();
    const starterSatisfaction = new Map();

    // Get top VORP recommendation
    const recEngine = new VORPOnlyRecommendationsEngine(
      state.players,
      userTeam,
      state.teams,
      state.settings,
      state.currentPick,
      state.picks
    );
    const recommendations = recEngine.getRecommendations(1);
    const topRecommendation = recommendations[0] || null;

    positions.forEach(position => {
      const availablePlayers = state.players.filter(p => 
        p.position === position && 
        !p.isDrafted && 
        !p.isDoNotDraft &&
        positions.includes(p.position) // Only include valid positions
      );

      const playersWithVORP = availablePlayers
        .map(p => ({
          player: p,
          vorp: vorpEngine.calculateDynamicVORP(p)
        }))
        .sort((a, b) => b.vorp - a.vorp)
        .slice(0, 6); // Leader + next 5

      vorpByPosition.set(position, playersWithVORP);

      // Calculate detailed team starter distribution
      const requiredStarters = state.settings.rosterSlots[position] || 0;
      const starterDistribution: number[] = new Array(requiredStarters + 1).fill(0);
      let teamsSatisfied = 0;
      
      state.teams.forEach(team => {
        const positionCount = team.roster[position]?.length || 0;
        const startersFilled = Math.min(positionCount, requiredStarters);
        starterDistribution[startersFilled]++;
        
        if (positionCount >= requiredStarters) {
          teamsSatisfied++;
        }
      });

      starterSatisfaction.set(position, {
        teamsSatisfied,
        totalTeams: state.teams.length,
        requiredStarters,
        percentSatisfied: Math.round((teamsSatisfied / state.teams.length) * 100),
        distribution: starterDistribution
      });
    });

    return { vorpByPosition, starterSatisfaction, topRecommendation, vorpEngine, userTeam };
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

  const positions: Position[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];

  if (!userTeam) {
    return <div>Loading...</div>;
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center">
          <BarChart3 className="h-5 w-5 text-blue-600 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">VORP Leaders by Position</h2>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          Top VORP values at each position with next 5 options below
        </p>
      </div>

      <div className="p-6">
        {/* Top VORP Recommendation */}
        {topRecommendation && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center mb-2">
              <Target className="h-5 w-5 text-blue-600 mr-2" />
              <h3 className="text-lg font-semibold text-blue-900">Recommended Pick</h3>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="mr-4">
                  <div className="font-bold text-xl text-gray-900">{topRecommendation.player.name}</div>
                  <div className="text-sm text-gray-600">{topRecommendation.player.team} - {topRecommendation.player.position}</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-blue-600">
                    VORP: {vorpEngine ? vorpEngine.calculateDynamicVORP(topRecommendation.player).toFixed(1) : 'N/A'}
                  </div>
                  <div className="text-sm text-gray-600">{topRecommendation.reasons?.join(', ') || 'Top VORP value'}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {positions.map(position => {
            const playersWithVORP = vorpByPosition.get(position) || [];
            const leader = playersWithVORP[0];
            const nextFive = playersWithVORP.slice(1, 6);
            const satisfaction = starterSatisfaction.get(position);

            // Calculate VORP dropoff for visualization
            const vorpValues = playersWithVORP.map(p => p.vorp);
            const maxVORP = Math.max(...vorpValues);
            const minVORP = Math.min(...vorpValues);

            return (
              <div key={position} className="border border-gray-200 rounded-lg p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getPositionColor(position)}`}>
                    {position}
                  </div>
                  {satisfaction && (
                    <div className="text-xs text-gray-500">
                      <div className="flex justify-end space-x-1 mb-1">
                        {satisfaction.distribution.map((count, starterCount) => (
                          <div key={starterCount} className="text-center">
                            <div className="text-xs font-medium text-gray-700">{count}</div>
                            <div className="text-[10px] text-gray-400">{starterCount}</div>
                          </div>
                        ))}
                      </div>
                      <div className={`text-xs font-medium text-right ${satisfaction.percentSatisfied >= 75 ? 'text-red-600' : satisfaction.percentSatisfied >= 50 ? 'text-yellow-600' : 'text-green-600'}`}>
                        {satisfaction.percentSatisfied}% satisfied
                      </div>
                    </div>
                  )}
                </div>

                {leader ? (
                  <>
                    {/* VORP Leader */}
                    <div className="mb-4">
                      <h3 className="font-semibold text-gray-900 flex items-center text-base" title={leader.player.name}>
                        <Crown className="h-4 w-4 text-yellow-500 mr-2" />
                        {leader.player.name}
                      </h3>
                      <div className="text-lg font-bold text-blue-600 mt-1">
                        VORP: {leader.vorp.toFixed(1)}
                      </div>
                    </div>

                    {/* VORP Dropoff Visualization */}
                    {nextFive.length > 0 && (
                      <div className="mb-4">
                        <div className="text-xs font-medium text-gray-600 mb-1">VORP Dropoff:</div>
                        <div className="space-y-1">
                          {playersWithVORP.map((playerData, index) => {
                            const widthPercent = maxVORP > 0 ? (playerData.vorp / maxVORP) * 100 : 0;
                            const isLeader = index === 0;
                            
                            return (
                              <div key={playerData.player.id} className="flex items-center">
                                <div 
                                  className={`h-2 rounded transition-all ${
                                    isLeader ? 'bg-blue-500' : 'bg-gray-300'
                                  }`}
                                  style={{ width: `${Math.max(widthPercent, 5)}%` }}
                                />
                                <span className={`ml-2 text-xs ${isLeader ? 'font-medium text-gray-800' : 'text-gray-500'}`}>
                                  {playerData.vorp.toFixed(1)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Next 5 Options */}
                    {nextFive.length > 0 && (
                      <div className="border-t border-gray-100 pt-3">
                        <div className="text-xs font-medium text-gray-600 mb-2">Next Best Options:</div>
                        <div className="space-y-1">
                          {nextFive.map((playerData, index) => {
                            const vorpDiff = leader.vorp - playerData.vorp;
                            
                            return (
                              <div key={playerData.player.id} className="flex justify-between items-center text-sm text-gray-700">
                                <span className="truncate">{playerData.player.name}</span>
                                <div className="flex items-center ml-2">
                                  <span className="text-xs text-red-500 font-medium mr-1">
                                    -{vorpDiff.toFixed(1)}
                                  </span>
                                  <span className="text-xs text-gray-500 font-medium">
                                    {playerData.vorp.toFixed(1)}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-6">
                    <div className="text-gray-400 mb-1">No players available</div>
                    <div className="text-xs text-gray-500">All {position}s drafted</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PositionalValueComparison;