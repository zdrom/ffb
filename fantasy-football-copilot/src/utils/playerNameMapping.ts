// Player name mapping system for handling variations between different sources
import type { Player } from '../types';

const PLAYER_NAME_MAPPINGS_KEY = 'fantasy-draft-copilot-player-name-mappings';

export interface PlayerNameMapping {
  yahooName: string;     // Name as it appears in Yahoo/external source
  vorpName: string;      // Name as it appears in VORP data
  createdAt: string;
  isManual: boolean;     // True if manually created by user
}

// Default mappings for common name variations
const DEFAULT_MAPPINGS: PlayerNameMapping[] = [
  { yahooName: 'Cam Ward', vorpName: 'Cameron Ward', createdAt: new Date().toISOString(), isManual: false },
  { yahooName: 'Hollywood Brown', vorpName: 'Marquise Brown', createdAt: new Date().toISOString(), isManual: false },
  { yahooName: 'DJ Moore', vorpName: 'D.J. Moore', createdAt: new Date().toISOString(), isManual: false },
  { yahooName: 'AJ Brown', vorpName: 'A.J. Brown', createdAt: new Date().toISOString(), isManual: false },
  { yahooName: 'TJ Hockenson', vorpName: 'T.J. Hockenson', createdAt: new Date().toISOString(), isManual: false },
  { yahooName: 'JK Dobbins', vorpName: 'J.K. Dobbins', createdAt: new Date().toISOString(), isManual: false },
  { yahooName: 'DJ Turner', vorpName: 'D.J. Turner', createdAt: new Date().toISOString(), isManual: false },
  { yahooName: 'Rome Odunze', vorpName: 'Rome Odunze', createdAt: new Date().toISOString(), isManual: false },
  { yahooName: 'Wandale Robinson', vorpName: 'Wan\'Dale Robinson', createdAt: new Date().toISOString(), isManual: false },
  { yahooName: 'Wan\'Dale Robinson', vorpName: 'WanDale Robinson', createdAt: new Date().toISOString(), isManual: false },
  { yahooName: 'Kenneth Walker III', vorpName: 'Kenneth Walker', createdAt: new Date().toISOString(), isManual: false },
  { yahooName: 'Kenneth Walker', vorpName: 'Kenneth Walker III', createdAt: new Date().toISOString(), isManual: false },
  { yahooName: 'Gabriel Davis', vorpName: 'Gabe Davis', createdAt: new Date().toISOString(), isManual: false },
  { yahooName: 'Gabe Davis', vorpName: 'Gabriel Davis', createdAt: new Date().toISOString(), isManual: false },
];

// Load mappings from localStorage
export function loadPlayerNameMappings(): PlayerNameMapping[] {
  try {
    const stored = localStorage.getItem(PLAYER_NAME_MAPPINGS_KEY);
    if (!stored) {
      // Initialize with default mappings
      savePlayerNameMappings(DEFAULT_MAPPINGS);
      return DEFAULT_MAPPINGS;
    }
    
    const mappings = JSON.parse(stored) as PlayerNameMapping[];
    
    // Merge with default mappings (add any new defaults that don't exist)
    const existingYahooNames = new Set(mappings.map(m => m.yahooName.toLowerCase()));
    const newDefaults = DEFAULT_MAPPINGS.filter(def => 
      !existingYahooNames.has(def.yahooName.toLowerCase())
    );
    
    if (newDefaults.length > 0) {
      const mergedMappings = [...mappings, ...newDefaults];
      savePlayerNameMappings(mergedMappings);
      return mergedMappings;
    }
    
    return mappings;
  } catch (error) {
    console.error('Failed to load player name mappings:', error);
    return DEFAULT_MAPPINGS;
  }
}

// Save mappings to localStorage
export function savePlayerNameMappings(mappings: PlayerNameMapping[]): void {
  try {
    localStorage.setItem(PLAYER_NAME_MAPPINGS_KEY, JSON.stringify(mappings));
    console.log(`Saved ${mappings.length} player name mappings`);
  } catch (error) {
    console.error('Failed to save player name mappings:', error);
  }
}

// Add a new manual mapping
export function addPlayerNameMapping(yahooName: string, vorpName: string): void {
  const mappings = loadPlayerNameMappings();
  
  // Remove any existing mapping for this Yahoo name
  const filteredMappings = mappings.filter(m => 
    m.yahooName.toLowerCase() !== yahooName.toLowerCase()
  );
  
  const newMapping: PlayerNameMapping = {
    yahooName: yahooName.trim(),
    vorpName: vorpName.trim(),
    createdAt: new Date().toISOString(),
    isManual: true
  };
  
  filteredMappings.push(newMapping);
  savePlayerNameMappings(filteredMappings);
  
  console.log(`Added player name mapping: "${yahooName}" -> "${vorpName}"`);
}

// Remove a mapping
export function removePlayerNameMapping(yahooName: string): void {
  const mappings = loadPlayerNameMappings();
  const filteredMappings = mappings.filter(m => 
    m.yahooName.toLowerCase() !== yahooName.toLowerCase()
  );
  
  if (filteredMappings.length < mappings.length) {
    savePlayerNameMappings(filteredMappings);
    console.log(`Removed player name mapping for: "${yahooName}"`);
  }
}

