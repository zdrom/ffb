import React, { createContext, useContext, useReducer, type ReactNode } from 'react';
import type { DraftState, DraftPick, Player, Team, DraftSettings, Position } from '../types';
import { autoSaveDraft } from '../utils/draftPersistence';

type DraftAction =
  | { type: 'SET_SETTINGS'; payload: DraftSettings }
  | { type: 'LOAD_PLAYERS'; payload: Player[] }
  | { type: 'MAKE_PICK'; payload: { playerId: string; teamId: string } }
  | { type: 'AUTO_MAKE_PICK'; payload: { playerName: string; teamName: string; pickNumber: number } }
  | { type: 'BATCH_SYNC_PICKS'; payload: { picks: { playerName: string; teamName: string; pickNumber: number }[] } }
  | { type: 'TOGGLE_TARGET'; payload: string }
  | { type: 'TOGGLE_DO_NOT_DRAFT'; payload: string }
  | { type: 'UPDATE_PLAYER_RANKINGS'; payload: Player[] }
  | { type: 'RESET_DRAFT' }
  | { type: 'LOAD_DRAFT_STATE'; payload: DraftState }
  | { type: 'SET_DRAFT_ID'; payload: string | null }
  | { type: 'AUTO_UPDATE_TEAMS'; payload: { teamName: string; pickNumber: number } };

const initialState: DraftState = {
  settings: {
    leagueName: '',
    scoringType: 'PPR',
    numberOfTeams: 12,
    draftSlot: 1,
    numberOfRounds: 16,
    draftType: 'Snake',
    teamNames: Array.from({ length: 12 }, (_, i) => `Pick ${i + 1}`),
    rosterSlots: {
      QB: 1,
      RB: 2,
      WR: 2,
      TE: 1,
      'W/R/T': 1,
      K: 1,
      DEF: 1,
      BENCH: 6
    }
  },
  players: [],
  teams: [],
  picks: [],
  currentPick: 1,
  isActive: false,
  picksUntilMyTurn: 0
};

function draftReducer(state: DraftState, action: DraftAction): DraftState {
  switch (action.type) {
    case 'SET_SETTINGS':
      const teams: Team[] = Array.from({ length: action.payload.numberOfTeams }, (_, i) => ({
        id: `team-${i + 1}`,
        name: action.payload.teamNames[i] || `Pick ${i + 1}`,
        isUser: i + 1 === action.payload.draftSlot,
        roster: {
          QB: [],
          RB: [],
          WR: [],
          TE: [],
          K: [],
          DEF: []
        },
        needs: ['QB', 'RB', 'WR', 'TE', 'K', 'DEF']
      }));
      
      return {
        ...state,
        settings: action.payload,
        teams,
        picksUntilMyTurn: calculatePicksUntilMyTurn(1, action.payload.draftSlot, action.payload.numberOfTeams, action.payload.draftType)
      };

    case 'LOAD_PLAYERS':
      return {
        ...state,
        players: action.payload.map(player => ({
          ...player,
          isDrafted: false,
          isTargeted: false,
          isDoNotDraft: false
        }))
      };

    case 'MAKE_PICK':
      const player = state.players.find(p => p.id === action.payload.playerId);
      const team = state.teams.find(t => t.id === action.payload.teamId);
      
      if (!player || !team) return state;

      const newPick: DraftPick = {
        id: `pick-${state.currentPick}`,
        round: Math.ceil(state.currentPick / state.settings.numberOfTeams),
        pick: ((state.currentPick - 1) % state.settings.numberOfTeams) + 1,
        overall: state.currentPick,
        team: team.id,
        player: { ...player, isDrafted: true, draftedBy: team.id },
        timestamp: new Date()
      };

      const updatedPlayers = state.players.map(p => 
        p.id === player.id ? { ...p, isDrafted: true, draftedBy: team.id } : p
      );

      const updatedTeams = state.teams.map(t => {
        if (t.id === team.id) {
          return {
            ...t,
            roster: {
              ...t.roster,
              [player.position]: [...t.roster[player.position], player]
            }
          };
        }
        return t;
      });

      const nextPick = state.currentPick + 1;
      const maxPicks = state.settings.numberOfTeams * state.settings.numberOfRounds;
      
      return {
        ...state,
        players: updatedPlayers,
        teams: updatedTeams,
        picks: [...state.picks, newPick],
        currentPick: nextPick,
        isActive: nextPick <= maxPicks,
        picksUntilMyTurn: calculatePicksUntilMyTurn(nextPick, state.settings.draftSlot, state.settings.numberOfTeams, state.settings.draftType)
      };

    case 'TOGGLE_TARGET':
      return {
        ...state,
        players: state.players.map(p => 
          p.id === action.payload ? { ...p, isTargeted: !p.isTargeted } : p
        )
      };

    case 'TOGGLE_DO_NOT_DRAFT':
      return {
        ...state,
        players: state.players.map(p => 
          p.id === action.payload ? { ...p, isDoNotDraft: !p.isDoNotDraft } : p
        )
      };

    case 'UPDATE_PLAYER_RANKINGS':
      return {
        ...state,
        players: action.payload
      };

    case 'RESET_DRAFT':
      return {
        ...state,
        players: state.players.map(p => ({ 
          ...p, 
          isDrafted: false, 
          draftedBy: undefined 
        })),
        picks: [],
        currentPick: 1,
        isActive: false,
        teams: state.teams.map(t => ({
          ...t,
          roster: {
            QB: [],
            RB: [],
            WR: [],
            TE: [],
            K: [],
            DEF: []
          }
        }))
      };

    case 'LOAD_DRAFT_STATE':
      return action.payload;

    case 'SET_DRAFT_ID':
      return {
        ...state,
        draftId: action.payload || undefined
      };

    case 'AUTO_MAKE_PICK':
      return handleAutoMakePick(state, action.payload);

    case 'AUTO_UPDATE_TEAMS':
      return handleAutoUpdateTeams(state, action.payload);

    case 'BATCH_SYNC_PICKS':
      return handleBatchSyncPicks(state, action.payload);

    default:
      return state;
  }
}

