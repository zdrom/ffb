import React, { useState, useMemo } from 'react';
import { Star, Ban, Trophy, Target, ChevronDown, ChevronUp, Filter } from 'lucide-react';
import { useDraft } from '../../contexts/DraftContext';
import type { Position } from '../../types';

const PlayerList: React.FC = () => {
  const { state, dispatch } = useDraft();
  const [selectedPosition, setSelectedPosition] = useState<Position | 'ALL'>('ALL');
  const [selectedTier, setSelectedTier] = useState<number | 'ALL'>('ALL');
  const [showTargetsOnly, setShowTargetsOnly] = useState(false);
  const [hideDoNotDraft, setHideDoNotDraft] = useState(true);
  const [sortBy, setSortBy] = useState<'rank' | 'adp' | 'tier'>('rank');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const positions: (Position | 'ALL')[] = ['ALL', 'QB', 'RB', 'WR', 'TE', 'K', 'DEF'];

  const filteredAndSortedPlayers = useMemo(() => {
    let filtered = state.players.filter(player => {
      if (player.isDrafted) return false;
      if (selectedPosition !== 'ALL' && player.position !== selectedPosition) return false;
      if (selectedTier !== 'ALL' && player.tier !== selectedTier) return false;
      if (showTargetsOnly && !player.isTargeted) return false;
      if (hideDoNotDraft && player.isDoNotDraft) return false;
      return true;
    });

    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'rank':
          comparison = a.rank - b.rank;
          break;
        case 'adp':
          comparison = a.adp - b.adp;
          break;
        case 'tier':
          comparison = a.tier - b.tier || a.rank - b.rank;
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [state.players, selectedPosition, selectedTier, showTargetsOnly, hideDoNotDraft, sortBy, sortDirection]);

  const handleSort = (field: 'rank' | 'adp' | 'tier') => {
    if (sortBy === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: 'rank' | 'adp' | 'tier') => {
    if (sortBy !== field) return null;
    return sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />;
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

  const handleToggleTarget = (playerId: string) => {
    dispatch({ type: 'TOGGLE_TARGET', payload: playerId });
  };

  const handleToggleDoNotDraft = (playerId: string) => {
    dispatch({ type: 'TOGGLE_DO_NOT_DRAFT', payload: playerId });
  };

  const getPositionColor = (position: Position) => {
    const colors = {
      QB: 'bg-red-100 text-red-800',
      RB: 'bg-green-100 text-green-800',
      WR: 'bg-blue-100 text-blue-800',
      TE: 'bg-yellow-100 text-yellow-800',
      K: 'bg-purple-100 text-purple-800',
      DEF: 'bg-gray-100 text-gray-800'
    };
    return colors[position] || 'bg-gray-100 text-gray-800';
  };

  const getPlayoffBadgeColor = (schedule?: 'Good' | 'Avg' | 'Tough') => {
    if (!schedule) return '';
    const colors = {
      Good: 'bg-green-100 text-green-800',
      Avg: 'bg-yellow-100 text-yellow-800',
      Tough: 'bg-red-100 text-red-800'
    };
    return colors[schedule];
  };

  const getTierColor = (tier: number) => {
    const colors: { [key: number]: string } = {
      1: 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-yellow-900 border-yellow-600', // Elite - Gold
      2: 'bg-gradient-to-r from-blue-400 to-blue-500 text-blue-900 border-blue-600',       // Very Good - Blue  
      3: 'bg-gradient-to-r from-green-400 to-green-500 text-green-900 border-green-600',    // Startable - Green
      4: 'bg-gradient-to-r from-gray-400 to-gray-500 text-gray-900 border-gray-600'        // Replacement - Gray
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

  const getBadgeByeWeek = (bye: number) => {
    if (bye === 0) return null;
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
        Bye {bye}
      </span>
    );
  };

  const isMyTurn = state.picksUntilMyTurn === 0 && state.isActive;

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Available Players</h2>
          <div className="text-sm text-gray-500">
            {filteredAndSortedPlayers.length} players available
          </div>
        </div>
        
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={selectedPosition}
              onChange={(e) => setSelectedPosition(e.target.value as Position | 'ALL')}
              className="text-sm border-gray-300 rounded-md"
            >
              {positions.map(pos => (
                <option key={pos} value={pos}>{pos}</option>
              ))}
            </select>
          </div>
          
          <div className="flex items-center space-x-2">
            <select
              value={selectedTier}
              onChange={(e) => setSelectedTier(e.target.value === 'ALL' ? 'ALL' : parseInt(e.target.value))}
              className="text-sm border-gray-300 rounded-md"
            >
              <option value="ALL">All Tiers</option>
              <option value="1">ELITE</option>
              <option value="2">TIER 1</option>
              <option value="3">TIER 2</option>
              <option value="4">TIER 3</option>
            </select>
          </div>
          
          <label className="flex items-center text-sm">
            <input
              type="checkbox"
              checked={showTargetsOnly}
              onChange={(e) => setShowTargetsOnly(e.target.checked)}
              className="rounded border-gray-300 mr-2"
            />
            Targets only
          </label>
          
          <label className="flex items-center text-sm">
            <input
              type="checkbox"
              checked={hideDoNotDraft}
              onChange={(e) => setHideDoNotDraft(e.target.checked)}
              className="rounded border-gray-300 mr-2"
            />
            Hide do-not-draft
          </label>
        </div>
      </div>

      <div className="overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Player
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('rank')}
              >
                <div className="flex items-center space-x-1">
                  <span>Rank</span>
                  {getSortIcon('rank')}
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('adp')}
              >
                <div className="flex items-center space-x-1">
                  <span>ADP</span>
                  {getSortIcon('adp')}
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Info
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredAndSortedPlayers.map((player) => (
              <tr 
                key={player.id} 
                className={`hover:bg-gray-50 ${player.isTargeted ? 'bg-blue-50' : ''} ${player.isDoNotDraft ? 'bg-red-50 opacity-60' : ''}`}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900 flex items-center space-x-2">
                        <span>{player.name}</span>
                        {player.isTargeted && (
                          <Star className="h-4 w-4 text-yellow-400 fill-current" />
                        )}
                        {player.isDoNotDraft && (
                          <Ban className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                      <div className="text-sm text-gray-500 flex items-center space-x-2 mt-1">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPositionColor(player.position)}`}>
                          {player.position}
                        </span>
                        <span>{player.team}</span>
                        {/* Prominent Tier Badge in Player List */}
                        <div className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border shadow-sm ${getTierColor(player.tier)}`}>
                          {getTierLabel(player.tier)}
                        </div>
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {player.rank}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {player.adp === 999 ? '-' : player.adp.toFixed(1)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center space-x-2">
                    {getBadgeByeWeek(player.byeWeek)}
                    {player.playoffSchedule && (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getPlayoffBadgeColor(player.playoffSchedule)}`}>
                        PO: {player.playoffSchedule}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                  <button
                    onClick={() => handleToggleTarget(player.id)}
                    className={`text-yellow-600 hover:text-yellow-900 ${player.isTargeted ? 'opacity-100' : 'opacity-50'}`}
                    title={player.isTargeted ? 'Remove from targets' : 'Add to targets'}
                  >
                    <Star className={`h-4 w-4 ${player.isTargeted ? 'fill-current' : ''}`} />
                  </button>
                  
                  <button
                    onClick={() => handleToggleDoNotDraft(player.id)}
                    className={`text-red-600 hover:text-red-900 ${player.isDoNotDraft ? 'opacity-100' : 'opacity-50'}`}
                    title={player.isDoNotDraft ? 'Remove from do-not-draft' : 'Add to do-not-draft'}
                  >
                    <Ban className="h-4 w-4" />
                  </button>
                  
                  {isMyTurn && (
                    <button
                      onClick={() => handleDraftPlayer(player.id)}
                      className="text-green-600 hover:text-green-900"
                      title="Draft this player"
                    >
                      <Target className="h-4 w-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {filteredAndSortedPlayers.length === 0 && (
        <div className="text-center py-12">
          <Trophy className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No players found</h3>
          <p className="text-gray-500">
            Try adjusting your filters or search criteria.
          </p>
        </div>
      )}
    </div>
  );
};

export default React.memo(PlayerList);