import React, { useMemo } from 'react';
import { useDraft } from '../../contexts/DraftContext';
import type { DraftPick } from '../../types';

const DraftBoard: React.FC = () => {
  const { state } = useDraft();
  
  const boardData = useMemo(() => {
    const { numberOfTeams, numberOfRounds } = state.settings;
    const board: (DraftPick | null)[][] = [];
    
    for (let round = 1; round <= numberOfRounds; round++) {
      const roundPicks: (DraftPick | null)[] = [];
      for (let team = 1; team <= numberOfTeams; team++) {
        const overallPick = (round - 1) * numberOfTeams + team;
        const pick = state.picks.find(p => p.overall === overallPick);
        roundPicks.push(pick || null);
      }
      board.push(roundPicks);
    }
    
    return board;
  }, [state.picks, state.settings]);

  const getPositionColor = (position: string) => {
    const colors: Record<string, string> = {
      QB: 'bg-red-100 text-red-800 border-red-200',
      RB: 'bg-green-100 text-green-800 border-green-200',
      WR: 'bg-blue-100 text-blue-800 border-blue-200',
      TE: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      K: 'bg-purple-100 text-purple-800 border-purple-200',
      DEF: 'bg-gray-100 text-gray-800 border-gray-200'
    };
    return colors[position] || 'bg-gray-50 text-gray-500 border-gray-200';
  };

  const getUserTeamIndex = () => {
    const userTeam = state.teams.find(t => t.isUser);
    if (!userTeam) return -1;
    return parseInt(userTeam.id.split('-')[1]) - 1;
  };

  const userTeamIndex = getUserTeamIndex();

  const getTeamName = (teamIndex: number) => {
    const team = state.teams[teamIndex];
    return team?.name || `Team ${teamIndex + 1}`;
  };

  const isUserTeamColumn = (teamIndex: number) => {
    return teamIndex === userTeamIndex;
  };

  const isCurrentPick = (round: number, teamIndex: number) => {
    const overallPick = (round - 1) * state.settings.numberOfTeams + (teamIndex + 1);
    return overallPick === state.currentPick;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Draft Board</h3>
        <div className="text-sm text-gray-500">
          Pick {state.currentPick} of {state.settings.numberOfTeams * state.settings.numberOfRounds}
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <div className="min-w-max">
          {/* Header with team names */}
          <div className="grid grid-cols-[80px_repeat(var(--teams),_minmax(120px,_1fr))] gap-1 mb-2" 
               style={{ '--teams': state.settings.numberOfTeams } as React.CSSProperties}>
            <div className="p-2 font-medium text-gray-900 text-center">Round</div>
            {Array.from({ length: state.settings.numberOfTeams }, (_, i) => (
              <div 
                key={i} 
                className={`p-2 text-xs font-medium text-center rounded border-2 ${
                  isUserTeamColumn(i) 
                    ? 'bg-blue-50 text-blue-900 border-blue-300' 
                    : 'bg-gray-50 text-gray-700 border-gray-200'
                }`}
              >
                <div className="truncate" title={getTeamName(i)}>
                  {getTeamName(i)}
                </div>
                <div className="text-xs opacity-75 mt-1">
                  #{i + 1}
                </div>
              </div>
            ))}
          </div>
          
          {/* Draft board rows */}
          {boardData.map((round, roundIndex) => (
            <div 
              key={roundIndex}
              className="grid grid-cols-[80px_repeat(var(--teams),_minmax(120px,_1fr))] gap-1 mb-1"
              style={{ '--teams': state.settings.numberOfTeams } as React.CSSProperties}
            >
              <div className="p-2 font-medium text-gray-900 text-center bg-gray-50 rounded border">
                {roundIndex + 1}
              </div>
              {round.map((pick, teamIndex) => (
                <div 
                  key={teamIndex}
                  className={`p-2 rounded border-2 min-h-[60px] flex flex-col justify-center ${
                    isCurrentPick(roundIndex + 1, teamIndex)
                      ? 'ring-2 ring-yellow-400 bg-yellow-50 border-yellow-300'
                      : isUserTeamColumn(teamIndex)
                      ? 'border-blue-200 bg-blue-25'
                      : 'border-gray-200 bg-gray-25'
                  } ${
                    pick 
                      ? getPositionColor(pick.player?.position || '') 
                      : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  {pick ? (
                    <>
                      <div className="text-xs font-semibold truncate" title={pick.player?.name}>
                        {pick.player?.name}
                      </div>
                      <div className="text-xs opacity-75 mt-1">
                        {pick.player?.position} • {pick.player?.team}
                      </div>
                      {pick.player?.vorp && (
                        <div className="text-xs font-medium text-gray-600 mt-1">
                          VORP: {pick.player.vorp.toFixed(1)}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center">
                      {isCurrentPick(roundIndex + 1, teamIndex) ? (
                        <div className="text-xs font-medium text-yellow-700">
                          → On Clock ←
                        </div>
                      ) : (
                        <div className="text-xs text-gray-400">
                          —
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      
      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-blue-50 border border-blue-300 rounded"></div>
          <span>Your Team</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-yellow-50 border border-yellow-300 rounded"></div>
          <span>Current Pick</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-red-100 border border-red-200 rounded"></div>
          <span>QB</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-green-100 border border-green-200 rounded"></div>
          <span>RB</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-blue-100 border border-blue-200 rounded"></div>
          <span>WR</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-yellow-100 border border-yellow-200 rounded"></div>
          <span>TE</span>
        </div>
      </div>
    </div>
  );
};

export default DraftBoard;