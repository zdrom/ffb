import React, { useState, useEffect } from 'react';
import { Save, Download, Upload, Trash2, Calendar, Users } from 'lucide-react';
import { useDraft } from '../../contexts/DraftContext';
import { 
  getSavedDraftsList, 
  loadDraft, 
  deleteDraft, 
  saveDraft, 
  exportDraft, 
  importDraft 
} from '../../utils/draftPersistence';
import type { SavedDraft } from '../../utils/draftPersistence';

interface SavedDraftsProps {
  onClose?: () => void;
}

const SavedDrafts: React.FC<SavedDraftsProps> = ({ onClose }) => {
  const { state, dispatch } = useDraft();
  const [savedDrafts, setSavedDrafts] = useState<Array<{
    id: string;
    name: string;
    createdAt: string;
    lastModified: string;
  }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load saved drafts list
  useEffect(() => {
    setSavedDrafts(getSavedDraftsList());
  }, []);

  const handleSaveDraft = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const draftName = prompt('Enter a name for this draft:', 
        `Draft - ${new Date().toLocaleDateString()}`);
      
      if (draftName) {
        const draftId = saveDraft(state, draftName);
        dispatch({ type: 'SET_DRAFT_ID', payload: draftId });
        setSavedDrafts(getSavedDraftsList()); // Refresh list
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save draft');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadDraft = async (draftId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const savedDraft = loadDraft(draftId);
      if (savedDraft) {
        dispatch({ type: 'LOAD_DRAFT_STATE', payload: savedDraft.draftState });
        dispatch({ type: 'SET_DRAFT_ID', payload: draftId });
        onClose?.();
      } else {
        setError('Draft not found');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load draft');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteDraft = async (draftId: string, draftName: string) => {
    if (confirm(`Are you sure you want to delete "${draftName}"?`)) {
      try {
        setIsLoading(true);
        setError(null);
        
        deleteDraft(draftId);
        setSavedDrafts(getSavedDraftsList()); // Refresh list
        
        // Clear current draft ID if we deleted the active draft
        if (state.draftId === draftId) {
          dispatch({ type: 'SET_DRAFT_ID', payload: null });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete draft');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleExportDraft = (draftId: string) => {
    try {
      exportDraft(draftId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export draft');
    }
  };

  const handleImportDraft = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsLoading(true);
      setError(null);
      
      const draftId = await importDraft(file);
      setSavedDrafts(getSavedDraftsList()); // Refresh list
      
      // Clear the input
      event.target.value = '';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import draft');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-6">
      <div className="border-b border-gray-200 pb-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Saved Drafts</h1>
        <p className="text-gray-600 mt-1">Manage your draft copilot sessions.</p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="mb-6 flex flex-wrap gap-3">
        <button
          onClick={handleSaveDraft}
          disabled={isLoading}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400"
        >
          <Save className="h-4 w-4 mr-2" />
          Save Current Draft
        </button>

        <div className="relative">
          <input
            type="file"
            accept=".json"
            onChange={handleImportDraft}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={isLoading}
          />
          <button
            disabled={isLoading}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-100"
          >
            <Upload className="h-4 w-4 mr-2" />
            Import Draft
          </button>
        </div>
      </div>

      {/* Saved Drafts List */}
      {savedDrafts.length === 0 ? (
        <div className="text-center py-12">
          <Save className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No saved drafts</h3>
          <p className="text-gray-600">Start a draft and it will be automatically saved here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {savedDrafts.map((draft) => (
            <div
              key={draft.id}
              className={`border rounded-lg p-4 hover:bg-gray-50 transition-colors ${
                state.draftId === draft.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-medium text-gray-900 mb-1">
                    {draft.name}
                    {state.draftId === draft.id && (
                      <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        Active
                      </span>
                    )}
                  </h3>
                  
                  <div className="flex items-center text-sm text-gray-600 space-x-4 mb-2">
                    <div className="flex items-center">
                      <Users className="h-4 w-4 mr-1" />
                      Fantasy Draft
                    </div>
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-1" />
                      {formatDate(draft.lastModified)}
                    </div>
                  </div>
                  
                  <p className="text-xs text-gray-500">
                    Created: {formatDate(draft.createdAt)}
                  </p>
                </div>

                <div className="flex items-center space-x-2 ml-4">
                  <button
                    onClick={() => handleLoadDraft(draft.id)}
                    disabled={isLoading || state.draftId === draft.id}
                    className="text-blue-600 hover:text-blue-800 font-medium text-sm disabled:text-gray-400"
                  >
                    {state.draftId === draft.id ? 'Current' : 'Load'}
                  </button>
                  
                  <button
                    onClick={() => handleExportDraft(draft.id)}
                    disabled={isLoading}
                    className="p-1 text-gray-400 hover:text-gray-600"
                    title="Export"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                  
                  <button
                    onClick={() => handleDeleteDraft(draft.id, draft.name)}
                    disabled={isLoading}
                    className="p-1 text-red-400 hover:text-red-600"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {onClose && (
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
};

export default SavedDrafts;