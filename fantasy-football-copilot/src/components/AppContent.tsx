import { useState, useRef } from 'react';
import { useDraft } from '../contexts/DraftContext';
import { usePersistence } from '../hooks/usePersistence';
import { useWebSocket } from '../hooks/useWebSocket';
import { hasGlobalVORPRankings } from '../utils/globalVORPStorage';
import Header from './layout/Header';
import DraftStatus from './layout/DraftStatus';
import DraftSettings from './draft/DraftSettings';
import PlayerImport from './players/PlayerImport';
import RecommendationsList from './draft/RecommendationsList';
import PlayerList from './players/PlayerList';
import TeamRosterGrid from './draft/TeamRosterGrid';
import AlertsPanel from './alerts/AlertsPanel';
import VORPDashboard from './draft/VORPDashboard';
import GlobalVORPSettings from './settings/GlobalVORPSettings';

type SetupStep = 'settings' | 'vorp-settings' | 'import' | 'draft';

const AppContent = () => {
  const { state } = useDraft();
  const { exportDraftData, importDraftData, resetDraft } = usePersistence();
  const { isConnected, connectionStatus } = useWebSocket();
  const [currentStep, setCurrentStep] = useState<SetupStep>('settings');
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSettingsClick = () => setCurrentStep('settings');
  const handleVORPSettingsClick = () => setCurrentStep('vorp-settings');
  
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setImportError(null);
      await importDraftData(file);
      setCurrentStep('draft');
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Failed to import file');
    }
  };

  const handleExportClick = () => {
    exportDraftData();
  };

  const handleResetClick = () => {
    if (confirm('Are you sure you want to reset the entire draft? This cannot be undone.')) {
      resetDraft();
      setCurrentStep('settings');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileImport}
        className="hidden"
      />
      
      <Header
        onSettingsClick={handleSettingsClick}
        onVORPSettingsClick={handleVORPSettingsClick}
        onImportClick={handleImportClick}
        onExportClick={handleExportClick}
        onResetClick={handleResetClick}
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

        {importError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <div className="text-sm text-red-700">
              <strong>Import Error:</strong> {importError}
            </div>
          </div>
        )}
        
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
        
        {currentStep === 'vorp-settings' && (
          <GlobalVORPSettings onRankingsUpdated={() => {
            // Optionally refresh any cached data
          }} />
        )}
        
        {currentStep === 'import' && (
          <PlayerImport onComplete={() => setCurrentStep('draft')} />
        )}
        
        {currentStep === 'draft' && (
          <div className="space-y-6">
            {/* VORP Dashboard - Full Width */}
            <VORPDashboard />
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <RecommendationsList />
                <PlayerList />
              </div>
              
              <div className="space-y-6">
                <TeamRosterGrid />
                <AlertsPanel />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default AppContent;