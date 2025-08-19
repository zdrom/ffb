import { useEffect } from 'react';
import { useDraft } from '../contexts/DraftContext';
import { StorageManager } from '../utils/storage';

export const usePersistence = () => {
  const { state, dispatch } = useDraft();

  // Auto-save draft state when it changes
  useEffect(() => {
    if (state.players.length > 0) {
      StorageManager.saveDraftState(state);
    }
  }, [state]);

  // Load draft state on mount
  useEffect(() => {
    const savedState = StorageManager.loadDraftState();
    if (savedState) {
      dispatch({ type: 'LOAD_DRAFT_STATE', payload: savedState });
    }
  }, [dispatch]);

  const exportDraftData = () => {
    const timestamp = new Date().toISOString().split('T')[0];
    
    // Export full draft state as JSON
    const draftStateJson = StorageManager.exportDraftState(state);
    StorageManager.downloadFile(
      draftStateJson,
      `draft_state_${timestamp}.json`,
      'application/json'
    );

    // Export draft board as CSV
    const draftBoardCsv = StorageManager.exportDraftBoard(state);
    StorageManager.downloadFile(
      draftBoardCsv,
      `draft_board_${timestamp}.csv`,
      'text/csv'
    );

    // Export team rosters as CSV
    const rostersCsv = StorageManager.exportTeamRosters(state);
    StorageManager.downloadFile(
      rostersCsv,
      `team_rosters_${timestamp}.csv`,
      'text/csv'
    );
  };

  const importDraftData = (file: File) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const jsonString = e.target?.result as string;
          const importedState = StorageManager.importDraftState(jsonString);
          dispatch({ type: 'LOAD_DRAFT_STATE', payload: importedState });
          resolve(importedState);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  };

  const resetDraft = () => {
    StorageManager.clearDraftState();
    dispatch({ type: 'RESET_DRAFT' });
  };

  return {
    exportDraftData,
    importDraftData,
    resetDraft
  };
};