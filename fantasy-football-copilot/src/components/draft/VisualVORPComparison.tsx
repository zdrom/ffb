import React from 'react';
import { TrendingUp, TrendingDown, Minus, Trophy, Target } from 'lucide-react';
import { useDraft } from '../../contexts/DraftContext';
import type { Player } from '../../types';

interface VORPBarProps {
  player: Player;
  maxVorp: number;
  isHighlighted?: boolean;
  showDetails?: boolean;
  onPlayerClick?: (player: Player) => void;
}

const VORPBar: React.FC<VORPBarProps> = ({ player, maxVorp, isHighlighted, showDetails = true, onPlayerClick }) => {
  const vorp = player.vorp || 0;
  const percentage = maxVorp > 0 ? Math.max(5, (vorp / maxVorp) * 100) : 5;
  
  const getVORPColor = (vorp: number) => {
    if (vorp >= 30) return 'bg-gradient-to-r from-green-500 to-emerald-600';
    if (vorp >= 20) return 'bg-gradient-to-r from-blue-500 to-blue-600';
    if (vorp >= 10) return 'bg-gradient-to-r from-yellow-500 to-yellow-600';
    if (vorp >= 5) return 'bg-gradient-to-r from-orange-500 to-orange-600';
    return 'bg-gradient-to-r from-gray-400 to-gray-500';
  };

  const getTrendIcon = (player: Player) => {
    // This would integrate with your trend analysis
    const adpDiff = (player.adp || 0) - (player.rank || 0);
    if (adpDiff > 10) return <TrendingUp className="h-3 w-3 text-green-500" />;
    if (adpDiff < -10) return <TrendingDown className="h-3 w-3 text-red-500" />;
    return <Minus className="h-3 w-3 text-gray-400" />;
  };

  return (
    <div 
      className={`group cursor-pointer transition-all duration-200 hover:scale-105 ${isHighlighted ? 'ring-2 ring-blue-400 bg-blue-50' : ''}`}
      onClick={() => onPlayerClick?.(player)}
    >
      <div className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50">
        {/* Player Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-1">
            <span className="text-sm font-medium text-gray-900 truncate">
              {player.name}
            </span>
            {player.isTargeted && <Target className="h-3 w-3 text-blue-500" />}
            {getTrendIcon(player)}
          </div>
          {showDetails && (
            <div className="text-xs text-gray-600">
              {player.position} • {player.team} • Tier {player.tier}
            </div>
          )}
        </div>

        {/* VORP Bar */}
        <div className="flex items-center space-x-2 w-32">
          <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
            <div 
              className={`h-full transition-all duration-700 ease-out ${getVORPColor(vorp)}`}
              style={{ width: `${percentage}%` }}
            />
          </div>
          <span className="text-sm font-bold text-gray-900 w-8 text-right">
            {vorp.toFixed(0)}
          </span>
        </div>

        {/* ADP Comparison */}
        {showDetails && (
          <div className="text-xs text-gray-500 w-16 text-right">
            ADP: {player.adp?.toFixed(0) || 'N/A'}
          </div>
        )}
      </div>
    </div>
  );
};

interface VisualVORPComparisonProps {
  players?: Player[];
  title?: string;
  maxDisplay?: number;
  showPositionBreakdown?: boolean;
  onPlayerSelect?: (player: Player) => void;
}

const VisualVORPComparison: React.FC<VisualVORPComparisonProps> = ({ 
  players: propPlayers,
  title = "VORP Comparison",
  maxDisplay = 12,
  showPositionBreakdown = false,
  onPlayerSelect
}) => {
  const { state, dispatch } = useDraft();
  
  const players = propPlayers || state.players.filter(p => !p.isDrafted && !p.isDoNotDraft);
  const sortedPlayers = players.sort((a, b) => (b.vorp || 0) - (a.vorp || 0)).slice(0, maxDisplay);
  const maxVorp = Math.max(...sortedPlayers.map(p => p.vorp || 0));

  const handlePlayerClick = (player: Player) => {
    if (onPlayerSelect) {
      onPlayerSelect(player);
    } else {
      // Default action: toggle target
      dispatch({ type: 'TOGGLE_TARGET', payload: player.id });
    }
  };

  const getPositionBreakdown = () => {
    const breakdown = players.reduce((acc, player) => {
      const pos = player.position;
      if (!acc[pos]) acc[pos] = [];
      acc[pos].push(player);
      return acc;
    }, {} as Record<string, Player[]>);

    return Object.entries(breakdown)
      .map(([position, posPlayers]) => ({
        position,
        players: posPlayers.sort((a, b) => (b.vorp || 0) - (a.vorp || 0)).slice(0, 5),
        avgVorp: posPlayers.reduce((sum, p) => sum + (p.vorp || 0), 0) / posPlayers.length
      }))
      .sort((a, b) => b.avgVorp - a.avgVorp);
  };

  if (sortedPlayers.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center">
        <div className="text-gray-500">No players available for VORP comparison</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Trophy className="h-5 w-5 text-yellow-500 mr-2" />
            {title}
          </h3>
          <div className="text-sm text-gray-500">
            Top {sortedPlayers.length} Available
          </div>
        </div>
      </div>

      {!showPositionBreakdown ? (
        <div className="p-6 space-y-1">
          {sortedPlayers.map((player, index) => (
            <div key={player.id} className="flex items-center space-x-2">
              <div className="w-6 text-sm text-gray-500 font-medium">
                #{index + 1}
              </div>
              <div className="flex-1">
                <VORPBar
                  player={player}
                  maxVorp={maxVorp}
                  isHighlighted={player.isTargeted}
                  onPlayerClick={handlePlayerClick}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-6">
          {getPositionBreakdown().map(({ position, players: posPlayers }) => (
            <div key={position} className="mb-6 last:mb-0">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-gray-800 flex items-center">
                  <span className={`inline-block w-3 h-3 rounded mr-2 ${
                    position === 'QB' ? 'bg-red-500' :
                    position === 'RB' ? 'bg-green-500' :
                    position === 'WR' ? 'bg-blue-500' :
                    position === 'TE' ? 'bg-yellow-500' :
                    'bg-gray-500'
                  }`} />
                  {position}
                </h4>
                <div className="text-xs text-gray-500">
                  Avg VORP: {posPlayers.reduce((sum, p) => sum + (p.vorp || 0), 0) / posPlayers.length}
                </div>
              </div>
              <div className="space-y-1">
                {posPlayers.map((player) => (
                  <VORPBar
                    key={player.id}
                    player={player}
                    maxVorp={maxVorp}
                    isHighlighted={player.isTargeted}
                    showDetails={false}
                    onPlayerClick={handlePlayerClick}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* VORP Legend */}
      <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 rounded-b-lg">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1">
              <div className="w-3 h-2 bg-gradient-to-r from-green-500 to-emerald-600 rounded"></div>
              <span>Elite (30+)</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-2 bg-gradient-to-r from-blue-500 to-blue-600 rounded"></div>
              <span>Great (20+)</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-2 bg-gradient-to-r from-yellow-500 to-yellow-600 rounded"></div>
              <span>Good (10+)</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-2 bg-gradient-to-r from-orange-500 to-orange-600 rounded"></div>
              <span>Average (5+)</span>
            </div>
          </div>
          <div className="text-gray-500">
            Click to target • {maxVorp.toFixed(0)} max VORP
          </div>
        </div>
      </div>
    </div>
  );
};

export default VisualVORPComparison;