// Find VORP name for a Yahoo name
export function mapYahooNameToVORP(yahooName: string): string | null {
  const mappings = loadPlayerNameMappings();
  const mapping = mappings.find(m => 
    m.yahooName.toLowerCase() === yahooName.toLowerCase()
  );
  
  return mapping ? mapping.vorpName : null;
}

// Enhanced player search that uses mappings
export function findPlayerWithMapping(
  searchName: string, 
  players: Player[], 
  useMapping: boolean = true
): Player | null {
  if (!searchName || players.length === 0) return null;
  
  const normalizedSearchName = searchName.toLowerCase().trim();
  
  // 1. Try exact match first
  let player = players.find(p => 
    !p.isDrafted && p.name.toLowerCase().trim() === normalizedSearchName
  ) || null;
  
  if (player) return player;
  
  // 2. Try mapping if enabled
  if (useMapping) {
    const mappedName = mapYahooNameToVORP(searchName);
    if (mappedName) {
      const normalizedMappedName = mappedName.toLowerCase().trim();
      player = players.find(p => 
        !p.isDrafted && p.name.toLowerCase().trim() === normalizedMappedName
      );
      
      if (player) {
        console.log(`Found player via mapping: "${searchName}" -> "${mappedName}" -> ${player.name}`);
        return player;
      }
    }
  }
  
  // 3. Try partial matching with clean names
  const cleanSearchName = normalizedSearchName
    .replace(/[.']/g, '')
    .replace(/\s+jr\.?$/, '')
    .replace(/\s+sr\.?$/, '')
    .replace(/\s+iii?$/, '')
    .trim();
  
  player = players.find(p => {
    if (p.isDrafted) return false;
    
    const normalizedPlayerName = p.name.toLowerCase().trim();
    const cleanPlayerName = normalizedPlayerName
      .replace(/[.']/g, '')
      .replace(/\s+jr\.?$/, '')
      .replace(/\s+sr\.?$/, '')
      .replace(/\s+iii?$/, '')
      .trim();
    
    // Exact match on clean names
    if (cleanPlayerName === cleanSearchName) return true;
    
    // Partial matching both ways
    return cleanPlayerName.includes(cleanSearchName) || 
           cleanSearchName.includes(cleanPlayerName);
  });
  
  return player;
}

// Get all mappings for UI display
export function getAllPlayerNameMappings(): PlayerNameMapping[] {
  return loadPlayerNameMappings();
}

// Get unmapped failures for suggestion
export function getUnmappedFailures(): string[] {
  const failures = localStorage.getItem('fantasy-draft-copilot-unmapped-failures');
  if (!failures) return [];
  
  try {
    return JSON.parse(failures) as string[];
  } catch {
    return [];
  }
}

// Track unmapped failure for later mapping
export function trackUnmappedFailure(yahooName: string): void {
  const failures = getUnmappedFailures();
  const normalizedName = yahooName.trim();
  
  if (!failures.includes(normalizedName)) {
    failures.push(normalizedName);
    
    // Keep only last 50 failures to prevent storage bloat
    const recentFailures = failures.slice(-50);
    
    try {
      localStorage.setItem('fantasy-draft-copilot-unmapped-failures', JSON.stringify(recentFailures));
    } catch (error) {
      console.error('Failed to track unmapped failure:', error);
    }
  }
}

// Clear unmapped failures
export function clearUnmappedFailures(): void {
  try {
    localStorage.removeItem('fantasy-draft-copilot-unmapped-failures');
  } catch (error) {
    console.error('Failed to clear unmapped failures:', error);
  }
}

// Auto-suggest mappings based on similarity
export function suggestMapping(yahooName: string, players: Player[]): Player[] {
  const normalizedYahooName = yahooName.toLowerCase().trim();
  const suggestions: Array<{ player: Player; score: number }> = [];
  
  for (const player of players) {
    if (player.isDrafted) continue;
    
    const normalizedPlayerName = player.name.toLowerCase().trim();
    
    // Calculate similarity score
    let score = 0;
    
    // Check for word overlap
    const yahooWords = normalizedYahooName.split(/\s+/);
    const playerWords = normalizedPlayerName.split(/\s+/);
    
    const commonWords = yahooWords.filter(word => 
      playerWords.some(pWord => pWord.includes(word) || word.includes(pWord))
    );
    
    score += commonWords.length * 10;
    
    // Check for substring matches
    if (normalizedPlayerName.includes(normalizedYahooName)) score += 15;
    if (normalizedYahooName.includes(normalizedPlayerName)) score += 15;
    
    // Bonus for length similarity
    const lengthDiff = Math.abs(normalizedYahooName.length - normalizedPlayerName.length);
    if (lengthDiff <= 3) score += 5;
    
    if (score >= 10) {
      suggestions.push({ player, score });
    }
  }
  
  // Sort by score and return top 5
  return suggestions
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(s => s.player);
}