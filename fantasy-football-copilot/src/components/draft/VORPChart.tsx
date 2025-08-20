import React, { useMemo } from 'react';
import { BarChart3, TrendingUp, Target } from 'lucide-react';
import { useDraft } from '../../contexts/DraftContext';
import type { Player, Position } from '../../types';

interface VORPChartProps {
  height?: number;
  showPositions?: Position[];
  maxPlayers?: number;
}

const VORPChart: React.FC<VORPChartProps> = ({ 
  height = 200, 
  showPositions = ['QB', 'RB', 'WR', 'TE'],
  maxPlayers = 20
}) => {
  const { state } = useDraft();

  const chartData = useMemo(() => {
    const availablePlayers = state.players
      .filter(p => !p.isDrafted && !p.isDoNotDraft && showPositions.includes(p.position))
      .sort((a, b) => (b.vorp || 0) - (a.vorp || 0))
      .slice(0, maxPlayers);

    const maxVorp = Math.max(...availablePlayers.map(p => p.vorp || 0));
    const minVorp = Math.min(...availablePlayers.map(p => p.vorp || 0));

    return {
      players: availablePlayers,
      maxVorp,
      minVorp,
      range: maxVorp - minVorp
    };
  }, [state.players, showPositions, maxPlayers]);

  const getBarHeight = (vorp: number) => {
    if (chartData.range === 0) return 20;
    return Math.max(20, ((vorp - chartData.minVorp) / chartData.range) * (height - 40));
  };

  const getPositionColor = (position: Position) => {
    const colors = {
      QB: '#ef4444', // red
      RB: '#22c55e', // green
      WR: '#3b82f6', // blue
      TE: '#f59e0b', // yellow
      K: '#8b5cf6',  // purple
      DEF: '#6b7280' // gray
    };
    return colors[position] || '#6b7280';
  };

  const getTierLabel = (vorp: number) => {
    if (vorp >= 30) return 'Elite';
    if (vorp >= 20) return 'Great';
    if (vorp >= 10) return 'Good';
    if (vorp >= 5) return 'Average';
    return 'Below Avg';
  };

  const getTierLines = () => {
    const lines = [30, 20, 10, 5];
    return lines
      .filter(line => line <= chartData.maxVorp && line >= chartData.minVorp)
      .map(line => ({
        value: line,
        y: height - 20 - getBarHeight(line),
        label: getTierLabel(line)
      }));
  };

  if (chartData.players.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center mb-4">
          <BarChart3 className="h-5 w-5 text-gray-500 mr-2" />
          <h3 className="text-lg font-semibold text-gray-900">VORP Distribution</h3>
        </div>
        <div className="text-center text-gray-500 py-8">
          No players available for chart
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <BarChart3 className="h-5 w-5 text-gray-500 mr-2" />
          <h3 className="text-lg font-semibold text-gray-900">VORP Distribution</h3>
        </div>
        <div className="text-sm text-gray-500">
          Top {chartData.players.length} Available
        </div>
      </div>

      <div className="relative" style={{ height: height + 40 }}>
        {/* Y-axis labels and tier lines */}
        <div className="absolute left-0 top-0 bottom-0 w-12">
          {getTierLines().map(({ value, y, label }) => (
            <div key={value} className="absolute left-0 right-0" style={{ top: y }}>
              <div className="text-xs text-gray-500 text-right pr-2">{value}</div>
              <div 
                className="absolute left-12 right-0 border-t border-dashed border-gray-300"
                style={{ top: '50%' }}
              />
              <div className="absolute left-12 text-xs text-gray-400 ml-2" style={{ top: '-8px' }}>
                {label}
              </div>
            </div>
          ))}
        </div>

        {/* Bars */}
        <div className="absolute left-12 right-0 bottom-0" style={{ height }}>
          <div className="flex items-end justify-between h-full">
            {chartData.players.map((player, index) => {
              const barHeight = getBarHeight(player.vorp || 0);
              const color = getPositionColor(player.position);
              
              return (
                <div
                  key={player.id}
                  className="group relative flex flex-col items-center cursor-pointer hover:opacity-80 transition-opacity"
                  style={{ width: `${100 / chartData.players.length}%` }}
                >
                  {/* Bar */}
                  <div
                    className="w-full max-w-8 rounded-t transition-all duration-300 group-hover:shadow-lg relative overflow-hidden"
                    style={{ 
                      height: barHeight,
                      backgroundColor: color,
                      opacity: player.isTargeted ? 1 : 0.8
                    }}
                  >
                    {/* Targeted indicator */}
                    {player.isTargeted && (
                      <div className="absolute top-1 left-1/2 transform -translate-x-1/2">
                        <Target className="h-3 w-3 text-white" />
                      </div>
                    )}
                    
                    {/* VORP value on hover */}
                    <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                      {(player.vorp || 0).toFixed(1)} VORP
                    </div>
                  </div>

                  {/* Player name */}
                  <div className="mt-2 text-xs text-center">
                    <div className="font-medium text-gray-900 truncate max-w-16" title={player.name}>
                      {player.name.split(' ').pop()} {/* Last name only */}
                    </div>
                    <div className="text-gray-500 text-xs">{player.position}</div>
                  </div>

                  {/* Detailed tooltip */}
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 bg-gray-900 text-white text-xs p-3 rounded shadow-lg whitespace-nowrap pointer-events-none">
                    <div className="font-semibold">{player.name}</div>
                    <div>{player.position} • {player.team}</div>
                    <div>VORP: {(player.vorp || 0).toFixed(1)}</div>
                    <div>ADP: {player.adp?.toFixed(1) || 'N/A'}</div>
                    <div>Tier: {player.tier}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* X-axis line */}
        <div className="absolute bottom-0 left-12 right-0 border-t border-gray-300"></div>
      </div>

      {/* Position Legend */}
      <div className="flex items-center justify-center mt-4 space-x-4 text-xs">
        {showPositions.map(position => (
          <div key={position} className="flex items-center space-x-1">
            <div
              className="w-3 h-3 rounded"
              style={{ backgroundColor: getPositionColor(position) }}
            />
            <span className="text-gray-700">{position}</span>
          </div>
        ))}
        <div className="flex items-center space-x-1 ml-4">
          <Target className="h-3 w-3 text-gray-500" />
          <span className="text-gray-500">Targeted</span>
        </div>
      </div>

      {/* Insights */}
      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
        <div className="flex items-start space-x-2">
          <TrendingUp className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-gray-700 space-y-1">
            <div>
              <strong>Range:</strong> {chartData.minVorp.toFixed(1)} - {chartData.maxVorp.toFixed(1)} VORP
            </div>
            <div>
              <strong>Elite Players (30+ VORP):</strong> {chartData.players.filter(p => (p.vorp || 0) >= 30).length}
            </div>
            <div>
              <strong>Quality Options (10+ VORP):</strong> {chartData.players.filter(p => (p.vorp || 0) >= 10).length}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VORPChart;