// Handler for automatically making picks from Chrome extension data
function handleAutoMakePick(state: DraftState, payload: { playerName: string; teamName: string; pickNumber: number }): DraftState {
  const { playerName, teamName, pickNumber } = payload;
  
  // Find or create the team
  let targetTeam = state.teams.find(t => t.name === teamName);
  
  if (!targetTeam) {
    // Calculate which draft position this should be based on pick number
    const draftPosition = calculateDraftPosition(pickNumber, state.settings.numberOfTeams, state.settings.draftType);
    
    // Update the team name for this position
    const updatedTeams = state.teams.map((team, index) => {
      if (index + 1 === draftPosition) {
        return { ...team, name: teamName };
      }
      return team;
    });
    
    // Find the updated team
    targetTeam = updatedTeams.find(t => t.name === teamName);
    
    if (!targetTeam) {
      console.error('Could not create or find team for:', teamName);
      return state;
    }
    
    // Update state with new teams
    state = { ...state, teams: updatedTeams };
  }
  
  // Find the player
  const player = state.players.find(p => 
    p.name.toLowerCase() === playerName.toLowerCase() ||
    p.name.toLowerCase().includes(playerName.toLowerCase()) ||
    playerName.toLowerCase().includes(p.name.toLowerCase())
  );
  
  if (!player) {
    console.warn('Player not found for auto-pick:', playerName);
    return state;
  }
  
  // Check if player is already drafted
  if (player.isDrafted) {
    console.warn('Player already drafted:', playerName);
    return state;
  }
  
  // Make the pick using existing logic
  const newPick: DraftPick = {
    id: `pick-${pickNumber}`,
    round: Math.ceil(pickNumber / state.settings.numberOfTeams),
    pick: ((pickNumber - 1) % state.settings.numberOfTeams) + 1,
    overall: pickNumber,
    team: targetTeam.id,
    player: { ...player, isDrafted: true, draftedBy: targetTeam.id },
    timestamp: new Date()
  };
  
  const updatedPlayers = state.players.map(p => 
    p.id === player.id ? { ...p, isDrafted: true, draftedBy: targetTeam.id } : p
  );
  
  const updatedTeams = state.teams.map(t => {
    if (t.id === targetTeam!.id) {
      return {
        ...t,
        roster: {
          ...t.roster,
          [player.position]: [...t.roster[player.position], player]
        }
      };
    }
    return t;
  });
  
  // Update current pick to be the highest pick number we've seen + 1
  const newCurrentPick = Math.max(state.currentPick, pickNumber + 1);
  const maxPicks = state.settings.numberOfTeams * state.settings.numberOfRounds;
  
  return {
    ...state,
    players: updatedPlayers,
    teams: updatedTeams,
    picks: [...state.picks.filter(p => p.overall !== pickNumber), newPick].sort((a, b) => a.overall - b.overall),
    currentPick: newCurrentPick,
    isActive: newCurrentPick <= maxPicks,
    picksUntilMyTurn: calculatePicksUntilMyTurn(newCurrentPick, state.settings.draftSlot, state.settings.numberOfTeams, state.settings.draftType)
  };
}

