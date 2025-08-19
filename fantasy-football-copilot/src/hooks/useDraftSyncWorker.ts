import { useCallback, useRef, useEffect } from 'react';
import { useDraft } from '../contexts/DraftContext';

interface PickData {
  playerName: string;
  teamName: string;
  pickNumber: number;
}

interface SyncProgress {
  processed: number;
  total: number;
  percentage: number;
}

interface UseDraftSyncWorkerResult {
  processBatchSync: (picks: PickData[], onProgress?: (progress: SyncProgress) => void) => Promise<void>;
  processIncrementalSync: (picks: PickData[]) => Promise<void>;
  isProcessing: boolean;
}

export function useDraftSyncWorker(): UseDraftSyncWorkerResult {
  const { state, dispatch } = useDraft();
  const workerRef = useRef<Worker | null>(null);
  const isProcessingRef = useRef(false);
  const progressCallbackRef = useRef<((progress: SyncProgress) => void) | null>(null);

  // Initialize worker
  useEffect(() => {
    try {
      // Create worker from the TypeScript file - Vite will handle the compilation
      const workerScript = `
        // Inline worker since we can't reliably load external worker files in dev
        ${getWorkerScript()}
      `;
      
      const blob = new Blob([workerScript], { type: 'application/javascript' });
      workerRef.current = new Worker(URL.createObjectURL(blob));
      
      workerRef.current.onmessage = (e) => {
        const { type, payload } = e.data;
        
        switch (type) {
          case 'PROGRESS':
            if (progressCallbackRef.current) {
              progressCallbackRef.current(payload);
            }
            break;
            
          case 'BATCH_COMPLETE':
            handleBatchComplete(payload);
            break;
            
          case 'INCREMENTAL_COMPLETE':
            handleIncrementalComplete(payload);
            break;
            
          case 'ERROR':
            console.error('Worker error:', payload.error);
            isProcessingRef.current = false;
            break;
        }
      };
      
      workerRef.current.onerror = (error) => {
        console.error('Worker error:', error);
        isProcessingRef.current = false;
      };
    } catch (error) {
      console.warn('Web Worker not supported, falling back to main thread processing');
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  const handleBatchComplete = useCallback((payload: { processedPicks: any[] }) => {
    const { processedPicks } = payload;
    
    if (processedPicks.length > 0) {
      // Convert worker results to dispatch format
      const picks = processedPicks.map(pick => ({
        playerName: pick.playerName,
        teamName: pick.teamName,
        pickNumber: pick.overall
      }));
      
      dispatch({
        type: 'BATCH_SYNC_PICKS',
        payload: { picks }
      });
    }
    
    isProcessingRef.current = false;
    progressCallbackRef.current = null;
  }, [dispatch]);

  const handleIncrementalComplete = useCallback((payload: { processedPicks: any[] }) => {
    const { processedPicks } = payload;
    
    if (processedPicks.length > 0) {
      // Convert worker results to dispatch format
      const picks = processedPicks.map(pick => ({
        playerName: pick.playerName,
        teamName: pick.teamName,
        pickNumber: pick.overall
      }));
      
      dispatch({
        type: 'INCREMENTAL_SYNC_PICKS',
        payload: { picks }
      });
    }
    
    isProcessingRef.current = false;
  }, [dispatch]);

  const processBatchSync = useCallback(async (
    picks: PickData[],
    onProgress?: (progress: SyncProgress) => void
  ): Promise<void> => {
    if (isProcessingRef.current || !workerRef.current) {
      console.warn('Worker is busy or not available, falling back to main thread');
      return fallbackBatchSync(picks, onProgress);
    }

    isProcessingRef.current = true;
    progressCallbackRef.current = onProgress || null;

    workerRef.current.postMessage({
      type: 'PROCESS_BATCH',
      payload: {
        picks,
        players: state.players,
        teams: state.teams,
        settings: state.settings
      }
    });
  }, [state.players, state.teams, state.settings]);

  const processIncrementalSync = useCallback(async (picks: PickData[]): Promise<void> => {
    if (isProcessingRef.current || !workerRef.current) {
      console.warn('Worker is busy or not available, falling back to main thread');
      return fallbackIncrementalSync(picks);
    }

    isProcessingRef.current = true;

    workerRef.current.postMessage({
      type: 'PROCESS_INCREMENTAL',
      payload: {
        picks,
        players: state.players,
        teams: state.teams,
        settings: state.settings
      }
    });
  }, [state.players, state.teams, state.settings]);

  // Fallback methods for when worker is not available
  const fallbackBatchSync = async (picks: PickData[], onProgress?: (progress: SyncProgress) => void) => {
    const CHUNK_SIZE = 10;
    const chunks = [];
    for (let i = 0; i < picks.length; i += CHUNK_SIZE) {
      chunks.push(picks.slice(i, i + CHUNK_SIZE));
    }

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      dispatch({
        type: 'BATCH_SYNC_PICKS',
        payload: { picks: chunk }
      });

      if (onProgress) {
        const processed = (i + 1) * CHUNK_SIZE;
        onProgress({
          processed: Math.min(processed, picks.length),
          total: picks.length,
          percentage: Math.round((Math.min(processed, picks.length) / picks.length) * 100)
        });
      }

      // Small delay between chunks
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
  };

  const fallbackIncrementalSync = async (picks: PickData[]) => {
    dispatch({
      type: 'INCREMENTAL_SYNC_PICKS',
      payload: { picks }
    });
  };

  return {
    processBatchSync,
    processIncrementalSync,
    isProcessing: isProcessingRef.current
  };
}

// Inline worker script to avoid loading issues
function getWorkerScript(): string {
  return `
    self.onmessage = function(e) {
      const { type, payload } = e.data;
      
      try {
        switch (type) {
          case 'PROCESS_BATCH':
            processBatchSync(payload);
            break;
          case 'PROCESS_INCREMENTAL':
            processIncrementalSync(payload);
            break;
          default:
            postMessage({
              type: 'ERROR',
              payload: { error: 'Unknown message type: ' + type }
            });
        }
      } catch (error) {
        postMessage({
          type: 'ERROR',
          payload: { error: error.message || 'Unknown error' }
        });
      }
    };

    function processBatchSync(data) {
      const { picks, players, teams, settings } = data;
      const processedPicks = [];
      const playerLookup = createPlayerLookup(players);
      const teamLookup = createTeamLookup(teams);
      
      const totalPicks = picks.length;
      let processedCount = 0;
      
      const CHUNK_SIZE = 25;
      const chunks = [];
      for (let i = 0; i < picks.length; i += CHUNK_SIZE) {
        chunks.push(picks.slice(i, i + CHUNK_SIZE));
      }
      
      for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
        const chunk = chunks[chunkIndex];
        
        for (const pickData of chunk) {
          const result = processIndividualPick(pickData, playerLookup, teamLookup, settings);
          if (result) {
            processedPicks.push(result);
          }
          processedCount++;
        }
        
        postMessage({
          type: 'PROGRESS',
          payload: {
            processed: processedCount,
            total: totalPicks,
            percentage: Math.round((processedCount / totalPicks) * 100)
          }
        });
      }
      
      postMessage({
        type: 'BATCH_COMPLETE',
        payload: {
          processedPicks,
          totalProcessed: processedCount
        }
      });
    }

    function processIncrementalSync(data) {
      const { picks, players, teams, settings } = data;
      const processedPicks = [];
      const playerLookup = createPlayerLookup(players);
      const teamLookup = createTeamLookup(teams);
      
      for (const pickData of picks) {
        const result = processIndividualPick(pickData, playerLookup, teamLookup, settings);
        if (result) {
          processedPicks.push(result);
        }
      }
      
      postMessage({
        type: 'INCREMENTAL_COMPLETE',
        payload: {
          processedPicks,
          totalProcessed: processedPicks.length
        }
      });
    }

    function createPlayerLookup(players) {
      const lookup = new Map();
      for (const player of players) {
        if (!player.isDrafted) {
          const normalizedName = player.name.toLowerCase().trim();
          lookup.set(normalizedName, player);
          
          const cleanName = normalizedName
            .replace(/[.']/g, '')
            .replace(/\\s+jr\\.?$/, '')
            .replace(/\\s+sr\\.?$/, '')
            .replace(/\\s+iii?$/, '')
            .trim();
          if (cleanName !== normalizedName) {
            lookup.set(cleanName, player);
          }
        }
      }
      return lookup;
    }

    function createTeamLookup(teams) {
      const lookup = new Map();
      for (const team of teams) {
        lookup.set(team.name, team);
      }
      return lookup;
    }

    function processIndividualPick(pickData, playerLookup, teamLookup, settings) {
      const { playerName, teamName, pickNumber } = pickData;
      
      const normalizedPlayerName = playerName.toLowerCase().trim();
      const cleanPlayerName = normalizedPlayerName
        .replace(/[.']/g, '')
        .replace(/\\s+jr\\.?$/, '')
        .replace(/\\s+sr\\.?$/, '')
        .replace(/\\s+iii?$/, '')
        .trim();
      
      let player = playerLookup.get(normalizedPlayerName) || playerLookup.get(cleanPlayerName);
      
      // Use mapping system for enhanced search
      if (!player) {
        // Note: This is in the worker, so we'll use a simplified fallback
        // The main thread should handle mapping popups
        for (const [key, p] of playerLookup) {
          if (key.includes(normalizedPlayerName) || normalizedPlayerName.includes(key)) {
            player = p;
            break;
          }
        }
      }
      
      if (!player) {
        console.warn('Player not found for sync:', playerName);
        return null;
      }
      
      let targetTeam = teamLookup.get(teamName);
      if (!targetTeam) {
        const draftPosition = calculateDraftPosition(pickNumber, settings.numberOfTeams, settings.draftType);
        targetTeam = {
          id: 'team-' + draftPosition,
          name: teamName,
          draftPosition
        };
      }
      
      return {
        id: 'pick-' + pickNumber,
        round: Math.ceil(pickNumber / settings.numberOfTeams),
        pick: ((pickNumber - 1) % settings.numberOfTeams) + 1,
        overall: pickNumber,
        team: targetTeam.id,
        player: Object.assign({}, player, { isDrafted: true, draftedBy: targetTeam.id }),
        timestamp: new Date(),
        playerName,
        teamName
      };
    }

    function calculateDraftPosition(pickNumber, numberOfTeams, draftType) {
      const round = Math.ceil(pickNumber / numberOfTeams);
      const pickInRound = ((pickNumber - 1) % numberOfTeams) + 1;
      
      if (draftType === 'Snake' && round % 2 === 0) {
        return numberOfTeams - pickInRound + 1;
      }
      
      return pickInRound;
    }
  `;
}