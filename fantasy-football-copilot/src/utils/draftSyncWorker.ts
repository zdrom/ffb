// Web Worker for non-blocking draft pick synchronization
// This worker handles heavy draft processing operations without blocking the UI

interface PickData {
  playerName: string;
  teamName: string;
  pickNumber: number;
}

interface SyncMessage {
  type: 'PROCESS_BATCH' | 'PROCESS_INCREMENTAL';
  payload: {
    picks: PickData[];
    players: any[];
    teams: any[];
    settings: any;
  };
}

interface SyncResult {
  type: 'BATCH_COMPLETE' | 'INCREMENTAL_COMPLETE' | 'PROGRESS' | 'ERROR';
  payload: any;
}

// Handle messages from the main thread
self.onmessage = function(e: MessageEvent<SyncMessage>) {
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
          payload: { error: `Unknown message type: ${type}` }
        } as SyncResult);
    }
  } catch (error) {
    postMessage({
      type: 'ERROR',
      payload: { error: error instanceof Error ? error.message : 'Unknown error' }
    } as SyncResult);
  }
};

function processBatchSync(data: SyncMessage['payload']) {
  const { picks, players, teams, settings } = data;
  const processedPicks: any[] = [];
  const playerLookup = createPlayerLookup(players);
  const teamLookup = createTeamLookup(teams);
  
  const totalPicks = picks.length;
  let processedCount = 0;
  
  // Process picks in smaller chunks
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
    
    // Report progress after each chunk
    postMessage({
      type: 'PROGRESS',
      payload: {
        processed: processedCount,
        total: totalPicks,
        percentage: Math.round((processedCount / totalPicks) * 100)
      }
    } as SyncResult);
  }
  
  // Send final result
  postMessage({
    type: 'BATCH_COMPLETE',
    payload: {
      processedPicks,
      totalProcessed: processedCount
    }
  } as SyncResult);
}

function processIncrementalSync(data: SyncMessage['payload']) {
  const { picks, players, teams, settings } = data;
  const processedPicks: any[] = [];
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
  } as SyncResult);
}

function createPlayerLookup(players: any[]): Map<string, any> {
  const lookup = new Map();
  for (const player of players) {
    if (!player.isDrafted) {
      const normalizedName = player.name.toLowerCase().trim();
      lookup.set(normalizedName, player);
      
      // Add variations for better matching
      const cleanName = normalizedName
        .replace(/[.']/g, '')
        .replace(/\s+jr\.?$/, '')
        .replace(/\s+sr\.?$/, '')
        .replace(/\s+iii?$/, '')
        .trim();
      if (cleanName !== normalizedName) {
        lookup.set(cleanName, player);
      }
    }
  }
  return lookup;
}

function createTeamLookup(teams: any[]): Map<string, any> {
  const lookup = new Map();
  for (const team of teams) {
    lookup.set(team.name, team);
  }
  return lookup;
}

function processIndividualPick(
  pickData: PickData,
  playerLookup: Map<string, any>,
  teamLookup: Map<string, any>,
  settings: any
): any | null {
  const { playerName, teamName, pickNumber } = pickData;
  
  // Fast player lookup
  const normalizedPlayerName = playerName.toLowerCase().trim();
  const cleanPlayerName = normalizedPlayerName
    .replace(/[.']/g, '')
    .replace(/\s+jr\.?$/, '')
    .replace(/\s+sr\.?$/, '')
    .replace(/\s+iii?$/, '')
    .trim();
  
  let player = playerLookup.get(normalizedPlayerName) || playerLookup.get(cleanPlayerName);
  
  if (!player) {
    console.warn('Player not found for sync:', playerName);
    return null;
  }
  
  // Find or determine team
  let targetTeam = teamLookup.get(teamName);
  if (!targetTeam) {
    // Calculate draft position for team assignment
    const draftPosition = calculateDraftPosition(pickNumber, settings.numberOfTeams, settings.draftType);
    targetTeam = {
      id: `team-${draftPosition}`,
      name: teamName,
      draftPosition
    };
  }
  
  // Create the pick object
  return {
    id: `pick-${pickNumber}`,
    round: Math.ceil(pickNumber / settings.numberOfTeams),
    pick: ((pickNumber - 1) % settings.numberOfTeams) + 1,
    overall: pickNumber,
    team: targetTeam.id,
    player: { ...player, isDrafted: true, draftedBy: targetTeam.id },
    timestamp: new Date(),
    playerName,
    teamName
  };
}

function calculateDraftPosition(pickNumber: number, numberOfTeams: number, draftType: string): number {
  const round = Math.ceil(pickNumber / numberOfTeams);
  const pickInRound = ((pickNumber - 1) % numberOfTeams) + 1;
  
  if (draftType === 'Snake' && round % 2 === 0) {
    // Even rounds are reversed in snake draft
    return numberOfTeams - pickInRound + 1;
  }
  
  return pickInRound;
}

// Export nothing since this is a Web Worker
export {};