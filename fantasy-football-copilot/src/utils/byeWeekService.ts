// Service for loading and mapping NFL team bye weeks
interface ByeWeekData {
  [team: string]: number; // Team -> Week number
}

let byeWeekCache: ByeWeekData | null = null;

// Load bye week data from CSV
export async function loadByeWeeks(): Promise<ByeWeekData> {
  if (byeWeekCache) {
    return byeWeekCache;
  }

  try {
    const response = await fetch('/byes.csv');
    if (!response.ok) {
      throw new Error('Failed to load bye weeks CSV');
    }

    const csvText = await response.text();
    const lines = csvText.split('\n').filter(line => line.trim());
    
    const byeWeeks: ByeWeekData = {};
    
    // Skip header row
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Parse "Week X,Team Name" format
      const match = line.match(/^Week\s+(\d+),(.+)$/);
      if (match) {
        const week = parseInt(match[1]);
        const teamName = match[2].trim();
        
        // Map full team names to abbreviations
        const teamAbbr = mapTeamNameToAbbreviation(teamName);
        if (teamAbbr) {
          byeWeeks[teamAbbr] = week;
        }
      }
    }

    byeWeekCache = byeWeeks;
    console.log('Loaded bye weeks for', Object.keys(byeWeeks).length, 'teams');
    return byeWeeks;
  } catch (error) {
    console.error('Failed to load bye weeks:', error);
    return {};
  }
}

// Map full team names to standard abbreviations
function mapTeamNameToAbbreviation(teamName: string): string | null {
  const teamMap: { [key: string]: string } = {
    // AFC East
    'Buffalo Bills': 'BUF',
    'Miami Dolphins': 'MIA', 
    'New England Patriots': 'NE',
    'New York Jets': 'NYJ',
    
    // AFC North
    'Baltimore Ravens': 'BAL',
    'Cincinnati Bengals': 'CIN',
    'Cleveland Browns': 'CLE',
    'Pittsburgh Steelers': 'PIT',
    
    // AFC South
    'Houston Texans': 'HOU',
    'Indianapolis Colts': 'IND',
    'Jacksonville Jaguars': 'JAX',
    'Tennessee Titans': 'TEN',
    
    // AFC West
    'Denver Broncos': 'DEN',
    'Kansas City Chiefs': 'KC',
    'Las Vegas Raiders': 'LV',
    'Los Angeles Chargers': 'LAC',
    
    // NFC East
    'Dallas Cowboys': 'DAL',
    'New York Giants': 'NYG',
    'Philadelphia Eagles': 'PHI',
    'Washington Commanders': 'WAS',
    
    // NFC North
    'Chicago Bears': 'CHI',
    'Detroit Lions': 'DET',
    'Green Bay Packers': 'GB',
    'Minnesota Vikings': 'MIN',
    
    // NFC South
    'Atlanta Falcons': 'ATL',
    'Carolina Panthers': 'CAR',
    'New Orleans Saints': 'NO',
    'Tampa Bay Buccaneers': 'TB',
    
    // NFC West
    'Arizona Cardinals': 'ARI',
    'Los Angeles Rams': 'LAR',
    'San Francisco 49ers': 'SF',
    'Seattle Seahawks': 'SEA'
  };

  return teamMap[teamName] || null;
}

// Get bye week for a specific team
export async function getByeWeekForTeam(team: string): Promise<number> {
  const byeWeeks = await loadByeWeeks();
  return byeWeeks[team.toUpperCase()] || 0;
}

// Enhance player data with bye week information
export async function enhancePlayersWithByeWeeks<T extends { team: string; byeWeek?: number }>(players: T[]): Promise<T[]> {
  const byeWeeks = await loadByeWeeks();
  
  return players.map(player => ({
    ...player,
    byeWeek: byeWeeks[player.team.toUpperCase()] || player.byeWeek || 0
  }));
}