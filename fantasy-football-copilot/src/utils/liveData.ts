// Live fantasy football data from free APIs
import type { Player, CustomScoring } from '../types';
import { recalculatePlayerRankings } from './customScoring';

// Sleeper API - completely free, no API key required
const SLEEPER_BASE_URL = 'https://api.sleeper.app/v1';

interface SleeperPlayer {
  player_id: string;
  first_name: string;
  last_name: string;
  position: string;
  team: string;
  fantasy_positions: string[];
  status: string;
  injury_status?: string;
  age?: number;
  years_exp?: number;
}

interface SleeperTrendingPlayer {
  player_id: string;
  count: number;
}

// interface SleeperStats {
//   [playerId: string]: {
//     pts_ppr?: number;
//     pts_std?: number;
//     pts_half_ppr?: number;
//     gp?: number;
//   };
// }

let playersCache: { [key: string]: SleeperPlayer } | null = null;
let cacheExpiry = 0;

// Get all NFL players from Sleeper
export async function getSleeperPlayers(): Promise<{ [key: string]: SleeperPlayer }> {
  // Cache for 1 hour
  if (playersCache && Date.now() < cacheExpiry) {
    return playersCache;
  }

  try {
    const response = await fetch(`${SLEEPER_BASE_URL}/players/nfl`);
    if (!response.ok) {
      throw new Error(`Sleeper API error: ${response.status}`);
    }
    
    const players = await response.json();
    playersCache = players;
    cacheExpiry = Date.now() + (60 * 60 * 1000); // 1 hour
    
    return players;
  } catch (error) {
    console.error('Failed to fetch Sleeper players:', error);
    throw error;
  }
}

