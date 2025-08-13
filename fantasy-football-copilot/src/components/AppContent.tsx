import { useState } from 'react';
import { useDraft } from '../contexts/DraftContext';
import { useWebSocket } from '../hooks/useWebSocket';
import { hasGlobalVORPRankings } from '../utils/globalVORPStorage';
import Header from './layout/Header';
import DraftStatus from './layout/DraftStatus';
import DraftSettings from './draft/DraftSettings';
import PlayerImport from './players/PlayerImport';
import PlayerList from './players/PlayerList';
import AlertsPanel from './alerts/AlertsPanel';
import PositionalValueComparison from './draft/PositionalValueComparison';
import GlobalVORPSettings from './settings/GlobalVORPSettings';
import HandcuffRecommendations from './draft/HandcuffRecommendations';
import TrendAnalysis from './draft/TrendAnalysis';
import { DraftHistory } from './draft/DraftHistory';

type SetupStep = 'settings' | 'vorp-settings' | 'import' | 'draft';

const AppContent = () => {
  const { state } = useDraft();
  const { isConnected, connectionStatus } = useWebSocket();
  const [currentStep, setCurrentStep] = useState<SetupStep>('settings');
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showVORPSettingsModal, setShowVORPSettingsModal] = useState(false);

  const handleSettingsClick = () => setShowSettingsModal(true);
  const handleVORPSettingsClick = () => setShowVORPSettingsModal(true);
  const handleHistoryClick = () => setShowHistoryModal(true);

  return (
    <div className="min-h-screen bg-gray-50">
      
      <Header
        onSettingsClick={handleSettingsClick}
        onVORPSettingsClick={handleVORPSettingsClick}
        onHistoryClick={handleHistoryClick}
        leagueName={state.settings.leagueName || 'Fantasy Draft Copilot'}
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
          <div className="space-y-6">
            {/* My Team Overview - Compact Horizontal */}
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-3">My Team</h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(state.settings.rosterSlots).map(([position, required]) => {
                  const userTeam = state.teams.find(t => t.isUser);
                  const filled = userTeam?.roster[position as keyof typeof userTeam.roster]?.length || 0;
                  const isComplete = filled >= required;
                  const positionColor = position === 'QB' ? 'bg-red-100 text-red-800 border-red-200' :
                                      position === 'RB' ? 'bg-green-100 text-green-800 border-green-200' :
                                      position === 'WR' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                                      position === 'TE' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                                      position === 'K' ? 'bg-purple-100 text-purple-800 border-purple-200' :
                                      position === 'DEF' ? 'bg-gray-100 text-gray-800 border-gray-200' :
                                      'bg-orange-100 text-orange-800 border-orange-200';
                  
                  return (
                    <div key={position} className={`inline-flex items-center px-3 py-1 rounded-full text-sm border ${positionColor} ${isComplete ? 'ring-2 ring-green-500' : ''}`}>
                      <span className="font-medium">{position}</span>
                      <span className="ml-1 text-xs">
                        {filled}/{required}
                      </span>
                      {isComplete && (
                        <span className="ml-1 text-green-600">✓</span>
                      )}
                    </div>
                  );
                })}
              </div>
              
              {/* Show actual players if space allows */}
              <div className="mt-3 text-xs text-gray-600">
                {state.teams.find(t => t.isUser)?.roster && Object.entries(state.teams.find(t => t.isUser)!.roster).map(([position, players]) => 
                  players?.length > 0 ? (
                    <span key={position} className="mr-4">
                      <strong>{position}:</strong> {players.map(p => p.name).join(', ')}
                    </span>
                  ) : null
                )}
              </div>
            </div>

            {/* VORP Leaders by Position with Recommendation - Full Width */}
            <PositionalValueComparison />
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <PlayerList />
              </div>
              
              <div className="space-y-6">
                <AlertsPanel />
                <TrendAnalysis />
                <HandcuffRecommendations />
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