// Handler for updating team names from Chrome extension data
function handleAutoUpdateTeams(state: DraftState, payload: { teamName: string; pickNumber: number }): DraftState {
  const { teamName, pickNumber } = payload;
  
  // Calculate which draft position this should be
  const draftPosition = calculateDraftPosition(pickNumber, state.settings.numberOfTeams, state.settings.draftType);
  
  // Update the team name for this position
  const updatedTeams = state.teams.map((team, index) => {
    if (index + 1 === draftPosition) {
      return { ...team, name: teamName };
    }
    return team;
  });
  
  return {
    ...state,
    teams: updatedTeams
  };
}

// Handler for batch syncing multiple picks efficiently
function handleBatchSyncPicks(state: DraftState, payload: { picks: { playerName: string; teamName: string; pickNumber: number }[] }): DraftState {
  try {
    let newState = { ...state };
    
    // Optimize for large datasets
    const picks = payload.picks;
    const picksCount = picks.length;
    
    console.log(`Processing batch of ${picksCount} picks`);
    
    // Pre-allocate collections with estimated capacity
    const allPicks: DraftPick[] = [];
    allPicks.length = 0; // Ensure clean start
    
    const updatedPlayerIds = new Set<string>();
    const teamRosterUpdates = new Map<string, Record<Position, Player[]>>();
    
    // Create player lookup map for faster searches
    const playerLookup = new Map<string, Player>();
    newState.players.forEach(player => {
      const normalizedName = player.name.toLowerCase().trim();
      playerLookup.set(normalizedName, player);
      // Also add variations for better matching
      const cleanName = normalizedName.replace(/[.']/g, '').replace(/\s+jr\.?$/, '').replace(/\s+sr\.?$/, '').replace(/\s+iii?$/, '').trim();
      if (cleanName !== normalizedName) {
        playerLookup.set(cleanName, player);
      }
    });
    
    // Initialize team rosters map efficiently
    newState.teams.forEach(team => {
      teamRosterUpdates.set(team.id, {
        QB: [...team.roster.QB],
        RB: [...team.roster.RB],
        WR: [...team.roster.WR],
        TE: [...team.roster.TE],
        K: [...team.roster.K],
        DEF: [...team.roster.DEF]
      });
    });
    
    // Sort picks by pick number to ensure proper order
    const sortedPicks = [...picks].sort((a, b) => a.pickNumber - b.pickNumber);
    
    // Process picks with optimized lookups
    for (const { playerName, teamName, pickNumber } of sortedPicks) {
      try {
        // Find or create the team
        let targetTeam = newState.teams.find(t => t.name === teamName);
        
        if (!targetTeam) {
          const draftPosition = calculateDraftPosition(pickNumber, newState.settings.numberOfTeams, newState.settings.draftType);
          newState = {
            ...newState,
            teams: newState.teams.map((team, index) => {
              if (index + 1 === draftPosition) {
                const updatedTeam = { ...team, name: teamName };
                // Transfer roster data to new team name
                const existingRoster = teamRosterUpdates.get(team.id);
                if (existingRoster) {
                  teamRosterUpdates.set(updatedTeam.id, existingRoster);
                }
                return updatedTeam;
              }
              return team;
            })
          };
          targetTeam = newState.teams.find(t => t.name === teamName);
        }
        
        if (!targetTeam) {
          console.warn('Could not find or create team for:', teamName);
          continue;
        }
        
        // Fast player lookup
        const normalizedPlayerName = playerName.toLowerCase().trim();
        const cleanPlayerName = normalizedPlayerName.replace(/[.']/g, '').replace(/\s+jr\.?$/, '').replace(/\s+sr\.?$/, '').replace(/\s+iii?$/, '').trim();
        
        let player = playerLookup.get(normalizedPlayerName) || playerLookup.get(cleanPlayerName);
        
        // Fallback to slower search if fast lookup fails
        if (!player) {
          player = newState.players.find(p => {
            const pName = p.name.toLowerCase();
            return pName.includes(normalizedPlayerName) || normalizedPlayerName.includes(pName);
          });
        }
        
        if (!player || updatedPlayerIds.has(player.id)) {
          if (!player) {
            console.warn('Player not found for batch sync:', playerName);
          } else {
            console.warn('Player already drafted in this batch:', playerName);
          }
          continue;
        }
        
        // Mark player as processed
        updatedPlayerIds.add(player.id);
        
        // Create the pick
        const newPick: DraftPick = {
          id: `pick-${pickNumber}`,
          round: Math.ceil(pickNumber / newState.settings.numberOfTeams),
          pick: ((pickNumber - 1) % newState.settings.numberOfTeams) + 1,
          overall: pickNumber,
          team: targetTeam.id,
          player: { ...player, isDrafted: true, draftedBy: targetTeam.id },
          timestamp: new Date()
        };
        
        allPicks.push(newPick);
        
        // Add to team roster
        const teamRoster = teamRosterUpdates.get(targetTeam.id);
        if (teamRoster && player.position in teamRoster) {
          teamRoster[player.position as Position].push(player);
        }
      } catch (pickError) {
        console.error('Error processing individual pick:', { playerName, teamName, pickNumber }, pickError);
        // Continue processing other picks
      }
    }
    
    console.log(`Successfully processed ${allPicks.length} picks out of ${picksCount} attempted`);
    
    // Batch update all players efficiently
    const updatedPlayers = newState.players.map(p => {
      if (!updatedPlayerIds.has(p.id)) {
        return p;
      }
      
      const draftInfo = allPicks.find(pick => pick.player?.id === p.id);
      return { 
        ...p, 
        isDrafted: true, 
        draftedBy: draftInfo?.team 
      };
    });
    
    // Update all teams with new rosters
    const updatedTeams = newState.teams.map(team => ({
      ...team,
      roster: teamRosterUpdates.get(team.id) || team.roster
    }));
    
    // Calculate new current pick
    const maxPickNumber = allPicks.length > 0 ? 
      Math.max(...allPicks.map(p => p.overall), newState.currentPick - 1) : 
      newState.currentPick - 1;
    const newCurrentPick = maxPickNumber + 1;
    const maxPicks = newState.settings.numberOfTeams * newState.settings.numberOfRounds;
    
    // Efficiently merge picks
    const existingPicks = newState.picks.filter(p => !allPicks.some(newPick => newPick.overall === p.overall));
    const allMergedPicks = [...existingPicks, ...allPicks].sort((a, b) => a.overall - b.overall);
    
    return {
      ...newState,
      players: updatedPlayers,
      teams: updatedTeams,
      picks: allMergedPicks,
      currentPick: newCurrentPick,
      isActive: newCurrentPick <= maxPicks,
      picksUntilMyTurn: calculatePicksUntilMyTurn(newCurrentPick, newState.settings.draftSlot, newState.settings.numberOfTeams, newState.settings.draftType)
    };
  } catch (error) {
    console.error('Error in handleBatchSyncPicks:', error);
    // Return original state on error to prevent crashes
    return state;
  }
}

// Calculate which draft position (1-12) a pick number corresponds to
function calculateDraftPosition(pickNumber: number, numberOfTeams: number, draftType: string): number {
  const round = Math.ceil(pickNumber / numberOfTeams);
  const pickInRound = ((pickNumber - 1) % numberOfTeams) + 1;
  
  if (draftType === 'Snake' && round % 2 === 0) {
    // Even rounds are reversed in snake draft
    return numberOfTeams - pickInRound + 1;
  }
  
  return pickInRound;
}

function calculatePicksUntilMyTurn(currentPick: number, draftSlot: number, numberOfTeams: number, draftType: string): number {
  if (draftType === 'Linear') {
    const round = Math.ceil(currentPick / numberOfTeams);
    const nextMyPick = (round - 1) * numberOfTeams + draftSlot;
    return nextMyPick > currentPick ? nextMyPick - currentPick : numberOfTeams - (currentPick - nextMyPick);
  } else {
    const round = Math.ceil(currentPick / numberOfTeams);
    const isOddRound = round % 2 === 1;
    
    let nextMyPick: number;
    if (isOddRound) {
      nextMyPick = (round - 1) * numberOfTeams + draftSlot;
      if (nextMyPick < currentPick) {
        nextMyPick = round * numberOfTeams + (numberOfTeams - draftSlot + 1);
      }
    } else {
      nextMyPick = (round - 1) * numberOfTeams + (numberOfTeams - draftSlot + 1);
      if (nextMyPick < currentPick) {
        nextMyPick = round * numberOfTeams + draftSlot;
      }
    }
    
    return nextMyPick - currentPick;
  }
}

const DraftContext = createContext<{
  state: DraftState;
  dispatch: React.Dispatch<DraftAction>;
} | null>(null);

export const DraftProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(draftReducer, initialState);

  // Auto-save draft when state changes (except initial load)
  React.useEffect(() => {
    if (state.isActive || state.picks.length > 0 || state.players.length > 0) {
      autoSaveDraft(state, state.draftId);
    }
  }, [state]);

  return (
    <DraftContext.Provider value={{ state, dispatch }}>
      {children}
    </DraftContext.Provider>
  );
};

export const useDraft = () => {
  const context = useContext(DraftContext);
  if (!context) {
    throw new Error('useDraft must be used within a DraftProvider');
  }
  return context;
};