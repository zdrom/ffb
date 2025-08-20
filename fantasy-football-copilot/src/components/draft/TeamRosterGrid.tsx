import React from 'react';
import { Users, User } from 'lucide-react';
import { useDraft } from '../../contexts/DraftContext';
import type { Position } from '../../types';

const TeamRosterGrid: React.FC = () => {
  const { state, dispatch } = useDraft();
  const positions: Position[] = ['QB', 'RB', 'WR', 'TE', 'W/R/T', 'K', 'DEF'];

  // Debug function to validate roster integrity
  React.useEffect(() => {
    if (state.teams.length > 0 && state.picks.length > 0) {
      console.log('🔍 ROSTER INTEGRITY CHECK:');
      
      // Check each team's roster against picks data
      state.teams.forEach((team, teamIndex) => {
        console.log(`\n📋 Team ${teamIndex + 1}: ${team.name} (${team.id})`);
        console.log(`  isUser: ${team.isUser}`);
        
        // Get all picks that should belong to this team
        const teamPicks = state.picks.filter(pick => pick.team === team.id);
        console.log(`  Picks assigned to team: ${teamPicks.length}`);
        
        // Count players in roster
        const rosterPlayerCount = positions.reduce((total, pos) => {
          return total + ((team.roster[pos] || []).length);
        }, 0);
        console.log(`  Players in roster: ${rosterPlayerCount}`);
        
        // Check for discrepancies
        if (teamPicks.length !== rosterPlayerCount) {
          console.warn(`⚠️  MISMATCH: Team ${team.name} has ${teamPicks.length} picks but ${rosterPlayerCount} roster players`);
          
          // Detail the mismatch
          positions.forEach(pos => {
            const posRosterCount = (team.roster[pos] || []).length;
            const posPickCount = teamPicks.filter(pick => pick.player?.position === pos).length;
            if (posRosterCount !== posPickCount) {
              console.warn(`    ${pos}: ${posPickCount} picks vs ${posRosterCount} roster players`);
              
              // Show actual players
              const pickPlayers = teamPicks.filter(pick => pick.player?.position === pos).map(p => p.player?.name);
              const rosterPlayers = (team.roster[pos] || []).map(p => p.name);
              console.log(`      Pick players: [${pickPlayers.join(', ')}]`);
              console.log(`      Roster players: [${rosterPlayers.join(', ')}]`);
            }
          });
        }
      });

      // Also check player.draftedBy consistency
      console.log('\n🎯 PLAYER DRAFTED-BY CHECK:');
      const draftedPlayers = state.players.filter(p => p.isDrafted);
      draftedPlayers.forEach(player => {
        const teamId = player.draftedBy;
        const team = state.teams.find(t => t.id === teamId);
        
        if (!team) {
          console.warn(`⚠️  Player ${player.name} draftedBy team ${teamId} but team not found`);
          return;
        }
        
        const isInRoster = (team.roster[player.position] || []).some(p => p.id === player.id);
        if (!isInRoster) {
          console.warn(`⚠️  Player ${player.name} draftedBy ${team.name} but not in team's ${player.position} roster`);
        }
      });
    }
  }, [state.teams, state.picks, state.players]);

  const getPositionColor = (position: Position) => {
    const colors = {
      QB: 'bg-red-100 text-red-800 border-red-200',
      RB: 'bg-green-100 text-green-800 border-green-200',
      WR: 'bg-blue-100 text-blue-800 border-blue-200',
      TE: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'W/R/T': 'bg-orange-100 text-orange-800 border-orange-200',
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
      // Skip FLEX position as it's calculated dynamically from WR/RB/TE
      if (position === 'W/R/T') {
        const flexSlots = rosterSlots['W/R/T'] || 0;
        const flexPlayer = getFlexPlayer(teamId);
        if (flexSlots > 0 && !flexPlayer) {
          needs.push(position);
        }
        return;
      }

      const currentCount = (team.roster[position] || []).length;
      const requiredCount = rosterSlots[position] || 0;
      if (currentCount < requiredCount) {
        needs.push(position);
      }
    });

    return needs;
  };

  const getStarterRequirement = (position: Position): number => {
    const slots = state.settings.rosterSlots;
    switch (position) {
      case 'QB': return slots.QB || 1;
      case 'RB': return slots.RB || 2;
      case 'WR': return slots.WR || 2;
      case 'TE': return slots.TE || 1;
      case 'W/R/T': return slots['W/R/T'] || 1;
      case 'K': return slots.K || 1;
      case 'DEF': return slots.DEF || 1;
      default: return 0;
    }
  };

  const getFlexPlayer = (teamId: string): Player | null => {
    const team = state.teams.find(t => t.id === teamId);
    if (!team) return null;

    // Get all WR/RB/TE players
    const wrPlayers = team.roster['WR'] || [];
    const rbPlayers = team.roster['RB'] || [];
    const tePlayers = team.roster['TE'] || [];
    
    // Combine and sort by VORP
    const allFlexEligible = [...wrPlayers, ...rbPlayers, ...tePlayers]
      .filter(player => player.vorp !== undefined)
      .sort((a, b) => (b.vorp || 0) - (a.vorp || 0));
    
    // Determine how many starters are needed for each position
    const wrStarters = getStarterRequirement('WR');
    const rbStarters = getStarterRequirement('RB');
    const teStarters = getStarterRequirement('TE');
    
    // Get the starters for each position
    const wrStarterPlayers = wrPlayers
      .filter(player => player.vorp !== undefined)
      .sort((a, b) => (b.vorp || 0) - (a.vorp || 0))
      .slice(0, wrStarters);
      
    const rbStarterPlayers = rbPlayers
      .filter(player => player.vorp !== undefined)
      .sort((a, b) => (b.vorp || 0) - (a.vorp || 0))
      .slice(0, rbStarters);
      
    const teStarterPlayers = tePlayers
      .filter(player => player.vorp !== undefined)
      .sort((a, b) => (b.vorp || 0) - (a.vorp || 0))
      .slice(0, teStarters);
    
    // Get starter IDs
    const starterIds = new Set([
      ...wrStarterPlayers.map(p => p.id),
      ...rbStarterPlayers.map(p => p.id),
      ...teStarterPlayers.map(p => p.id)
    ]);
    
    // Find the best non-starter (flex player)
    const flexPlayer = allFlexEligible.find(player => !starterIds.has(player.id));
    return flexPlayer || null;
  };

  const getPositionVORP = (teamId: string, position: Position): number => {
    const team = state.teams.find(t => t.id === teamId);
    if (!team) return 0;

    // Special handling for FLEX position
    if (position === 'W/R/T') {
      const flexPlayer = getFlexPlayer(teamId);
      return flexPlayer?.vorp || 0;
    }

    const players = team.roster[position] || [];
    const starterRequirement = getStarterRequirement(position);
    
    // Sort by VORP to identify starters (top players by VORP)
    const sortedPlayers = players
      .filter(player => player.vorp !== undefined)
      .sort((a, b) => (b.vorp || 0) - (a.vorp || 0));
    
    const starters = sortedPlayers.slice(0, starterRequirement);
    return starters.reduce((sum, player) => sum + (player.vorp || 0), 0);
  };

  const getTeamStarterVORP = (teamId: string): number => {
    return positions.reduce((total, position) => {
      return total + getPositionVORP(teamId, position);
    }, 0);
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Users className="h-5 w-5 text-gray-500 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">Team Rosters</h2>
          </div>
          <button
            onClick={() => dispatch({ type: 'REBUILD_ROSTERS' })}
            className="px-3 py-1 text-xs bg-orange-100 hover:bg-orange-200 text-orange-700 rounded border border-orange-300"
            title="Rebuild team rosters from picks data to fix inconsistencies"
          >
            🔧 Fix Rosters
          </button>
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
                  <div>{position}</div>
                  <div className="text-xs font-normal text-gray-400 mt-1">VORP</div>
                </th>
              ))}
              <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div>Total</div>
                <div className="text-xs font-normal text-gray-400 mt-1">Starter VORP</div>
              </th>
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
                      {position === 'W/R/T' ? (
                        // Special handling for FLEX position
                        (() => {
                          const flexPlayer = getFlexPlayer(team.id);
                          const flexSlots = state.settings.rosterSlots['W/R/T'] || 0;
                          
                          return (
                            <>
                              {flexPlayer && (
                                <div
                                  key={flexPlayer.id}
                                  className={`inline-block px-2 py-1 rounded text-xs font-medium border ${getPositionColor(position)}`}
                                  title={`${flexPlayer.name} (${flexPlayer.team}) - ${flexPlayer.position}`}
                                >
                                  {flexPlayer.name.length > 12 
                                    ? `${flexPlayer.name.substring(0, 12)}...` 
                                    : flexPlayer.name
                                  }
                                </div>
                              )}
                              
                              {Array.from({ 
                                length: Math.max(0, flexSlots - (flexPlayer ? 1 : 0))
                              }).map((_, emptyIndex) => (
                                <div
                                  key={`empty-${position}-${emptyIndex}`}
                                  className="inline-block px-2 py-1 rounded text-xs border border-dashed border-gray-300 text-gray-400"
                                >
                                  Empty
                                </div>
                              ))}
                            </>
                          );
                        })()
                      ) : (
                        // Regular position handling
                        <>
                          {(team.roster[position] || []).map((player, playerIndex) => (
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
                            length: Math.max(0, (state.settings.rosterSlots[position] || 0) - (team.roster[position] || []).length) 
                          }).map((_, emptyIndex) => (
                            <div
                              key={`empty-${position}-${emptyIndex}`}
                              className="inline-block px-2 py-1 rounded text-xs border border-dashed border-gray-300 text-gray-400"
                            >
                              Empty
                            </div>
                          ))}
                        </>
                      )}
                      
                      {/* VORP display */}
                      <div className="mt-2 text-xs font-semibold text-green-600">
                        {getPositionVORP(team.id, position).toFixed(1)}
                      </div>
                    </div>
                  </td>
                ))}
                
                {/* Total Starter VORP column */}
                <td className="px-3 py-4 text-center">
                  <div className="text-lg font-bold text-green-600">
                    {getTeamStarterVORP(team.id).toFixed(1)}
                  </div>
                </td>
                
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