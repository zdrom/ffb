import React, { useMemo } from 'react';
import { Star, Target } from 'lucide-react';
import { useDraft } from '../../contexts/DraftContext';
import type { Position, Player } from '../../types';

const TopAvailableByPosition: React.FC = () => {
  const { state, dispatch } = useDraft();
  
  const topPlayersByPosition = useMemo(() => {
    const positions: Position[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
    const result: Record<Position, Player[]> = {} as Record<Position, Player[]>;
    
    positions.forEach(position => {
      const availablePlayers = state.players
        .filter(p => p.position === position && !p.isDrafted && !p.isDoNotDraft)
        .sort((a, b) => {
          if (b.vorp && a.vorp) return b.vorp - a.vorp;
          return a.rank - b.rank;
        })
        .slice(0, 8);
      
      result[position] = availablePlayers;
    });
    
    return result;
  }, [state.players]);

  const getPositionColor = (position: Position) => {
    const colors: Record<Position, string> = {
      QB: 'border-red-300 bg-red-50',
      RB: 'border-green-300 bg-green-50',
      WR: 'border-blue-300 bg-blue-50',
      TE: 'border-yellow-300 bg-yellow-50',
      K: 'border-purple-300 bg-purple-50',
      DEF: 'border-gray-300 bg-gray-50'
    };
    return colors[position];
  };

  const getPositionTextColor = (position: Position) => {
    const colors: Record<Position, string> = {
      QB: 'text-red-800',
      RB: 'text-green-800',
      WR: 'text-blue-800',
      TE: 'text-yellow-800',
      K: 'text-purple-800',
      DEF: 'text-gray-800'
    };
    return colors[position];
  };

  const handleToggleTarget = (playerId: string) => {
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
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Available by Position</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {Object.entries(topPlayersByPosition).map(([position, players]) => (
          <div 
            key={position}
            className={`border-2 rounded-lg ${getPositionColor(position as Position)}`}
          >
            <div className={`px-3 py-2 font-semibold text-center border-b border-current ${getPositionTextColor(position as Position)}`}>
              {position}
            </div>
            
            <div className="p-2 space-y-2">
              {players.length === 0 ? (
                <div className="text-center text-gray-500 text-sm py-4">
                  No players available
                </div>
              ) : (
                players.map((player, index) => (
                  <div
                    key={player.id}
                    className={`p-2 rounded border bg-white hover:bg-gray-50 transition-colors ${
                      player.isTargeted ? 'ring-2 ring-yellow-400 bg-yellow-50' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate" title={player.name}>
                          {index + 1}. {player.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {player.team} • Rank {player.rank}
                        </div>
                        {player.vorp && (
                          <div className="text-xs font-medium text-gray-700">
                            VORP: {player.vorp.toFixed(1)}
                          </div>
                        )}
                        <div className="text-xs text-gray-500">
                          ADP: {player.adp.toFixed(1)}
                        </div>
                      </div>
                      
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => handleToggleTarget(player.id)}
                          className={`p-1 rounded transition-colors ${
                            player.isTargeted
                              ? 'text-yellow-600 hover:text-yellow-700 bg-yellow-100'
                              : 'text-gray-400 hover:text-yellow-600'
                          }`}
                          title={player.isTargeted ? 'Remove from targets' : 'Add to targets'}
                        >
                          {player.isTargeted ? <Star className="h-3 w-3 fill-current" /> : <Target className="h-3 w-3" />}
                        </button>
                        
                        {canDraft && (
                          <button
                            onClick={() => handleDraftPlayer(player.id)}
                            className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                            title="Draft this player"
                          >
                            Draft
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
      
      {!canDraft && (
        <div className="mt-4 text-center text-sm text-gray-500">
          {state.picksUntilMyTurn} pick{state.picksUntilMyTurn !== 1 ? 's' : ''} until your turn
        </div>
      )}
    </div>
  );
};

export default TopAvailableByPosition;