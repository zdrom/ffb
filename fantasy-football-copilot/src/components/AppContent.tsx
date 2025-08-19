import { useState } from 'react';
import { useDraft } from '../contexts/DraftContext';
import { useWebSocket } from '../hooks/useWebSocket';
import { hasGlobalVORPRankings } from '../utils/globalVORPStorage';
import Header from './layout/Header';
import DraftStatus from './layout/DraftStatus';
import DraftSettings from './draft/DraftSettings';
import PlayerImport from './players/PlayerImport';
import GlobalVORPSettings from './settings/GlobalVORPSettings';
import { DraftHistory } from './draft/DraftHistory';

type SetupStep = 'settings' | 'vorp-settings' | 'import' | 'draft';

const AppContent = () => {
  const { state, dispatch } = useDraft();
  const { isConnected, connectionStatus } = useWebSocket();
  const [currentStep, setCurrentStep] = useState<SetupStep>('settings');
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showVORPSettingsModal, setShowVORPSettingsModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const handleSettingsClick = () => setShowSettingsModal(true);
  const handleVORPSettingsClick = () => setShowVORPSettingsModal(true);
  const handleHistoryClick = () => setShowHistoryModal(true);

  return (
    <div className="min-h-screen bg-gray-50">
      
      <Header
        onSettingsClick={handleSettingsClick}
        onVORPSettingsClick={handleVORPSettingsClick}
        onHistoryClick={handleHistoryClick}
        leagueName={'Fantasy Draft Copilot'}
      />
      
      {currentStep !== 'settings' && <DraftStatus />}
      
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Connection Status */}
        <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className={`h-3 w-3 rounded-full mr-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'} ${isConnected ? 'animate-pulse' : ''}`}></div>
              <span className="text-sm font-medium text-gray-900">
                Chrome Extension: {connectionStatus}
              </span>
            </div>
            <span className="text-xs text-gray-500">
              {isConnected ? 'Ready to sync Yahoo draft picks' : 'Install Chrome extension for Yahoo sync'}
            </span>
          </div>
        </div>

        
        {currentStep === 'settings' && (
          <DraftSettings onComplete={() => {
            // Skip import if global VORP rankings exist, go straight to draft
            if (hasGlobalVORPRankings()) {
              setCurrentStep('draft');
            } else {
              setCurrentStep('import');
            }
          }} />
        )}
        
        
        {currentStep === 'import' && (
          <PlayerImport onComplete={() => setCurrentStep('draft')} />
        )}
        
        
        {currentStep === 'draft' && (
          <div className="space-y-4">
            {/* Top 3 VORP Players Overall */}
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-lg font-bold text-gray-900 mb-3">Top 3 VORP Available</h3>
              <div className="grid grid-cols-3 gap-4">
                {state.players
                  .filter(p => !p.isDrafted && !p.isDoNotDraft)
                  .sort((a, b) => (b.vorp || 0) - (a.vorp || 0))
                  .slice(0, 3)
                  .map((player, index) => (
                    <div key={player.id} className="text-center p-3 border rounded-lg bg-gradient-to-br from-green-50 to-blue-50">
                      <div className="text-2xl font-bold text-green-600">#{index + 1}</div>
                      <div className="font-semibold text-gray-900">{player.name}</div>
                      <div className="text-sm text-gray-600">{player.position} - {player.team}</div>
                      <div className="text-xl font-bold text-blue-600">VORP: {(player.vorp || 0).toFixed(1)}</div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Draft Pick Ledger */}
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-lg font-bold text-gray-900 mb-3">📋 Draft Pick Ledger</h3>
              <div className="max-h-60 overflow-y-auto">
                {state.picks.length > 0 ? (
                  <div className="space-y-2">
                    {state.picks
                      .sort((a, b) => b.overall - a.overall) // Most recent first
                      .slice(0, 20) // Show last 20 picks
                      .map(pick => {
                        const player = pick.player;
                        const team = state.teams.find(t => t.id === pick.team);
                        const vorp = player.vorp || 0;
                        
                        // Calculate what players were available at the time of this pick
                        const picksBefore = state.picks.filter(p => p.overall < pick.overall);
                        const draftedPlayerIds = new Set(picksBefore.map(p => p.player.id));
                        
                        const availableAtPickTime = state.players
                          .filter(p => !draftedPlayerIds.has(p.id) && !p.isDoNotDraft)
                          .sort((a, b) => (b.vorp || 0) - (a.vorp || 0))
                          .slice(0, 100); // Top 100 available by VORP
                        
                        // Find the rank of the picked player among top 100 available players
                        const playerRank = availableAtPickTime.findIndex(p => p.id === player.id) + 1;
                        const isInTop100 = playerRank > 0;
                        
                        // Calculate grade based on ranking within top 100 available players
                        let grade = 'F';
                        let gradeColor = 'text-red-600';
                        let gradeBackground = 'bg-red-100';
                        
                        if (isInTop100) {
                          if (playerRank <= 5) {
                            grade = 'A+';
                            gradeColor = 'text-green-700';
                            gradeBackground = 'bg-green-100';
                          } else if (playerRank <= 10) {
                            grade = 'A';
                            gradeColor = 'text-green-600';
                            gradeBackground = 'bg-green-100';
                          } else if (playerRank <= 20) {
                            grade = 'B+';
                            gradeColor = 'text-green-500';
                            gradeBackground = 'bg-green-50';
                          } else if (playerRank <= 30) {
                            grade = 'B';
                            gradeColor = 'text-blue-600';
                            gradeBackground = 'bg-blue-50';
                          } else if (playerRank <= 40) {
                            grade = 'B-';
                            gradeColor = 'text-blue-500';
                            gradeBackground = 'bg-blue-50';
                          } else if (playerRank <= 50) {
                            grade = 'C+';
                            gradeColor = 'text-yellow-600';
                            gradeBackground = 'bg-yellow-50';
                          } else if (playerRank <= 70) {
                            grade = 'C';
                            gradeColor = 'text-yellow-600';
                            gradeBackground = 'bg-yellow-100';
                          } else if (playerRank <= 85) {
                            grade = 'C-';
                            gradeColor = 'text-orange-500';
                            gradeBackground = 'bg-orange-50';
                          } else {
                            grade = 'D';
                            gradeColor = 'text-orange-600';
                            gradeBackground = 'bg-orange-100';
                          }
                        } else {
                          // Player not in top 100 available = F grade
                          grade = 'F';
                          gradeColor = 'text-red-600';
                          gradeBackground = 'bg-red-100';
                        }
                        
                        return (
                          <div key={pick.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                            <div className="flex items-center space-x-3">
                              <div className="text-sm font-bold text-gray-600 w-12">
                                {pick.overall}
                              </div>
                              <div className="flex-1">
                                <div className="font-semibold text-gray-900">{player.name}</div>
                                <div className="text-sm text-gray-600">{player.position} - {player.team}</div>
                              </div>
                              <div className="text-sm font-medium text-gray-700 w-24 truncate">
                                {team?.name || 'Unknown Team'}
                              </div>
                            </div>
                            <div className="flex items-center space-x-3">
                              <div className="text-right">
                                <div className="text-sm font-bold text-blue-600">
                                  VORP: {vorp.toFixed(1)}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {isInTop100 ? `#${playerRank} of top 100` : 'Outside top 100'}
                                </div>
                              </div>
                              <div className={`px-2 py-1 rounded-full text-xs font-bold ${gradeColor} ${gradeBackground} w-8 text-center`}>
                                {grade}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <div className="text-gray-500 text-center py-8">
                    <div className="text-lg mb-2">📋</div>
                    <div>No picks yet</div>
                    <div className="text-sm">Draft picks will appear here with VORP grades</div>
                  </div>
                )}
              </div>
            </div>

            {/* Top 10 VORP by Position - Horizontal Layout */}
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-lg font-bold text-gray-900 mb-3">Top 10 VORP by Position</h3>
              <div className="grid grid-cols-2 gap-4">
                {['QB', 'RB'].map(position => (
                  <div key={position} className="border rounded p-3">
                    <h4 className="font-semibold text-gray-800 mb-2 text-center">{position}</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {state.players
                        .filter(p => p.position === position && !p.isDrafted && !p.isDoNotDraft)
                        .sort((a, b) => (b.vorp || 0) - (a.vorp || 0))
                        .slice(0, 10)
                        .map((player, index) => (
                          <div key={player.id} className="text-xs">
                            <div className="font-medium truncate">{index + 1}. {player.name}</div>
                            <div className="text-blue-600 font-bold">{(player.vorp || 0).toFixed(1)}</div>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                {['WR', 'TE'].map(position => (
                  <div key={position} className="border rounded p-3">
                    <h4 className="font-semibold text-gray-800 mb-2 text-center">{position}</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {state.players
                        .filter(p => p.position === position && !p.isDrafted && !p.isDoNotDraft)
                        .sort((a, b) => (b.vorp || 0) - (a.vorp || 0))
                        .slice(0, 10)
                        .map((player, index) => (
                          <div key={player.id} className="text-xs">
                            <div className="font-medium truncate">{index + 1}. {player.name}</div>
                            <div className="text-blue-600 font-bold">{(player.vorp || 0).toFixed(1)}</div>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Targeted Players with Search */}
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-lg font-bold text-gray-900 mb-3">🎯 Targeted Players</h3>
              
              {/* Current Targeted Players - Prominently Displayed */}
              <div className="mb-4">
                {state.players.filter(p => p.isTargeted && !p.isDrafted).length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {state.players
                      .filter(p => p.isTargeted && !p.isDrafted)
                      .map(player => {
                        // Calculate sophisticated availability likelihood
                        const calculateAvailability = (player: any, picksUntil: number) => {
                          const currentOverallPick = state.picks.length + 1;
                          const availablePlayers = state.players
                            .filter(p => !p.isDrafted && !p.isDoNotDraft)
                            .sort((a, b) => (b.vorp || 0) - (a.vorp || 0));
                          
                          // Base probability from ADP vs current pick
                          const playerADP = player.adp || (player.vorp ? Math.max(50, 200 - (player.vorp * 20)) : 150);
                          const adpDiff = playerADP - currentOverallPick;
                          let baseProb = adpDiff > 0 ? Math.min(95, 50 + (adpDiff * 1.5)) : 15;
                          
                          // Position scarcity multipliers (how fast positions typically go)
                          const positionMultipliers: Record<string, number> = {
                            'QB': 0.7,  // QBs go slower
                            'RB': 1.3,  // RBs go fastest
                            'WR': 1.1,  // WRs go moderately fast
                            'TE': 0.8   // TEs go slower
                          };
                          baseProb *= (positionMultipliers[player.position] || 1.0);
                          
                          // VORP ranking pressure (top VORP players get picked faster)
                          const vorpRank = availablePlayers.findIndex(p => p.id === player.id) + 1;
                          if (vorpRank <= 5) {
                            baseProb *= 0.5; // Top 5 VORP very likely to go
                          } else if (vorpRank <= 15) {
                            baseProb *= 0.7; // Top 15 VORP likely to go
                          } else if (vorpRank <= 30) {
                            baseProb *= 0.85; // Top 30 VORP somewhat likely
                          }
                          
                          // Adjust for actual picks until your turn (exponential decay)
                          const picksPenalty = Math.min(60, picksUntil * 12 + Math.pow(picksUntil, 1.5) * 3);
                          
                          // Draft round adjustment (later rounds are less predictable)
                          const currentRound = Math.ceil(currentOverallPick / state.settings.numberOfTeams);
                          const roundMultiplier = currentRound <= 3 ? 1.0 : 
                                                currentRound <= 6 ? 1.1 : 
                                                currentRound <= 10 ? 1.2 : 1.3;
                          
                          const finalProb = Math.max(5, (baseProb - picksPenalty) * roundMultiplier);
                          return Math.min(95, Math.round(finalProb));
                        };
                        
                        const picksUntilLikely = Math.min(state.picksUntilMyTurn + 2, state.settings.numberOfTeams * 2);
                        const availabilityPercent = calculateAvailability(player, picksUntilLikely);
                        return (
                          <div key={player.id} className="p-3 border-2 border-blue-200 rounded-lg bg-blue-50">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="font-bold text-lg text-gray-900">{player.name}</div>
                                <div className="text-sm text-gray-600">{player.position} - VORP: {(player.vorp || 0).toFixed(1)}</div>
                                <div className={`text-sm font-bold mt-1 ${
                                  availabilityPercent > 70 ? 'text-green-600' :
                                  availabilityPercent > 40 ? 'text-yellow-600' : 'text-red-600'
                                }`}>
                                  {availabilityPercent}% likely in 2 picks
                                </div>
                              </div>
                              <div className="flex flex-col gap-1">
                                <button 
                                  onClick={() => dispatch({ type: 'TOGGLE_TARGET', payload: player.id })}
                                  className="text-xs px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded"
                                >
                                  Remove
                                </button>
                                <button 
                                  onClick={() => dispatch({ type: 'TOGGLE_DO_NOT_DRAFT', payload: player.id })}
                                  className="text-xs px-2 py-1 bg-red-200 hover:bg-red-300 rounded text-red-700"
                                >
                                  DNP
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <div className="text-gray-500 text-center py-6 border-2 border-dashed border-gray-300 rounded-lg">
                    <div className="text-lg mb-2">🎯</div>
                    <div>No targeted players yet</div>
                    <div className="text-sm">Use search below to add players to your target list</div>
                  </div>
                )}
              </div>

              {/* Search Section */}
              <div className="border-t pt-4">
                <h4 className="font-semibold text-gray-800 mb-2">Search & Add Players</h4>
                <input
                  type="text"
                  placeholder="Search players to target..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mb-2"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {/* Search Results */}
                {searchTerm && (
                  <div className="border rounded max-h-40 overflow-y-auto">
                    {state.players
                      .filter(p => 
                        !p.isDrafted && 
                        !p.isTargeted && 
                        !p.isDoNotDraft &&
                        p.name.toLowerCase().includes(searchTerm.toLowerCase())
                      )
                      .slice(0, 8)
                      .map(player => (
                        <div 
                          key={player.id} 
                          className="flex justify-between items-center p-2 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                          onClick={() => {
                            dispatch({ type: 'TOGGLE_TARGET', payload: player.id });
                            setSearchTerm('');
                          }}
                        >
                          <div>
                            <div className="font-medium text-sm">{player.name}</div>
                            <div className="text-xs text-gray-600">{player.position} - VORP: {(player.vorp || 0).toFixed(1)}</div>
                          </div>
                          <button className="text-xs px-2 py-1 bg-blue-100 hover:bg-blue-200 rounded text-blue-700">
                            Add Target
                          </button>
                        </div>
                      ))}
                    {state.players.filter(p => 
                      !p.isDrafted && 
                      !p.isTargeted && 
                      !p.isDoNotDraft &&
                      p.name.toLowerCase().includes(searchTerm.toLowerCase())
                    ).length === 0 && (
                      <div className="p-3 text-gray-500 text-sm text-center">
                        No players found matching "{searchTerm}"
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Team Draft Counts */}
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-lg font-bold text-gray-900 mb-3">Team Draft Counts by Position</h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {['QB', 'RB', 'WR', 'TE'].map(position => {
                  const counts = Array.from({ length: (state.settings.rosterSlots[position as keyof typeof state.settings.rosterSlots] || 0) + 1 }, (_, i) => {
                    const teamsWithCount = state.teams.filter(team => 
                      team.roster[position as keyof typeof team.roster]?.length === i
                    ).length;
                    return { count: i, teams: teamsWithCount };
                  });
                  
                  return (
                    <div key={position} className="border rounded p-3">
                      <h4 className="font-semibold text-gray-800 mb-2">{position}</h4>
                      <div className="space-y-1">
                        {counts.map(({ count, teams }) => (
                          <div key={count} className="flex justify-between text-sm">
                            <span>{count} players:</span>
                            <span className="font-medium">{teams} teams</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Draft History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-11/12 max-w-5xl shadow-lg rounded-md bg-white min-h-[80vh]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900">Draft History</h3>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="h-full overflow-y-auto">
              <DraftHistory />
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-11/12 max-w-5xl shadow-lg rounded-md bg-white min-h-[80vh]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900">Draft Settings</h3>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="h-full overflow-y-auto">
              <DraftSettings onComplete={() => {
                setShowSettingsModal(false);
                if (hasGlobalVORPRankings()) {
                  setCurrentStep('draft');
                } else {
                  setCurrentStep('import');
                }
              }} />
            </div>
          </div>
        </div>
      )}

      {/* VORP Settings Modal */}
      {showVORPSettingsModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-11/12 max-w-5xl shadow-lg rounded-md bg-white min-h-[80vh]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900">VORP Rankings</h3>
              <button
                onClick={() => setShowVORPSettingsModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="h-full overflow-y-auto">
              <GlobalVORPSettings onRankingsUpdated={() => {
                // Optionally refresh any cached data
              }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppContent;