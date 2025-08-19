import React, { useMemo } from 'react';
import { X, Target as TargetIcon } from 'lucide-react';
import { useDraft } from '../../contexts/DraftContext';
import { calculateMultiRoundReach } from '../../utils/reachProbability';
import type { Player } from '../../types';

const TargetQueue: React.FC = () => {
  const { state, dispatch } = useDraft();
  
  const targetedPlayers = useMemo(() => {
    return state.players
      .filter(p => p.isTargeted && !p.isDrafted)
      .sort((a, b) => {
        if (b.vorp && a.vorp) return b.vorp - a.vorp;
        return a.rank - b.rank;
      });
  }, [state.players]);

  const getPositionColor = (position: string) => {
    const colors: Record<string, string> = {
      QB: 'bg-red-100 text-red-800',
      RB: 'bg-green-100 text-green-800',
      WR: 'bg-blue-100 text-blue-800',
      TE: 'bg-yellow-100 text-yellow-800',
      K: 'bg-purple-100 text-purple-800',
      DEF: 'bg-gray-100 text-gray-800'
    };
    return colors[position] || 'bg-gray-100 text-gray-800';
  };

  const getMultiRoundAnalysis = (player: Player) => {
    return calculateMultiRoundReach(player, state);
  };

  const getReachProbabilityColor = (probability: number) => {
    if (probability >= 80) return 'text-green-600';
    if (probability >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const handleRemoveTarget = (playerId: string) => {
    dispatch({ type: 'TOGGLE_TARGET', payload: playerId });
  };

  const handleDraftPlayer = (playerId: string) => {
    const userTeam = state.teams.find(t => t.isUser);
    if (userTeam && state.picksUntilMyTurn === 0) {
      dispatch({ 
        type: 'MAKE_PICK', 
        payload: { playerId, teamId: userTeam.id }
      });
    }
  };

  const canDraft = state.picksUntilMyTurn === 0;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TargetIcon className="h-5 w-5 text-yellow-600" />
          <h3 className="text-lg font-semibold text-gray-900">Target Queue</h3>
          <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2 py-1 rounded-full">
            {targetedPlayers.length}
          </span>
        </div>
      </div>
      
      {targetedPlayers.length === 0 ? (
        <div className="text-center py-8">
          <TargetIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No players in your target queue</p>
          <p className="text-gray-400 text-xs mt-1">
            Click the star icon next to players to add them to your targets
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {targetedPlayers.map((player, index) => {
            const multiRoundAnalysis = getMultiRoundAnalysis(player);
            const reachProbability = multiRoundAnalysis.nextRound.probability;
            
            return (
              <div
                key={player.id}
                className="p-3 border border-yellow-200 bg-yellow-50 rounded-lg hover:bg-yellow-100 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium text-gray-600">#{index + 1}</span>
                      <div className="text-sm font-semibold text-gray-900 truncate" title={player.name}>
                        {player.name}
                      </div>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getPositionColor(player.position)}`}>
                        {player.position}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-600">
                      <div>
                        <span className="font-medium">Team:</span> {player.team}
                      </div>
                      <div>
                        <span className="font-medium">Rank:</span> {player.rank}
                      </div>
                      <div>
                        <span className="font-medium">ADP:</span> {player.adp.toFixed(1)}
                      </div>
                      {player.vorp && (
                        <div>
                          <span className="font-medium">VORP:</span> {player.vorp.toFixed(1)}
                        </div>
                      )}
                    </div>
                    
                    <div className="mt-2 space-y-2">
                      <div className="flex items-center gap-4 flex-wrap">
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-medium text-gray-600">Next Round:</span>
                          <span className={`text-xs font-bold ${getReachProbabilityColor(reachProbability)}`}>
                            {reachProbability}%
                          </span>
                        </div>
                        
                        {multiRoundAnalysis.twoRoundsAhead.probability > 0 && (
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-medium text-gray-600">2 Rounds:</span>
                            <span className={`text-xs font-bold ${getReachProbabilityColor(multiRoundAnalysis.twoRoundsAhead.probability)}`}>
                              {multiRoundAnalysis.twoRoundsAhead.probability}%
                            </span>
                          </div>
                        )}
                        
                        {state.picksUntilMyTurn > 0 && (
                          <div className="text-xs text-gray-500">
                            {state.picksUntilMyTurn} pick{state.picksUntilMyTurn !== 1 ? 's' : ''} until your turn
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-600">Strategy:</span>
                        <span className={`text-xs font-bold px-2 py-1 rounded ${
                          multiRoundAnalysis.bestStrategy.recommendation === 'Draft Now' 
                            ? 'bg-red-100 text-red-700'
                            : multiRoundAnalysis.bestStrategy.recommendation === 'Wait 1 Round'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {multiRoundAnalysis.bestStrategy.recommendation}
                        </span>
                      </div>
                      
                      <div className="text-xs text-gray-500 italic">
                        {multiRoundAnalysis.bestStrategy.reasoning}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    {canDraft && (
                      <button
                        onClick={() => handleDraftPlayer(player.id)}
                        className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                        title="Draft this player"
                      >
                        Draft
                      </button>
                    )}
                    
                    <button
                      onClick={() => handleRemoveTarget(player.id)}
                      className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                      title="Remove from targets"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      
      {targetedPlayers.length > 0 && (
        <div className="mt-4 p-3 bg-gray-50 rounded border text-xs text-gray-600">
          <div className="font-medium mb-2">Enhanced Reach Analysis:</div>
          <div className="space-y-1">
            <div className="flex flex-wrap gap-4">
              <span className="text-green-600">●</span> 80%+ likely available
              <span className="text-yellow-600">●</span> 50-79% chance available  
              <span className="text-red-600">●</span> &lt;50% chance available
            </div>
            <div className="mt-2 space-y-1">
              <div><strong>Next Round:</strong> Probability available at your next pick</div>
              <div><strong>2 Rounds:</strong> Probability available two rounds from now</div>
              <div><strong>Strategy:</strong> AI recommendation based on multi-round analysis</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TargetQueue;