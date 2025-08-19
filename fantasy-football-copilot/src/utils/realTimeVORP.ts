import type { Player, DraftState, Position } from '../types';
import { DynamicVORPEngine } from './dynamicVORP';

// Function to validate and fix roster consistency before VORP calculations
function validateRosterConsistency(state: DraftState): DraftState {
  // Check if rosters are consistent with picks
  let inconsistenciesFound = false;
  
  state.teams.forEach(team => {
    const teamPicks = state.picks.filter(pick => pick.team === team.id);
    const rosterPlayerCount = Object.values(team.roster).reduce((sum, arr) => sum + arr.length, 0);
    
    if (teamPicks.length !== rosterPlayerCount) {
      inconsistenciesFound = true;
      console.warn(`⚠️  Roster inconsistency detected for team ${team.name}: ${teamPicks.length} picks vs ${rosterPlayerCount} roster players`);
    }
  });
  
  // If inconsistencies found, rebuild rosters from picks
  if (inconsistenciesFound) {
    console.log('🔧 Auto-fixing roster inconsistencies before VORP calculation');
    
    const rebuiltTeams = state.teams.map(team => ({
      ...team,
      roster: {
        QB: [] as Player[],
        RB: [] as Player[],
        WR: [] as Player[],
        TE: [] as Player[],
        K: [] as Player[],
        DEF: [] as Player[]
      }
    }));
    
    // Rebuild rosters from picks
    state.picks.forEach(pick => {
      const team = rebuiltTeams.find(t => t.id === pick.team);
      const player = pick.player;
      
      if (team && player && player.position in team.roster) {
        team.roster[player.position as Position].push(player);
      }
    });
    
    return {
      ...state,
      teams: rebuiltTeams
    };
  }
  
  return state;
}

export function updatePlayersVORP(state: DraftState): Player[] {
  if (!state.players.length) return state.players;

  const vorpEngine = new DynamicVORPEngine(state.players, state.settings, state.teams);
  
  return state.players.map(player => {
    if (player.isDrafted) return player;
    
    const updatedVORP = vorpEngine.calculateDynamicVORP(player);
    return {
      ...player,
      vorp: updatedVORP
    };
  });
}

export function recalculateAllVORP(state: DraftState): DraftState {
  // First validate and fix any roster inconsistencies
  const validatedState = validateRosterConsistency(state);
  
  const updatedPlayers = updatePlayersVORP(validatedState);
  
  return {
    ...validatedState,
    players: updatedPlayers
  };
}

// Lightweight VORP recalculation that only updates affected players
export function recalculateIncrementalVORP(state: DraftState, newPickPlayerIds: string[]): DraftState {
  if (!state.players.length || newPickPlayerIds.length === 0) {
    return state;
  }

  // First validate and fix any roster inconsistencies
  const validatedState = validateRosterConsistency(state);

  const vorpEngine = new DynamicVORPEngine(validatedState.players, validatedState.settings, validatedState.teams);
  
  // Only recalculate VORP for players at the same positions as newly drafted players
  const affectedPositions = new Set<string>();
  newPickPlayerIds.forEach(playerId => {
    const player = validatedState.players.find(p => p.id === playerId);
    if (player?.position) {
      affectedPositions.add(player.position);
    }
  });
  
  const updatedPlayers = validatedState.players.map(player => {
    // Skip if player is drafted or not in affected positions
    if (player.isDrafted || !affectedPositions.has(player.position)) {
      return player;
    }
    
    const updatedVORP = vorpEngine.calculateDynamicVORP(player);
    return {
      ...player,
      vorp: updatedVORP
    };
  });
  
  return {
    ...validatedState,
    players: updatedPlayers
  };
}

// Async version for non-blocking VORP recalculation
export async function recalculateVORPAsync(state: DraftState, onProgress?: (progress: number) => void): Promise<DraftState> {
  if (!state.players.length) return state;

  const undraftedPlayers = state.players.filter(p => !p.isDrafted);
  if (undraftedPlayers.length === 0) return state;

  const vorpEngine = new DynamicVORPEngine(state.players, state.settings, state.teams);
  const updatedPlayers = [...state.players];
  
  // Process in chunks to allow UI updates
  const CHUNK_SIZE = 50;
  const chunks = [];
  for (let i = 0; i < undraftedPlayers.length; i += CHUNK_SIZE) {
    chunks.push(undraftedPlayers.slice(i, i + CHUNK_SIZE));
  }
  
  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
    const chunk = chunks[chunkIndex];
    
    // Process chunk
    chunk.forEach(player => {
      const playerIndex = updatedPlayers.findIndex(p => p.id === player.id);
      if (playerIndex >= 0) {
        const updatedVORP = vorpEngine.calculateDynamicVORP(player);
        updatedPlayers[playerIndex] = {
          ...player,
          vorp: updatedVORP
        };
      }
    });
    
    // Report progress
    if (onProgress) {
      const progress = ((chunkIndex + 1) / chunks.length) * 100;
      onProgress(progress);
    }
    
    // Allow UI to update
    if (chunkIndex < chunks.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }
  
  return {
    ...state,
    players: updatedPlayers
  };
}