// Get trending players (popular adds/drops)
export async function getTrendingPlayers(): Promise<SleeperTrendingPlayer[]> {
  try {
    const response = await fetch(`${SLEEPER_BASE_URL}/players/nfl/trending/add`);
    if (!response.ok) {
      throw new Error(`Sleeper trending API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch trending players:', error);
    return [];
  }
}

// Convert Sleeper player data to our Player format
export function convertSleeperToPlayer(sleeperId: string, sleeperPlayer: SleeperPlayer, rank: number = 999): Player {
  const position = sleeperPlayer.position === 'DEF' ? 'DEF' : 
                   sleeperPlayer.fantasy_positions?.[0] || sleeperPlayer.position || 'UNKNOWN';

  return {
    id: sleeperId,
    name: `${sleeperPlayer.first_name || ''} ${sleeperPlayer.last_name || ''}`.trim(),
    position: position as any,
    team: sleeperPlayer.team || 'FA',
    adp: rank,
    tier: Math.ceil(rank / 24), // Rough tier calculation
    byeWeek: 0, // Would need separate API call for bye weeks
    rank,
    positionRank: 0, // Will be calculated later
    projectedPoints: 0,
    isTargeted: false,
    isDoNotDraft: sleeperPlayer.injury_status === 'Out',
    isDrafted: false,
    playoffSchedule: undefined
  };
}

// Load FantasyPros ADP rankings from local CSV file
export async function loadFantasyProsADP(): Promise<Player[]> {
  try {
    console.log('Loading FantasyPros ADP rankings from local CSV...');
    
    // Try to load the CSV file from the public directory
    const csvPath = '/FantasyPros_2025_Overall_ADP_Rankings.csv';
    const response = await fetch(csvPath);
    
    if (!response.ok) {
      throw new Error(`CSV file not found: ${csvPath}. Please ensure FantasyPros_2025_Overall_ADP_Rankings.csv is in the public directory.`);
    }
    
    const csvText = await response.text();
    
    // Parse CSV using simple parsing (since we control the format)
    const lines = csvText.split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    
    console.log('CSV headers found:', headers);
    
    const players: Player[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Handle CSV parsing with potential commas in names
      const values = parseCSVLine(line);
      if (values.length < headers.length) continue;
      
      const row: { [key: string]: string } = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      
      try {
        // Extract common FantasyPros CSV fields
        const rank = parseInt(row['RK'] || row['Rank'] || row['Overall Rank'] || (i).toString()) || i;
        const playerName = (row['Player'] || row['Name'] || row['PLAYER NAME'] || '').trim();
        const team = (row['Team'] || row['TM'] || row['NFL Team'] || '').trim().toUpperCase();
        const position = (row['POS'] || row['Position'] || '').trim().toUpperCase();
        const adp = parseFloat(row['ADP'] || row['Avg Draft Position'] || row['AVG'] || '0') || rank;
        const tier = parseInt(row['Tier'] || row['TIER'] || '') || Math.ceil(rank / 12);
        const byeWeek = parseInt(row['BYE'] || row['Bye Week'] || row['Bye'] || '0') || 0;
        const projectedPoints = parseFloat(row['PROJ'] || row['Projected Points'] || row['Points'] || '0') || 0;
        
        if (!playerName || !position) {
          console.warn(`Skipping row ${i}: missing name or position`, row);
          continue;
        }
        
        // Normalize position
        let normalizedPosition = position.toUpperCase().trim();
        
        // Handle FantasyPros numbered positions (WR1, WR2, RB1, DST1, etc.) FIRST
        if (normalizedPosition.match(/^(QB|RB|WR|TE|K|DEF|DST)\d+$/)) {
          normalizedPosition = normalizedPosition.replace(/\d+$/, '');
        }
        
        // THEN handle position conversions
        if (normalizedPosition === 'D/ST' || normalizedPosition === 'DST' || normalizedPosition === 'D') normalizedPosition = 'DEF';
        if (normalizedPosition === 'PK' || normalizedPosition === 'K/P') normalizedPosition = 'K';
        
        // Validate position
        if (!['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].includes(normalizedPosition)) {
          console.warn(`Skipping ${playerName}: invalid position "${position}"`);
          continue;
        }
        
        const player: Player = {
          id: `fp-${rank}-${playerName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`,
          name: playerName,
          position: normalizedPosition as any,
          team: team || 'FA',
          adp,
          tier,
          byeWeek,
          rank,
          positionRank: 0, // Will be calculated after all players are loaded
          projectedPoints,
          isTargeted: false,
          isDoNotDraft: false,
          isDrafted: false,
          playoffSchedule: undefined
        };
        
        players.push(player);
        
      } catch (err) {
        console.warn(`Error parsing row ${i}:`, err, row);
      }
    }
    
    console.log(`Loaded ${players.length} players from FantasyPros ADP CSV`);
    
    // Calculate position ranks
    const sortedPlayers = players.sort((a, b) => a.rank - b.rank);
    const positionCounts: Record<string, number> = {};
    
    sortedPlayers.forEach(player => {
      positionCounts[player.position] = (positionCounts[player.position] || 0) + 1;
      player.positionRank = positionCounts[player.position];
    });
    
    console.log(`Top 10 players: ${sortedPlayers.slice(0, 10).map(p => `${p.rank}. ${p.name} (${p.position}${p.positionRank}) - ADP: ${p.adp}`).join(', ')}`);
    
    return sortedPlayers;
    
  } catch (error) {
    console.error('Failed to load FantasyPros ADP:', error);
    throw error;
  }
}

// Simple CSV line parser that handles quotes and commas
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result.map(val => val.replace(/^"(.*)"$/, '$1')); // Remove surrounding quotes
}

// Generate live rankings using FantasyPros ADP data enhanced with Sleeper player data
export async function generateLiveRankings(customScoring?: CustomScoring, scoringType: 'PPR' | 'Half-PPR' | 'Standard' | 'Custom' = 'PPR'): Promise<Player[]> {
  try {
    console.log('Loading FantasyPros ADP data...');
    
    // Load the FantasyPros CSV data
    const fpPlayers = await loadFantasyProsADP();
    
    // Try to enhance with live Sleeper data for injury status, etc.
    try {
      console.log('Enhancing with live Sleeper data...');
      const sleeperPlayers = await getSleeperPlayers();
      
      // Create name mapping for Sleeper data
      const sleeperByName = new Map<string, SleeperPlayer>();
      Object.values(sleeperPlayers).forEach(player => {
        const fullName = `${player.first_name || ''} ${player.last_name || ''}`.trim();
        if (fullName) {
          sleeperByName.set(fullName.toLowerCase(), player);
          // Also add variations
          sleeperByName.set(fullName.toLowerCase().replace(/\./g, ''), player);
          sleeperByName.set(fullName.toLowerCase().replace(/jr\.?/i, '').trim(), player);
        }
      });
      
      // Enhance FantasyPros data with Sleeper data
      fpPlayers.forEach(player => {
        const sleeperPlayer = sleeperByName.get(player.name.toLowerCase()) ||
                             sleeperByName.get(player.name.toLowerCase().replace(/\./g, '')) ||
                             sleeperByName.get(player.name.toLowerCase().replace(/jr\.?/i, '').trim());
        
        if (sleeperPlayer) {
          // Update team if different (trades, etc.)
          if (sleeperPlayer.team && sleeperPlayer.team !== 'FA') {
            player.team = sleeperPlayer.team;
          }
          
          // Mark injured players as do not draft
          if (sleeperPlayer.injury_status === 'Out' || sleeperPlayer.status !== 'Active') {
            player.isDoNotDraft = true;
          }
        }
      });
      
      console.log('Enhanced FantasyPros data with live Sleeper information');
      
    } catch (sleeperError) {
      console.warn('Could not enhance with Sleeper data:', sleeperError);
      // Continue with just FantasyPros data
    }
    
    // Recalculate rankings based on custom scoring if provided
    if (scoringType === 'Custom' && customScoring) {
      console.log('Recalculating rankings with custom scoring...');
      return recalculatePlayerRankings(fpPlayers, customScoring, scoringType);
    } else if (scoringType !== 'PPR') {
      console.log(`Recalculating rankings for ${scoringType} scoring...`);
      return recalculatePlayerRankings(fpPlayers, undefined, scoringType);
    }
    
    return fpPlayers;
    
  } catch (error) {
    console.error('Failed to generate live rankings:', error);
    throw new Error(`Failed to load FantasyPros ADP data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Get specific player by name from Sleeper data
export async function findPlayerByName(playerName: string): Promise<Player | null> {
  try {
    const players = await getSleeperPlayers();
    
    const searchName = playerName.toLowerCase().trim();
    for (const [playerId, sleeperPlayer] of Object.entries(players)) {
      const fullName = `${sleeperPlayer.first_name || ''} ${sleeperPlayer.last_name || ''}`.toLowerCase().trim();
      
      if (fullName === searchName || 
          fullName.includes(searchName) || 
          searchName.includes(fullName)) {
        return convertSleeperToPlayer(playerId, sleeperPlayer);
      }
    }
    
    return null;
  } catch (error) {
    console.error('Failed to find player:', error);
    return null;
  }
}

// Update existing players with live data
export async function enhancePlayersWithLiveData(existingPlayers: Player[]): Promise<Player[]> {
  try {
    console.log('Enhancing player data with live information...');
    
    const sleeperPlayers = await getSleeperPlayers();
    const enhanced = [...existingPlayers];
    
    for (const player of enhanced) {
      // Try to find matching Sleeper player
      const match = Object.entries(sleeperPlayers).find(([id, sp]) => {
        const fullName = `${sp.first_name || ''} ${sp.last_name || ''}`.trim().toLowerCase();
        return fullName === player.name.toLowerCase();
      });
      
      if (match) {
        const [, sleeperPlayer] = match;
        
        // Update with live data but preserve existing rankings
        player.team = sleeperPlayer.team || player.team;
        if (sleeperPlayer.injury_status === 'Out') {
          player.isDoNotDraft = true;
        }
        
        console.log(`Enhanced ${player.name} with live data`);
      }
    }
    
    return enhanced;
    
  } catch (error) {
    console.error('Failed to enhance players with live data:', error);
    return existingPlayers; // Return original data if enhancement fails
  }
}