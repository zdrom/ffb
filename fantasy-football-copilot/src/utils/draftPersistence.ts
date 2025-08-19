// Draft persistence utilities for saving/loading draft state
import type { DraftState } from '../types';

const DRAFT_STORAGE_KEY = 'fantasy-draft-copilot-draft';
const DRAFTS_LIST_KEY = 'fantasy-draft-copilot-drafts-list';

export interface SavedDraft {
  id: string;
  name: string;
  createdAt: string;
  lastModified: string;
  draftState: DraftState;
}

// Save current draft to local storage
export function saveDraft(draftState: DraftState, draftName?: string): string {
  try {
    // Clean up old drafts to prevent quota issues
    cleanupOldDrafts();
    
    const draftId = Date.now().toString();
    const now = new Date().toISOString();
    
    // Create minimal state to save (exclude large arrays if possible)
    const minimalState = {
      ...draftState,
      players: draftState.players.length > 1000 ? [] : draftState.players // Don't save huge player lists
    };
    
    const savedDraft: SavedDraft = {
      id: draftId,
      name: draftName || `Draft - ${new Date().toLocaleString()}`,
      createdAt: now,
      lastModified: now,
      draftState: minimalState
    };

    // Save individual draft
    localStorage.setItem(`${DRAFT_STORAGE_KEY}-${draftId}`, JSON.stringify(savedDraft));

    // Update drafts list
    const draftsList = getSavedDraftsList();
    draftsList.push({
      id: draftId,
      name: savedDraft.name,
      createdAt: savedDraft.createdAt,
      lastModified: savedDraft.lastModified
    });
    
    localStorage.setItem(DRAFTS_LIST_KEY, JSON.stringify(draftsList));

    console.log(`Draft saved with ID: ${draftId}`);
    return draftId;
  } catch (error) {
    console.error('Failed to save draft:', error);
    // Clean up and try again with minimal state
    try {
      cleanupOldDrafts();
      const minimalDraft = {
        settings: draftState.settings,
        picks: draftState.picks,
        currentPick: draftState.currentPick,
        teams: draftState.teams,
        players: [], // Don't save players to reduce size
        isActive: draftState.isActive,
        picksUntilMyTurn: draftState.picksUntilMyTurn
      };
      const draftId = Date.now().toString();
      localStorage.setItem(`${DRAFT_STORAGE_KEY}-${draftId}`, JSON.stringify({
        id: draftId,
        name: draftName || 'Minimal Draft',
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        draftState: minimalDraft
      }));
      return draftId;
    } catch (secondError) {
      console.error('Failed to save even minimal draft:', secondError);
      return '';
    }
  }
}

