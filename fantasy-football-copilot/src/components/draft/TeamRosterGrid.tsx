import React from 'react';
import { Users, User } from 'lucide-react';
import { useDraft } from '../../contexts/DraftContext';
import type { Position } from '../../types';

const TeamRosterGrid: React.FC = () => {
  const { state } = useDraft();
  const positions: Position[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];

  const getPositionColor = (position: Position) => {
    const colors = {
      QB: 'bg-red-100 text-red-800 border-red-200',
      RB: 'bg-green-100 text-green-800 border-green-200',
      WR: 'bg-blue-100 text-blue-800 border-blue-200',
      TE: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      K: 'bg-purple-100 text-purple-800 border-purple-200',
      DEF: 'bg-gray-100 text-gray-800 border-gray-200'
    };
    return colors[position];
  };

  const getTeamNeeds = (teamId: string): Position[] => {
    const team = state.teams.find(t => t.id === teamId);
    if (!team) return [];

    const needs: Position[] = [];
    const rosterSlots = state.settings.rosterSlots;

    positions.forEach(position => {
      const currentCount = team.roster[position].length;
      const requiredCount = rosterSlots[position];
      if (currentCount < requiredCount) {
        needs.push(position);
      }
    });

    return needs;
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center">
          <Users className="h-5 w-5 text-gray-500 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">Team Rosters</h2>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Team
              </th>
              {positions.map(position => (
                <th key={position} className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {position}
                </th>
              ))}
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Needs
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {state.teams.map((team) => (
              <tr key={team.id} className={team.isUser ? 'bg-blue-50' : 'hover:bg-gray-50'}>
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    {team.isUser && (
                      <User className="h-4 w-4 text-blue-500 mr-2" />
                    )}
                    <div className="text-sm font-medium text-gray-900">
                      {team.name}
                    </div>
                  </div>
                </td>
                
                {positions.map(position => (
                  <td key={position} className="px-3 py-4 text-center">
                    <div className="space-y-1">
                      {team.roster[position].map((player, playerIndex) => (
                        <div
                          key={`${player.id}-${playerIndex}`}
                          className={`inline-block px-2 py-1 rounded text-xs font-medium border ${getPositionColor(position)}`}
                          title={`${player.name} (${player.team})`}
                        >
                          {player.name.length > 12 
                            ? `${player.name.substring(0, 12)}...` 
                            : player.name
                          }
                        </div>
                      ))}
                      
                      {Array.from({ 
                        length: Math.max(0, state.settings.rosterSlots[position] - team.roster[position].length) 
                      }).map((_, emptyIndex) => (
                        <div
                          key={`empty-${position}-${emptyIndex}`}
                          className="inline-block px-2 py-1 rounded text-xs border border-dashed border-gray-300 text-gray-400"
                        >
                          Empty
                        </div>
                      ))}
                    </div>
                  </td>
                ))}
                
                <td className="px-4 py-4">
                  <div className="flex flex-wrap gap-1">
                    {getTeamNeeds(team.id).map(need => (
                      <span
                        key={need}
                        className={`inline-block px-2 py-1 rounded text-xs font-medium ${getPositionColor(need)}`}
                      >
                        {need}
                      </span>
                    ))}
                    {getTeamNeeds(team.id).length === 0 && (
                      <span className="text-xs text-gray-400">Complete</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
        <div className="text-sm text-gray-600">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <strong>Roster Requirements:</strong>
              <div className="mt-1 space-x-2">
                {positions.map(pos => (
                  <span key={pos} className="text-xs">
                    {pos}: {state.settings.rosterSlots[pos]}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <strong>Legend:</strong>
              <div className="flex items-center mt-1 space-x-4">
                <div className="flex items-center">
                  <User className="h-3 w-3 text-blue-500 mr-1" />
                  <span className="text-xs">Your Team</span>
                </div>
                <div className="flex items-center">
                  <div className="h-3 w-3 bg-blue-50 border border-blue-200 rounded mr-1"></div>
                  <span className="text-xs">Your Row</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeamRosterGrid;