import { useCallback, useRef, useEffect } from 'react';
import { useDraft } from '../contexts/DraftContext';
import { loadPlayerNameMappings } from '../utils/playerNameMapping';

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
  processIncrementalSync: (picks: PickData[], customPlayers?: any[]) => Promise<void>;
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
      // Ensure worker cleanup and fresh creation
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
      
      // Create worker from the TypeScript file - Vite will handle the compilation
      const timestamp = Date.now();
      const workerScript = `
        // Inline worker since we can't reliably load external worker files in dev
        // FORCE REFRESH: ${timestamp} - Enhanced player matching with mappings and includes fallback
        console.log('Worker loaded at ${timestamp} with enhanced matching');
        ${getWorkerScript()}
      `;
      
      const blob = new Blob([workerScript], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);
      workerRef.current = new Worker(workerUrl);
      
      // Clean up blob URL after worker is created
      setTimeout(() => URL.revokeObjectURL(workerUrl), 1000);
      
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
        settings: state.settings,
        playerMappings: loadPlayerNameMappings()
      }
    });
  }, [state.players, state.teams, state.settings]);

  const processIncrementalSync = useCallback(async (picks: PickData[], customPlayers?: any[]): Promise<void> => {
    if (isProcessingRef.current || !workerRef.current) {
      console.warn('Worker is busy or not available, falling back to main thread');
      return fallbackIncrementalSync(picks);
    }

    isProcessingRef.current = true;

    // Use custom players if provided, otherwise fall back to state
    const playersToUse = customPlayers || state.players;
    console.log(`🔧 Worker using ${playersToUse.length} players (${customPlayers ? 'custom' : 'from state'})`);

    workerRef.current.postMessage({
      type: 'PROCESS_INCREMENTAL',
      payload: {
        picks,
        players: playersToUse,
        teams: state.teams,
        settings: state.settings,
        playerMappings: loadPlayerNameMappings()
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
      const { picks, players, teams, settings, playerMappings } = data;
      const processedPicks = [];
      const playerLookupData = createPlayerLookup(players, playerMappings);
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
          const result = processIndividualPick(pickData, playerLookupData, teamLookup, settings);
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
      const { picks, players, teams, settings, playerMappings } = data;
      const processedPicks = [];
      const playerLookupData = createPlayerLookup(players, playerMappings);
      const teamLookup = createTeamLookup(teams);
      
      for (const pickData of picks) {
        const result = processIndividualPick(pickData, playerLookupData, teamLookup, settings);
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

    function createPlayerLookup(players, playerMappings) {
      const lookup = new Map();
      
      // Create mapping lookup for fast access
      const mappingLookup = new Map();
      if (playerMappings) {
        for (const mapping of playerMappings) {
          mappingLookup.set(mapping.yahooName.toLowerCase().trim(), mapping.vorpName.toLowerCase().trim());
        }
      }
      
      // Keep original players array for includes matching
      const undraftedPlayers = players.filter(p => !p.isDrafted);
      
      for (const player of undraftedPlayers) {
        const normalizedName = player.name.toLowerCase().trim();
        lookup.set(normalizedName, player);
        
        // Add variations for better matching
        const cleanName = normalizedName
          .replace(/[.']/g, '')
          .replace(/\\s+jr\\.?$/i, '')
          .replace(/\\s+sr\\.?$/i, '')
          .replace(/\\s+iii?$/i, '')
          .trim();
        if (cleanName !== normalizedName) {
          lookup.set(cleanName, player);
        }
        
        // Add partial name variants for better matching
        const nameParts = normalizedName.split(/\\s+/);
        if (nameParts.length > 1) {
          // Add combinations of name parts
          for (let i = 0; i < nameParts.length; i++) {
            for (let j = i + 1; j <= nameParts.length; j++) {
              const partialName = nameParts.slice(i, j).join(' ');
              if (partialName.length > 2) { // Only meaningful partial names
                if (!lookup.has(partialName)) {
                  lookup.set(partialName, player);
                }
              }
            }
          }
        }
      }
      
      return { lookup, mappingLookup, undraftedPlayers };
    }

    function createTeamLookup(teams) {
      const lookup = new Map();
      for (const team of teams) {
        lookup.set(team.name, team);
      }
      return lookup;
    }

    function processIndividualPick(pickData, playerLookupData, teamLookup, settings) {
      const { playerName, teamName, pickNumber } = pickData;
      const { lookup: playerLookup, mappingLookup, undraftedPlayers } = playerLookupData;
      
      // Enhanced player lookup with mapping support
      const normalizedPlayerName = playerName.toLowerCase().trim();
      
      // 1. Try exact match first
      let player = playerLookup.get(normalizedPlayerName);
      
      if (!player) {
        // 2. Try mapping lookup
        const mappedName = mappingLookup.get(normalizedPlayerName);
        if (mappedName) {
          player = playerLookup.get(mappedName);
          if (player) {
            console.log('Found player via mapping: "' + playerName + '" -> "' + mappedName + '" -> ' + player.name);
          }
        }
      }
      
      if (!player) {
        // 3. Try clean name variations
        const cleanPlayerName = normalizedPlayerName
          .replace(/[.']/g, '')
          .replace(/\\s+jr\\.?$/i, '')
          .replace(/\\s+sr\\.?$/i, '')
          .replace(/\\s+iii?$/i, '')
          .trim();
        
        player = playerLookup.get(cleanPlayerName);
      }
      
      if (!player) {
        // 4. Try partial matches using name parts
        const nameParts = normalizedPlayerName.split(/\\s+/);
        if (nameParts.length > 1) {
          // Try different combinations of name parts
          for (let i = 0; i < nameParts.length && !player; i++) {
            for (let j = i + 1; j <= nameParts.length && !player; j++) {
              const partialName = nameParts.slice(i, j).join(' ');
              if (partialName.length > 2) {
                player = playerLookup.get(partialName);
              }
            }
          }
        }
      }
      
      if (!player) {
        // 5. Fallback: bidirectional includes matching (like manual sync)
        const cleanSearchName = normalizedPlayerName
          .replace(/[.']/g, '')
          .replace(/\\s+jr\\.?$/i, '')
          .replace(/\\s+sr\\.?$/i, '')
          .replace(/\\s+iii?$/i, '')
          .trim();
        
        // Search through all undrafted players for includes match
        for (const candidatePlayer of undraftedPlayers) {
          const cleanPlayerName = candidatePlayer.name.toLowerCase().trim()
            .replace(/[.']/g, '')
            .replace(/\\s+jr\\.?$/i, '')
            .replace(/\\s+sr\\.?$/i, '')
            .replace(/\\s+iii?$/i, '')
            .trim();
          
          // Bidirectional includes matching (just like manual sync)
          if (cleanPlayerName.includes(cleanSearchName) || cleanSearchName.includes(cleanPlayerName)) {
            player = candidatePlayer;
            console.log('Found player via includes matching: "' + playerName + '" -> ' + player.name);
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