// Clean up old drafts to prevent quota issues
function cleanupOldDrafts(): void {
  try {
    const draftsList = getSavedDraftsList();
    
    // Keep only the 5 most recent drafts
    if (draftsList.length > 5) {
      const sorted = draftsList.sort((a, b) => 
        new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
      );
      
      const toDelete = sorted.slice(5);
      toDelete.forEach(draft => {
        localStorage.removeItem(`${DRAFT_STORAGE_KEY}-${draft.id}`);
      });
      
      // Update the list
      const keepList = sorted.slice(0, 5);
      localStorage.setItem(DRAFTS_LIST_KEY, JSON.stringify(keepList));
      
      console.log(`Cleaned up ${toDelete.length} old drafts`);
    }
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
}

// Update existing draft
export function updateDraft(draftId: string, draftState: DraftState, draftName?: string): void {
  try {
    const existingDraft = loadDraft(draftId);
    if (!existingDraft) {
      throw new Error('Draft not found');
    }

    const now = new Date().toISOString();
    const updatedDraft: SavedDraft = {
      ...existingDraft,
      name: draftName || existingDraft.name,
      lastModified: now,
      draftState
    };

    // Save updated draft
    localStorage.setItem(`${DRAFT_STORAGE_KEY}-${draftId}`, JSON.stringify(updatedDraft));

    // Update drafts list
    const draftsList = getSavedDraftsList();
    const draftIndex = draftsList.findIndex(d => d.id === draftId);
    if (draftIndex >= 0) {
      draftsList[draftIndex] = {
        id: draftId,
        name: updatedDraft.name,
        createdAt: updatedDraft.createdAt,
        lastModified: updatedDraft.lastModified
      };
      localStorage.setItem(DRAFTS_LIST_KEY, JSON.stringify(draftsList));
    }

    console.log(`Draft ${draftId} updated`);
  } catch (error) {
    console.error('Failed to update draft:', error);
    throw new Error('Failed to update draft');
  }
}

// Load draft from local storage
export function loadDraft(draftId: string): SavedDraft | null {
  try {
    const draftData = localStorage.getItem(`${DRAFT_STORAGE_KEY}-${draftId}`);
    if (!draftData) {
      return null;
    }

    const savedDraft = JSON.parse(draftData) as SavedDraft;
    console.log(`Draft ${draftId} loaded`);
    return savedDraft;
  } catch (error) {
    console.error('Failed to load draft:', error);
    return null;
  }
}

// Get list of saved drafts
export function getSavedDraftsList(): Array<{
  id: string;
  name: string;
  createdAt: string;
  lastModified: string;
}> {
  try {
    const draftsListData = localStorage.getItem(DRAFTS_LIST_KEY);
    if (!draftsListData) {
      return [];
    }

    return JSON.parse(draftsListData);
  } catch (error) {
    console.error('Failed to load drafts list:', error);
    return [];
  }
}

// Delete a saved draft
export function deleteDraft(draftId: string): void {
  try {
    // Remove individual draft
    localStorage.removeItem(`${DRAFT_STORAGE_KEY}-${draftId}`);

    // Update drafts list
    const draftsList = getSavedDraftsList();
    const updatedList = draftsList.filter(d => d.id !== draftId);
    localStorage.setItem(DRAFTS_LIST_KEY, JSON.stringify(updatedList));

    console.log(`Draft ${draftId} deleted`);
  } catch (error) {
    console.error('Failed to delete draft:', error);
    throw new Error('Failed to delete draft');
  }
}

// Auto-save current draft (debounced)
let autoSaveTimeout: ReturnType<typeof setTimeout> | null = null;
export function autoSaveDraft(draftState: DraftState, currentDraftId?: string): void {
  // Disable auto-save for now to prevent quota issues
  return;
  
  // Clear existing timeout
  if (autoSaveTimeout !== null) {
    clearTimeout(autoSaveTimeout as any);
    autoSaveTimeout = null;
  }

  // Set new timeout for 30 seconds (increased from 2 seconds)
  autoSaveTimeout = setTimeout(() => {
    try {
      if (currentDraftId) {
        updateDraft(currentDraftId, draftState);
      } else {
        // Only auto-save if there are meaningful changes (picks made)
        if (draftState.picks.length > 0) {
          saveDraft(draftState, `Auto-saved - ${new Date().toLocaleString()}`);
        }
      }
    } catch (error) {
      console.error('Auto-save failed:', error);
    }
  }, 30000);
}

// Clear all saved drafts (for testing/cleanup)
export function clearAllDrafts(): void {
  try {
    const draftsList = getSavedDraftsList();
    
    // Remove all individual drafts
    draftsList.forEach(draft => {
      localStorage.removeItem(`${DRAFT_STORAGE_KEY}-${draft.id}`);
    });

    // Clear drafts list
    localStorage.removeItem(DRAFTS_LIST_KEY);

    console.log('All drafts cleared');
  } catch (error) {
    console.error('Failed to clear drafts:', error);
  }
}

// Export draft data as JSON file
export function exportDraft(draftId: string): void {
  try {
    const savedDraft = loadDraft(draftId);
    if (!savedDraft) {
      throw new Error('Draft not found');
    }

    const dataStr = JSON.stringify(savedDraft, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `${savedDraft.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
    link.click();

    console.log(`Draft ${draftId} exported`);
  } catch (error) {
    console.error('Failed to export draft:', error);
    throw new Error('Failed to export draft');
  }
}

// Import draft data from JSON file
export function importDraft(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const draftData = JSON.parse(e.target?.result as string) as SavedDraft;
        
        // Generate new ID for imported draft
        const newId = Date.now().toString();
        const now = new Date().toISOString();
        
        const importedDraft: SavedDraft = {
          ...draftData,
          id: newId,
          name: `${draftData.name} (Imported)`,
          createdAt: now,
          lastModified: now
        };

        // Save imported draft
        localStorage.setItem(`${DRAFT_STORAGE_KEY}-${newId}`, JSON.stringify(importedDraft));

        // Update drafts list
        const draftsList = getSavedDraftsList();
        draftsList.push({
          id: newId,
          name: importedDraft.name,
          createdAt: importedDraft.createdAt,
          lastModified: importedDraft.lastModified
        });
        localStorage.setItem(DRAFTS_LIST_KEY, JSON.stringify(draftsList));

        console.log(`Draft imported with ID: ${newId}`);
        resolve(newId);
      } catch (error) {
        console.error('Failed to import draft:', error);
        reject(new Error('Invalid draft file format'));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsText(file);
  });
}