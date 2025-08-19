import React from 'react';
import { useDraft } from '../../contexts/DraftContext';
import type { Position } from '../../types';

interface PositionSummary {
  position: Position;
  totalVORP: number;
  starterCount: number;
  totalCount: number;
  avgVORP: number;
}

interface TeamSummary {
  teamId: string;
  teamName: string;
  totalVORP: number;
  totalStarters: number;
  totalPlayers: number;
  positions: PositionSummary[];
  isUserTeam: boolean;
}

const VORPTeamSummary: React.FC = () => {
  const { state } = useDraft();

  // Define starter requirements based on typical fantasy settings
  const getStarterRequirement = (position: Position): number => {
    const slots = state.settings.rosterSlots;
    switch (position) {
      case 'QB': return slots.QB || 1;
      case 'RB': return slots.RB || 2;
      case 'WR': return slots.WR || 2;
      case 'TE': return slots.TE || 1;
      case 'K': return slots.K || 1;
      case 'DEF': return slots.DEF || 1;
      default: return 0;
    }
  };

  // Calculate team summaries
  const teamSummaries: TeamSummary[] = state.teams.map(team => {
    const teamPicks = state.picks.filter(pick => pick.team === team.id && pick.player);
    
    // Group by position
    const positionMap = new Map<Position, { players: any[], totalVORP: number }>();
    
    // Initialize all positions
    (['QB', 'RB', 'WR', 'TE', 'K', 'DEF'] as Position[]).forEach(pos => {
      positionMap.set(pos, { players: [], totalVORP: 0 });
    });

    // Add players to positions
    teamPicks.forEach(pick => {
      if (pick.player) {
        const pos = pick.player.position;
        const current = positionMap.get(pos) || { players: [], totalVORP: 0 };
        current.players.push(pick.player);
        current.totalVORP += pick.player.vorp || 0;
        positionMap.set(pos, current);
      }
    });

    // Calculate position summaries
    const positions: PositionSummary[] = Array.from(positionMap.entries()).map(([position, data]) => {
      const starterRequirement = getStarterRequirement(position);
      // Sort by VORP to identify starters (top players by VORP)
      const sortedPlayers = data.players.sort((a, b) => (b.vorp || 0) - (a.vorp || 0));
      const starters = sortedPlayers.slice(0, starterRequirement);
      const starterVORP = starters.reduce((sum, player) => sum + (player.vorp || 0), 0);
      
      return {
        position,
        totalVORP: data.totalVORP,
        starterCount: Math.min(data.players.length, starterRequirement),
        totalCount: data.players.length,
        avgVORP: data.players.length > 0 ? data.totalVORP / data.players.length : 0
      };
    });

    // Calculate totals
    const totalVORP = positions.reduce((sum, pos) => sum + pos.totalVORP, 0);
    const totalStarters = positions.reduce((sum, pos) => sum + pos.starterCount, 0);
    const requiredStarters = positions.reduce((sum, pos) => sum + getStarterRequirement(pos.position), 0);

    return {
      teamId: team.id,
      teamName: team.name,
      totalVORP,
      totalStarters,
      totalPlayers: teamPicks.length,
      positions: positions.filter(pos => pos.totalCount > 0), // Only show positions with players
      isUserTeam: team.isUser
    };
  });

  // Sort teams by total VORP (descending)
  const sortedTeams = teamSummaries.sort((a, b) => b.totalVORP - a.totalVORP);

  const getPositionColor = (position: Position): string => {
    switch (position) {
      case 'QB': return 'bg-red-100 text-red-800';
      case 'RB': return 'bg-green-100 text-green-800';
      case 'WR': return 'bg-blue-100 text-blue-800';
      case 'TE': return 'bg-yellow-100 text-yellow-800';
      case 'K': return 'bg-purple-100 text-purple-800';
      case 'DEF': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (state.picks.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-bold text-gray-900 mb-3">📊 Team VORP Summary</h3>
        <p className="text-gray-500 text-center py-8">No picks made yet. Start drafting to see team VORP analysis!</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="text-lg font-bold text-gray-900 mb-4">📊 Live Team VORP Summary</h3>
      
      <div className="space-y-4">
        {sortedTeams.map((team, index) => (
          <div 
            key={team.teamId} 
            className={`border rounded-lg p-4 ${
              team.isUserTeam ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
            }`}
          >
            {/* Team Header */}
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-gray-500">#{index + 1}</span>
                <h4 className={`font-bold ${team.isUserTeam ? 'text-blue-900' : 'text-gray-900'}`}>
                  {team.teamName}
                  {team.isUserTeam && <span className="ml-2 text-xs bg-blue-200 text-blue-800 px-2 py-1 rounded">YOU</span>}
                </h4>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold text-green-600">
                  {team.totalVORP.toFixed(1)} VORP
                </div>
                <div className="text-xs text-gray-500">
                  {team.totalStarters} starters • {team.totalPlayers} total
                </div>
              </div>
            </div>

            {/* Position Breakdown */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
              {(['QB', 'RB', 'WR', 'TE', 'K', 'DEF'] as Position[]).map(position => {
                const posData = team.positions.find(p => p.position === position);
                const starterReq = getStarterRequirement(position);
                
                return (
                  <div key={position} className="text-center">
                    <div className={`text-xs font-medium px-2 py-1 rounded ${getPositionColor(position)}`}>
                      {position}
                    </div>
                    <div className="mt-1">
                      {posData ? (
                        <>
                          <div className="text-sm font-bold">
                            {posData.totalVORP.toFixed(1)}
                          </div>
                          <div className="text-xs text-gray-500">
                            {posData.starterCount}/{starterReq} • {posData.totalCount}
                          </div>
                          {posData.totalCount > 0 && (
                            <div className="text-xs text-gray-400">
                              avg: {posData.avgVORP.toFixed(1)}
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="text-sm text-gray-400">0.0</div>
                          <div className="text-xs text-gray-400">0/{starterReq} • 0</div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Starter Needs */}
            {team.totalStarters < (['QB', 'RB', 'WR', 'TE', 'K', 'DEF'] as Position[]).reduce((sum, pos) => sum + getStarterRequirement(pos), 0) && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <div className="text-xs text-gray-600">
                  <span className="font-medium">Starter Needs:</span>
                  {(['QB', 'RB', 'WR', 'TE', 'K', 'DEF'] as Position[]).map(position => {
                    const posData = team.positions.find(p => p.position === position);
                    const need = getStarterRequirement(position) - (posData?.starterCount || 0);
                    return need > 0 ? ` ${position}(${need})` : '';
                  }).filter(Boolean).join(', ') || ' All starter positions filled'}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Summary Stats */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-lg font-bold text-gray-900">
              {sortedTeams.reduce((sum, team) => sum + team.totalVORP, 0).toFixed(1)}
            </div>
            <div className="text-xs text-gray-500">Total VORP Drafted</div>
          </div>
          <div>
            <div className="text-lg font-bold text-gray-900">
              {sortedTeams.length > 0 ? (sortedTeams.reduce((sum, team) => sum + team.totalVORP, 0) / sortedTeams.length).toFixed(1) : '0.0'}
            </div>
            <div className="text-xs text-gray-500">Avg VORP per Team</div>
          </div>
          <div>
            <div className="text-lg font-bold text-gray-900">
              {state.picks.length}
            </div>
            <div className="text-xs text-gray-500">Total Picks Made</div>
          </div>
          <div>
            <div className="text-lg font-bold text-gray-900">
              {Math.round((state.picks.length / (state.settings.numberOfTeams * state.settings.numberOfRounds)) * 100)}%
            </div>
            <div className="text-xs text-gray-500">Draft Complete</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VORPTeamSummary;