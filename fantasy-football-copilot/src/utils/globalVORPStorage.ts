// Global VORP rankings storage that persists across all drafts
import type { Player, Position } from '../types';

const GLOBAL_VORP_STORAGE_KEY = 'fantasy-draft-copilot-global-vorp-rankings';
const GLOBAL_VORP_METADATA_KEY = 'fantasy-draft-copilot-vorp-metadata';

// Helper function to calculate projected points from VORP and position
function calculateProjectedPointsFromVORP(vorp: number, position: Position): number {
  const positionBaselines: Record<Position, number> = {
    'QB': 288.4,  // QB12 baseline
    'RB': 191.8,  // RB24 baseline
    'WR': 207.0,  // WR30 baseline
    'TE': 120.0,  // TE12 baseline
    'K': 140.0,   // K12 baseline
    'DEF': 130.0  // DEF12 baseline
  };

  const baseline = positionBaselines[position];
  return Math.max(baseline * 0.5, baseline + vorp);
}

// Helper function to get position baseline
function getPositionBaseline(position: Position): number {
  const baselines: Record<Position, number> = {
    'QB': 288.4,
    'RB': 191.8,
    'WR': 207.0,
    'TE': 120.0,
    'K': 140.0,
    'DEF': 130.0
  };
  
  return baselines[position];
}

export interface VORPMetadata {
  lastUpdated: string;
  source: string;
  playerCount: number;
  version: string;
}

export interface GlobalVORPData {
  players: Player[];
  metadata: VORPMetadata;
}

// Save VORP rankings globally
export function saveGlobalVORPRankings(players: Player[], source: string = 'Manual Upload'): void {
  try {
    const metadata: VORPMetadata = {
      lastUpdated: new Date().toISOString(),
      source,
      playerCount: players.length,
      version: '1.0'
    };


    localStorage.setItem(GLOBAL_VORP_STORAGE_KEY, JSON.stringify(players));
    localStorage.setItem(GLOBAL_VORP_METADATA_KEY, JSON.stringify(metadata));

    console.log(`Global VORP rankings saved: ${players.length} players from ${source}`);
  } catch (error) {
    console.error('Failed to save global VORP rankings:', error);
    throw new Error('Failed to save VORP rankings. Storage may be full.');
  }
}

// Load VORP rankings globally
export function loadGlobalVORPRankings(): GlobalVORPData | null {
  try {
    const playersData = localStorage.getItem(GLOBAL_VORP_STORAGE_KEY);
    const metadataData = localStorage.getItem(GLOBAL_VORP_METADATA_KEY);

    if (!playersData || !metadataData) {
      return null;
    }

    const rawPlayers = JSON.parse(playersData) as Player[];
    const metadata = JSON.parse(metadataData) as VORPMetadata;

    // Ensure all players have projectedPoints calculated if missing
    const players = rawPlayers.map(player => {
      if (!player.projectedPoints || isNaN(player.projectedPoints)) {
        // Recalculate projectedPoints from VORP if available
        if (player.vorp !== undefined && !isNaN(player.vorp)) {
          player.projectedPoints = calculateProjectedPointsFromVORP(player.vorp, player.position);
          console.log(`Restored projectedPoints for ${player.name}: ${player.projectedPoints} (from VORP ${player.vorp})`);
        } else {
          // Fallback: set a reasonable baseline for the position
          player.projectedPoints = getPositionBaseline(player.position);
          console.warn(`No VORP data for ${player.name}, using position baseline: ${player.projectedPoints}`);
        }
      }
      return player;
    });

    console.log(`Global VORP rankings loaded: ${players.length} players, last updated ${metadata.lastUpdated}`);

    return { players, metadata };
  } catch (error) {
    console.error('Failed to load global VORP rankings:', error);
    return null;
  }
}

// Get VORP metadata only (for display without loading full player data)
export function getGlobalVORPMetadata(): VORPMetadata | null {
  try {
    const metadataData = localStorage.getItem(GLOBAL_VORP_METADATA_KEY);
    if (!metadataData) {
      return null;
    }

    return JSON.parse(metadataData) as VORPMetadata;
  } catch (error) {
    console.error('Failed to load VORP metadata:', error);
    return null;
  }
}

// Check if global VORP rankings exist
export function hasGlobalVORPRankings(): boolean {
  return localStorage.getItem(GLOBAL_VORP_STORAGE_KEY) !== null;
}

// Clear global VORP rankings
export function clearGlobalVORPRankings(): void {
  try {
    localStorage.removeItem(GLOBAL_VORP_STORAGE_KEY);
    localStorage.removeItem(GLOBAL_VORP_METADATA_KEY);
    console.log('Global VORP rankings cleared');
  } catch (error) {
    console.error('Failed to clear global VORP rankings:', error);
  }
}

// Update existing VORP rankings (merge with existing data)
export function updateGlobalVORPRankings(updates: Partial<Player>[], playerIdField: keyof Player = 'id'): void {
  try {
    const existing = loadGlobalVORPRankings();
    if (!existing) {
      throw new Error('No existing VORP rankings to update');
    }

    const updatedPlayers = existing.players.map(player => {
      const update = updates.find(u => u[playerIdField] === player[playerIdField]);
      return update ? { ...player, ...update } : player;
    });

    saveGlobalVORPRankings(updatedPlayers, 'Updated Rankings');
  } catch (error) {
    console.error('Failed to update global VORP rankings:', error);
    throw new Error('Failed to update VORP rankings');
  }
}

// Export VORP rankings as JSON file
export function exportGlobalVORPRankings(): void {
  try {
    const data = loadGlobalVORPRankings();
    if (!data) {
      throw new Error('No VORP rankings to export');
    }

    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `vorp_rankings_${new Date().toISOString().split('T')[0]}.json`;
    link.click();

    console.log('Global VORP rankings exported');
  } catch (error) {
    console.error('Failed to export VORP rankings:', error);
    throw new Error('Failed to export VORP rankings');
  }
}

// Import VORP rankings from JSON file
export function importGlobalVORPRankings(file: File): Promise<void> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        
        // Handle both new format (with metadata) and old format (players only)
        let players: Player[];
        if (data.players && Array.isArray(data.players)) {
          players = data.players;
        } else if (Array.isArray(data)) {
          players = data;
        } else {
          throw new Error('Invalid file format');
        }

        saveGlobalVORPRankings(players, 'Imported from File');
        console.log(`Imported ${players.length} VORP rankings`);
        resolve();
      } catch (error) {
        console.error('Failed to import VORP rankings:', error);
        reject(new Error('Invalid VORP rankings file format'));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsText(file);
  });
}