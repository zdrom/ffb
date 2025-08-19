import React, { useState, useMemo } from 'react';
import { useDraft } from '../contexts/DraftContext';
import { addPlayerNameMapping, suggestMapping } from '../utils/playerNameMapping';
import type { Player } from '../types';

interface PlayerMappingPopupProps {
  unmappedPlayerName: string;
  onMap: (selectedPlayer: Player) => void;
  onSkip: () => void;
  onClose: () => void;
}

export const PlayerMappingPopup: React.FC<PlayerMappingPopupProps> = ({
  unmappedPlayerName,
  onMap,
  onSkip,
  onClose
}) => {
  const { state } = useDraft();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  // Get suggested players based on name similarity
  const suggestedPlayers = useMemo(() => {
    return suggestMapping(unmappedPlayerName, state.players);
  }, [unmappedPlayerName, state.players]);

  // Filter available players based on search term
  const filteredPlayers = useMemo(() => {
    if (!searchTerm.trim()) {
      return state.players
        .filter(p => !p.isDrafted)
        .slice(0, 50) // Show first 50 for performance
        .sort((a, b) => (b.vorp || 0) - (a.vorp || 0));
    }

    const normalizedSearch = searchTerm.toLowerCase().trim();
    return state.players
      .filter(p => {
        if (p.isDrafted) return false;
        const normalizedName = p.name.toLowerCase();
        return normalizedName.includes(normalizedSearch) || 
               normalizedSearch.includes(normalizedName) ||
               p.position.toLowerCase().includes(normalizedSearch);
      })
      .slice(0, 50)
      .sort((a, b) => (b.vorp || 0) - (a.vorp || 0));
  }, [searchTerm, state.players]);

  const handleMapPlayer = () => {
    if (!selectedPlayer) return;
    
    // Add the mapping
    addPlayerNameMapping(unmappedPlayerName, selectedPlayer.name);
    
    // Call the onMap callback
    onMap(selectedPlayer);
  };

  const handlePlayerSelect = (player: Player) => {
    setSelectedPlayer(player);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Map Player: "{unmappedPlayerName}"
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Select a player from your rankings to map to this name
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col p-6">
          {/* Search */}
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search your players..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>

          {/* Suggestions */}
          {suggestedPlayers.length > 0 && !searchTerm && (
            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                Suggested matches:
              </h3>
              <div className="space-y-1">
                {suggestedPlayers.map((player) => (
                  <button
                    key={player.id}
                    onClick={() => handlePlayerSelect(player)}
                    className={`w-full text-left p-2 rounded border transition-colors ${
                      selectedPlayer?.id === player.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium">{player.name}</span>
                        <span className="ml-2 text-sm text-gray-500">
                          {player.position} • {player.team}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        VORP: {player.vorp?.toFixed(1) || 'N/A'}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              <hr className="my-4" />
            </div>
          )}

          {/* Player List */}
          <div className="flex-1 overflow-y-auto">
            <h3 className="text-sm font-medium text-gray-700 mb-2">
              {searchTerm ? 'Search results:' : 'All players:'} ({filteredPlayers.length})
            </h3>
            <div className="space-y-1">
              {filteredPlayers.map((player) => (
                <button
                  key={player.id}
                  onClick={() => handlePlayerSelect(player)}
                  className={`w-full text-left p-2 rounded border transition-colors ${
                    selectedPlayer?.id === player.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">{player.name}</span>
                      <span className="ml-2 text-sm text-gray-500">
                        {player.position} • {player.team}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600">
                      VORP: {player.vorp?.toFixed(1) || 'N/A'}
                    </div>
                  </div>
                </button>
              ))}
              
              {filteredPlayers.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No players found matching "{searchTerm}"
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {selectedPlayer ? (
              <span>Selected: <strong>{selectedPlayer.name}</strong></span>
            ) : (
              <span>Select a player to create mapping</span>
            )}
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={onSkip}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              Skip
            </button>
            <button
              onClick={handleMapPlayer}
              disabled={!selectedPlayer}
              className={`px-4 py-2 rounded-md transition-colors ${
                selectedPlayer
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              Map Player
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};