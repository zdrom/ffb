import React, { useState, useEffect } from 'react';
import { 
  saveGlobalVORPRankings, 
  loadGlobalVORPRankings, 
  getGlobalVORPMetadata, 
  hasGlobalVORPRankings,
  clearGlobalVORPRankings,
  exportGlobalVORPRankings,
  importGlobalVORPRankings,
  type VORPMetadata 
} from '../../utils/globalVORPStorage';
import { parseVORPRankings, parseVORPRankingsDetailed, validateVORPData, generateSampleVORPData } from '../../utils/vorpParser';
import type { Player } from '../../types';

interface GlobalVORPSettingsProps {
  onRankingsUpdated?: () => void;
}

const GlobalVORPSettings: React.FC<GlobalVORPSettingsProps> = ({ onRankingsUpdated }) => {
  const [rankingsText, setRankingsText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [skippedLines, setSkippedLines] = useState<{ line: string; reason: string; lineNumber: number }[]>([]);
  const [metadata, setMetadata] = useState<VORPMetadata | null>(null);
  const [hasRankings, setHasRankings] = useState(false);

  // Load metadata on component mount
  useEffect(() => {
    loadMetadata();
  }, []);

  const loadMetadata = () => {
    const data = getGlobalVORPMetadata();
    setMetadata(data);
    setHasRankings(hasGlobalVORPRankings());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rankingsText.trim()) {
      setError('Please paste your VORP rankings data');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);
    setWarnings([]);
    setSkippedLines([]);

    try {
      const parseResult = parseVORPRankingsDetailed(rankingsText);
      
      if (parseResult.players.length === 0) {
        throw new Error('No valid players found in the rankings data');
      }

      // Show skipped lines information
      if (parseResult.skippedLines.length > 0) {
        setSkippedLines(parseResult.skippedLines);
      }

      // Validate the parsed data
      const validation = validateVORPData(parseResult.players);
      
      // Show warnings but don't block saving
      if (validation.warnings.length > 0) {
        setWarnings(validation.warnings);
      }
      
      // Only block saving for critical errors
      if (!validation.valid) {
        throw new Error(`Critical validation errors found:\n${validation.errors.join('\n')}`);
      }

      saveGlobalVORPRankings(parseResult.players, 'Manual Upload');
      
      let successMessage = `Successfully saved ${parseResult.players.length} players to global VORP rankings! Found ${new Set(parseResult.players.map(p => p.position)).size} positions.`;
      if (parseResult.skippedLines.length > 0) {
        successMessage += ` Note: ${parseResult.skippedLines.length} lines were skipped (see details below).`;
      }
      
      setSuccess(successMessage);
      setRankingsText('');
      loadMetadata();
      onRankingsUpdated?.();
    } catch (error) {
      console.error('Error parsing VORP rankings:', error);
      setError(error instanceof Error ? error.message : 'Failed to parse VORP rankings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    if (confirm('Are you sure you want to clear all global VORP rankings? This cannot be undone.')) {
      clearGlobalVORPRankings();
      setSuccess('Global VORP rankings cleared');
      setError(null);
      loadMetadata();
      onRankingsUpdated?.();
    }
  };

  const handleExport = () => {
    try {
      exportGlobalVORPRankings();
      setSuccess('VORP rankings exported successfully');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to export rankings');
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    importGlobalVORPRankings(file)
      .then(() => {
        setSuccess('VORP rankings imported successfully');
        loadMetadata();
        onRankingsUpdated?.();
      })
      .catch((error) => {
        setError(error.message);
      })
      .finally(() => {
        setIsLoading(false);
        // Reset file input
        e.target.value = '';
      });
  };

  const handleLoadSample = () => {
    const sampleData = generateSampleVORPData();
    setRankingsText(sampleData);
  };

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-6">
      <div className="border-b border-gray-200 pb-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Global VORP Rankings</h1>
        <p className="text-gray-600 mt-1">
          Set up your VORP rankings once and use them across all drafts. Update when rankings change.
        </p>
      </div>

      {/* Current Status */}
      {metadata && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <h3 className="font-medium text-green-900 mb-2">Current VORP Rankings</h3>
          <div className="text-sm text-green-700 space-y-1">
            <p><strong>Players:</strong> {metadata.playerCount.toLocaleString()}</p>
            <p><strong>Last Updated:</strong> {new Date(metadata.lastUpdated).toLocaleString()}</p>
            <p><strong>Source:</strong> {metadata.source}</p>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleExport}
              className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
            >
              Export
            </button>
            <button
              onClick={handleClear}
              className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
            >
              Clear All
            </button>
          </div>
        </div>
      )}

      {!hasRankings && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-yellow-800">
            <strong>No VORP rankings found.</strong> Upload your rankings below to get started.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-medium text-gray-700">
              VORP Rankings Data
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleLoadSample}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Load Sample Data
              </button>
              <label className="text-sm text-blue-600 hover:text-blue-800 cursor-pointer">
                Import File
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  className="hidden"
                />
              </label>
            </div>
          </div>
          
          <textarea
            value={rankingsText}
            onChange={(e) => setRankingsText(e.target.value)}
            rows={12}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
            placeholder="Paste your VORP rankings here in FantasyPros format:

1 Christian McCaffrey (SF) RB1 15.2 3.1 vs 3.1
2 Tyreek Hill (MIA) WR1 14.8 7.2 vs 7.2
3 CeeDee Lamb (DAL) WR2 14.3 5.8 vs 5.8
..."
          />
          
          <div className="mt-2 text-sm text-gray-600">
            <p><strong>Expected Format:</strong> Rank Player (Team) Position VORP ADP vs ADP</p>
            <p>Example: "1 Christian McCaffrey (SF) RB1 15.2 3.1 vs 3.1"</p>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-800 text-sm whitespace-pre-line">{error}</p>
          </div>
        )}

        {warnings.length > 0 && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <p className="text-yellow-800 text-sm font-medium mb-2">Warnings (data saved anyway):</p>
            <ul className="text-yellow-700 text-sm space-y-1">
              {warnings.map((warning, index) => (
                <li key={index}>• {warning}</li>
              ))}
            </ul>
          </div>
        )}

        {skippedLines.length > 0 && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <div className="flex justify-between items-start mb-2">
              <p className="text-red-800 text-sm font-medium">
                🚨 {skippedLines.length} lines were skipped (fix these to include more players):
              </p>
              <button
                onClick={() => {
                  const skippedText = skippedLines.map(s => s.line).join('\n');
                  navigator.clipboard.writeText(skippedText).then(() => {
                    alert('Skipped lines copied to clipboard!');
                  });
                }}
                className="text-xs bg-red-100 hover:bg-red-200 px-2 py-1 rounded transition-colors"
              >
                Copy Skipped Lines
              </button>
            </div>
            <div className="max-h-60 overflow-y-auto">
              <ul className="text-red-700 text-sm space-y-2">
                {skippedLines.map((skip, index) => (
                  <li key={index} className="border-l-2 border-red-300 pl-3">
                    <div className="font-medium">Line {skip.lineNumber}:</div>
                    <div className="font-mono text-xs bg-red-100 p-1 rounded mt-1 break-all">"{skip.line}"</div>
                    <div className="text-red-600 mt-1 text-xs">→ {skip.reason}</div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
              <strong>Expected format:</strong> "1 Player Name (TEAM) POS1 VORP ADP vs ADP"<br/>
              <strong>Example:</strong> "1 Christian McCaffrey (SF) RB1 15.2 3.1 vs 3.1"
            </div>
          </div>
        )}

        {success && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-green-800 text-sm">{success}</p>
          </div>
        )}

        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-600">
            Rankings will be available across all drafts once saved.
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="px-6 py-3 bg-blue-600 text-white font-medium rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
          >
            {isLoading ? 'Saving...' : hasRankings ? 'Update Rankings' : 'Save Rankings'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default GlobalVORPSettings;