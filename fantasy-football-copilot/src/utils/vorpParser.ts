// VORP rankings parser for FantasyPros format
import type { Player, Position } from '../types';

export interface ParsedVORPData {
  rank: number;
  name: string;
  team: string;
  position: string;
  vorp: number;
  adp: number;
}

export interface ParseResult {
  players: Player[];
  skippedLines: { line: string; reason: string; lineNumber: number }[];
  totalLines: number;
  parsedLines: number;
}

// Parse VORP rankings from FantasyPros format
// Expected format: "1 Christian McCaffrey (SF) RB1 15.2 3.1 vs 3.1"
export function parseVORPRankings(text: string): Player[] {
  const result = parseVORPRankingsDetailed(text);
  return result.players;
}

// Parse with detailed results for debugging
export function parseVORPRankingsDetailed(text: string): ParseResult {
  if (!text?.trim()) {
    return { players: [], skippedLines: [], totalLines: 0, parsedLines: 0 };
  }

  const lines = text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  const players: Player[] = [];
  const skippedLines: { line: string; reason: string; lineNumber: number }[] = [];
  let parsedLines = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;
    
    try {
      const parsed = parseVORPLine(line);
      if (parsed) {
        const player: Player = {
          id: `player-${parsed.rank}`,
          name: parsed.name,
          team: parsed.team,
          position: extractPosition(parsed.position) as Position, // Extract base position (RB from RB1)
          vorp: parsed.vorp,
          adp: parsed.adp,
          rank: parsed.rank,
          positionRank: extractPositionRank(parsed.position), // Extract rank number (1 from RB1)
          tier: calculateTier(parsed.vorp, parsed.position),
          projectedPoints: calculateProjectedPoints(parsed.vorp, extractPosition(parsed.position)),
          byeWeek: 0, // Default value, can be updated later if needed
          isDrafted: false,
          isTargeted: false,
          isDoNotDraft: false
        };
        players.push(player);
        parsedLines++;
      } else {
        skippedLines.push({
          line: line,
          reason: 'Could not parse format - expected pattern like "1 Player Name (TEAM) POS1 VORP ADP"',
          lineNumber
        });
      }
    } catch (error) {
      skippedLines.push({
        line: line,
        reason: `Parse error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        lineNumber
      });
      continue; // Skip invalid lines but continue parsing
    }
  }

  console.log(`VORP Parser Results: ${parsedLines} players parsed, ${skippedLines.length} lines skipped from ${lines.length} total lines`);
  
  // Calculate dynamic tiers based on actual player distribution
  if (players.length > 0) {
    console.log('Calculating dynamic tiers based on VORP distribution...');
    calculateDynamicTiers(players);
  }
  
  // Show detailed information about skipped lines
  if (skippedLines.length > 0) {
    console.group('🚨 Skipped Lines (need fixing):');
    skippedLines.forEach(skip => {
      console.log(`Line ${skip.lineNumber}: "${skip.line}"`);
      console.log(`  → Reason: ${skip.reason}`);
      console.log('');
    });
    console.groupEnd();
  }
  
  // Show sample of first few parsed players for debugging
  if (players.length > 0) {
    console.log('✅ Sample parsed players:', players.slice(0, 3).map(p => ({
      rank: p.rank,
      name: p.name,
      team: p.team,
      position: p.position,
      vorp: p.vorp,
      tier: p.tier,
      adp: p.adp
    })));
  }

  return {
    players,
    skippedLines,
    totalLines: lines.length,
    parsedLines
  };
}

// Parse a single VORP line
function parseVORPLine(line: string): ParsedVORPData | null {
  // Remove header lines
  if (line.toLowerCase().includes('value over replacement') || 
      line.toLowerCase().includes('rank') ||
      line.toLowerCase().includes('player') ||
      line.toLowerCase().includes('fantasypros')) {
    return null;
  }

  // Handle various formats with regex - be more flexible
  // Format: "1 Christian McCaffrey (SF) RB1 15.2 3.1 vs 3.1"
  // Also handles: "1\tChristian McCaffrey (SF)\tRB1\t15.2\t3.1\tvs 3.1"
  
  const regex = /^(\d+)[\s\t]+(.+?)\s+\(([A-Z]{2,4})\)[\s\t]+([A-Z]{1,3}\d*)[\s\t]+([-\d.]+)[\s\t]+([-\d.]+)/;
  const match = line.match(regex);
  
  if (!match) {
    // Try simpler format without parentheses: "1 Christian McCaffrey SF RB1 15.2 3.1"
    const simpleRegex = /^(\d+)[\s\t]+(.+?)[\s\t]+([A-Z]{2,4})[\s\t]+([A-Z]{1,3}\d*)[\s\t]+([-\d.]+)[\s\t]+([-\d.]+)/;
    const simpleMatch = line.match(simpleRegex);
    
    if (simpleMatch) {
      const vorp = parseFloat(simpleMatch[5]);
      const adp = parseFloat(simpleMatch[6]);
      
      return {
        rank: parseInt(simpleMatch[1]),
        name: simpleMatch[2].trim(),
        team: simpleMatch[3].trim(),
        position: simpleMatch[4].trim(),
        vorp: isNaN(vorp) ? 0 : vorp, // Default to 0 if parsing fails
        adp: isNaN(adp) ? 999 : adp   // Default to high ADP if parsing fails
      };
    }
    
    // Try even more flexible format - split by whitespace and work backwards
    const parts = line.split(/\s+/).filter(part => part.length > 0);
    if (parts.length >= 6) {
      const rank = parseInt(parts[0]);
      if (!isNaN(rank)) {
        // Find the position (should be like RB1, WR2, K1, etc.)
        let positionIndex = -1;
        for (let i = 1; i < parts.length; i++) {
          if (/^[A-Z]{1,3}\d*$/.test(parts[i])) {
            positionIndex = i;
            break;
          }
        }
        
        if (positionIndex > 1 && positionIndex < parts.length - 2) {
          const nameAndTeam = parts.slice(1, positionIndex).join(' ');
          const position = parts[positionIndex];
          const vorpStr = parts[positionIndex + 1];
          const adpStr = parts[positionIndex + 2];
          
          // Extract team from name (if in parentheses)
          let name = nameAndTeam;
          let team = 'UNK';
          const teamMatch = nameAndTeam.match(/(.+?)\s*\(([A-Z]{2,4})\)/);
          if (teamMatch) {
            name = teamMatch[1].trim();
            team = teamMatch[2];
          }
          
          const vorp = parseFloat(vorpStr);
          const adp = parseFloat(adpStr);
          
          return {
            rank,
            name,
            team,
            position,
            vorp: isNaN(vorp) ? 0 : vorp,
            adp: isNaN(adp) ? 999 : adp
          };
        }
      }
    }
    
    return null;
  }

  const vorp = parseFloat(match[5]);
  const adp = parseFloat(match[6]);

  return {
    rank: parseInt(match[1]),
    name: match[2].trim(),
    team: match[3].trim(),
    position: match[4].trim(),
    vorp: isNaN(vorp) ? 0 : vorp,
    adp: isNaN(adp) ? 999 : adp
  };
}

// Extract base position from numbered position (RB from RB1, K from K1)
function extractPosition(positionString: string): string {
  const match = positionString.match(/^([A-Z]{1,3})/);
  return match ? match[1] : positionString;
}

// Extract position rank number (1 from RB1)
function extractPositionRank(positionString: string): number {
  const match = positionString.match(/(\d+)$/);
  return match ? parseInt(match[1]) : 1;
}

// Calculate projected points from VORP and position
function calculateProjectedPoints(vorp: number, position: string): number {
  // Safety check for input values
  if (isNaN(vorp)) {
    console.warn(`calculateProjectedPoints received NaN vorp for position ${position}`);
    vorp = 0;
  }

  // Position baseline points (approximate replacement level points)
  const positionBaselines: { [key: string]: number } = {
    'QB': 288.4,  // QB12 baseline
    'RB': 191.8,  // RB24 baseline
    'WR': 207.0,  // WR30 baseline
    'TE': 120.0,  // TE12 baseline
    'K': 140.0,   // K12 baseline
    'DEF': 130.0  // DEF12 baseline
  };

  const baseline = positionBaselines[position] || 150;
  
  // Projected points = VORP + baseline
  // Ensure we don't go below a reasonable minimum
  const projectedPoints = Math.max(baseline * 0.5, baseline + vorp);
  
  return projectedPoints;
}

// Calculate dynamic tiers based on actual player distribution
function calculateDynamicTiers(players: Player[]): void {
  // Group players by position
  const positionGroups: { [key: string]: Player[] } = {};
  
  players.forEach(player => {
    const position = player.position;
    if (!positionGroups[position]) {
      positionGroups[position] = [];
    }
    positionGroups[position].push(player);
  });

  // Calculate tiers for each position based on VORP distribution
  Object.keys(positionGroups).forEach(position => {
    const positionPlayers = positionGroups[position];
    
    // Sort by VORP descending
    positionPlayers.sort((a, b) => (b.vorp || 0) - (a.vorp || 0));
    
    // Calculate tier breakpoints based on percentiles and natural breaks
    const thresholds = calculateTierThresholds(positionPlayers);
    
    // Assign tiers based on calculated thresholds
    positionPlayers.forEach(player => {
      player.tier = getTierFromThresholds(player.vorp || 0, thresholds);
    });
    
    console.log(`${position} tier thresholds:`, thresholds, `(${positionPlayers.length} players)`);
  });
}

// Calculate tier thresholds based on VORP distribution
function calculateTierThresholds(players: Player[]): number[] {
  if (players.length === 0) return [0, 0, 0];
  
  const vorpValues = players.map(p => p.vorp || 0).filter(v => v > 0);
  
  if (vorpValues.length === 0) return [0, 0, 0];
  
  // Use a combination of percentiles and natural breaks
  vorpValues.sort((a, b) => b - a); // Sort descending
  
  const len = vorpValues.length;
  const maxVorp = vorpValues[0];
  const minVorp = vorpValues[len - 1];
  
  // Tier 1 (Elite): Top ~15% or natural break after elite players
  const tier1Index = Math.max(0, Math.min(Math.floor(len * 0.15), 5));
  const tier1Threshold = vorpValues[tier1Index] || maxVorp * 0.85;
  
  // Tier 2 (Very Good): Top ~35% or significant drop
  const tier2Index = Math.max(tier1Index + 1, Math.floor(len * 0.35));
  const tier2Threshold = vorpValues[tier2Index] || maxVorp * 0.6;
  
  // Tier 3 (Startable): Top ~65% or meaningful positive VORP
  const tier3Index = Math.max(tier2Index + 1, Math.floor(len * 0.65));
  const tier3Threshold = Math.max(vorpValues[tier3Index] || maxVorp * 0.3, minVorp + (maxVorp - minVorp) * 0.2);
  
  return [tier1Threshold, tier2Threshold, tier3Threshold];
}

// Get tier number from thresholds
function getTierFromThresholds(vorp: number, thresholds: number[]): number {
  if (vorp >= thresholds[0]) return 1; // Elite
  if (vorp >= thresholds[1]) return 2; // Very Good  
  if (vorp >= thresholds[2]) return 3; // Startable
  return 4; // Replacement/Bench
}

// Legacy function for backward compatibility - now just returns a placeholder
function calculateTier(vorp: number, position: string): number {
  // This will be overridden by dynamic calculation
  return 4; // Default to lowest tier, will be recalculated
}

// Validate parsed player data
export function validateVORPData(players: Player[]): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (players.length === 0) {
    errors.push('No players found in the data');
    return { valid: false, errors, warnings };
  }

  // Check for required positions (warning, not error)
  const positions = new Set(players.map(p => p.position));
  const requiredPositions = ['QB', 'RB', 'WR', 'TE'];
  
  for (const pos of requiredPositions) {
    if (!positions.has(pos as Position)) {
      warnings.push(`No ${pos} players found - this is unusual but allowed`);
    }
  }

  // Check for reasonable VORP values - be more specific and less strict
  const invalidVORP = players.filter(p => p.vorp !== undefined && isNaN(p.vorp));
  if (invalidVORP.length > 0) {
    errors.push(`${invalidVORP.length} players have NaN VORP values: ${invalidVORP.slice(0, 5).map(p => p.name).join(', ')}${invalidVORP.length > 5 ? '...' : ''}`);
  }

  // Check for extremely unusual VORP values (warnings, not errors)
  const extremeVORP = players.filter(p => p.vorp !== undefined && !isNaN(p.vorp) && (p.vorp < -10 || p.vorp > 100));
  if (extremeVORP.length > 0) {
    warnings.push(`${extremeVORP.length} players have extreme VORP values (outside -10 to 100): ${extremeVORP.slice(0, 3).map(p => `${p.name} (${p.vorp})`).join(', ')}${extremeVORP.length > 3 ? '...' : ''}`);
  }

  // Check for duplicate names (warning, not error - sometimes there are Jr/Sr variations)
  const names = players.map(p => p.name);
  const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
  if (duplicates.length > 0) {
    warnings.push(`Potential duplicate player names found: ${[...new Set(duplicates)].join(', ')}`);
  }

  // Only fail validation for critical errors (NaN values)
  return { valid: errors.length === 0, errors, warnings };
}

// Generate sample VORP data for testing
export function generateSampleVORPData(): string {
  return `2025 Value Over Replacement Player (VORP) Rankings - FantasyPros
1	Christian McCaffrey (SF) RB1	15.2	3.1	vs 3.1
2	Tyreek Hill (MIA) WR1	14.8	7.2	vs 7.2
3	CeeDee Lamb (DAL) WR2	14.3	5.8	vs 5.8
4	Ja'Marr Chase (CIN) WR3	13.9	6.4	vs 6.4
5	Amon-Ra St. Brown (DET) WR4	13.5	8.1	vs 8.1
6	Bijan Robinson (ATL) RB2	13.1	9.3	vs 9.3
7	Josh Allen (BUF) QB1	12.7	15.2	vs 15.2
8	Stefon Diggs (HOU) WR5	12.3	11.8	vs 11.8
9	A.J. Brown (PHI) WR6	11.9	10.7	vs 10.7
10	Saquon Barkley (PHI) RB3	11.5	12.4	vs 12.4
11	Lamar Jackson (BAL) QB2	11.1	18.7	vs 18.7
12	Garrett Wilson (NYJ) WR7	10.7	15.3	vs 15.3
13	Mike Evans (TB) WR8	10.3	14.1	vs 14.1
14	Breece Hall (NYJ) RB4	9.9	13.8	vs 13.8
15	Travis Kelce (KC) TE1	9.5	16.9	vs 16.9
16	Puka Nacua (LAR) WR9	9.1	17.2	vs 17.2
17	Davante Adams (LV) WR10	8.7	19.4	vs 19.4
18	Jaylen Waddle (MIA) WR11	8.3	21.1	vs 21.1
19	DeVonta Smith (PHI) WR12	7.9	22.8	vs 22.8
20	Jonathan Taylor (IND) RB5	7.5	20.3	vs 20.3`;
}