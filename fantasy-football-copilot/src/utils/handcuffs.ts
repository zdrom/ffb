import type { Player, HandcuffRecommendation, Position } from '../types';

// Handcuff mappings for 2025 season - key is primary player ID/name, value is array of handcuffs
const HANDCUFF_MAPPINGS: Record<string, Array<{
  name: string;
  type: 'Direct' | 'Committee' | 'Insurance';
  priority: 'High' | 'Medium' | 'Low';
  reasoning: string;
}>> = {
  // High-profile RB handcuffs
  'Christian McCaffrey': [
    { name: 'Jordan Mason', type: 'Direct', priority: 'High', reasoning: 'Primary backup, proven when CMC injured' },
    { name: 'Elijah Mitchell', type: 'Insurance', priority: 'Medium', reasoning: 'Secondary depth option' }
  ],
  'Josh Jacobs': [
    { name: 'Emanuel Wilson', type: 'Direct', priority: 'High', reasoning: 'Clear backup with upside' },
    { name: 'MarShawn Lloyd', type: 'Committee', priority: 'Medium', reasoning: 'Rookie with passing game role' }
  ],
  'Saquon Barkley': [
    { name: 'Kenneth Gainwell', type: 'Committee', priority: 'Medium', reasoning: 'Pass-catching specialist backup' },
    { name: 'Boston Scott', type: 'Insurance', priority: 'Low', reasoning: 'Goal-line and injury replacement' }
  ],
  'Derrick Henry': [
    { name: 'Justice Hill', type: 'Committee', priority: 'Medium', reasoning: 'Pass-catching complement' },
    { name: 'Keaton Mitchell', type: 'Insurance', priority: 'Medium', reasoning: 'Change of pace back when healthy' }
  ],
  'Jonathan Taylor': [
    { name: 'Trey Sermon', type: 'Direct', priority: 'Medium', reasoning: 'Primary backup runner' },
    { name: 'Tyler Goodson', type: 'Committee', priority: 'Low', reasoning: 'Pass-catching specialist' }
  ],
  
  // QB handcuffs
  'Josh Allen': [
    { name: 'Mitchell Trubisky', type: 'Direct', priority: 'Low', reasoning: 'Veteran backup QB' }
  ],
  'Lamar Jackson': [
    { name: 'Tyler Huntley', type: 'Direct', priority: 'Medium', reasoning: 'Similar skillset, rushing upside' }
  ],
  'Jalen Hurts': [
    { name: 'Kenny Pickett', type: 'Direct', priority: 'Low', reasoning: 'Experienced backup' }
  ],
  
  // WR committee situations
  'Cooper Kupp': [
    { name: 'Puka Nacua', type: 'Committee', priority: 'High', reasoning: 'Co-alpha receiver when both healthy' },
    { name: 'Tutu Atwell', type: 'Insurance', priority: 'Low', reasoning: 'Speed option behind top 2' }
  ],
  'Tyreek Hill': [
    { name: 'Jaylen Waddle', type: 'Committee', priority: 'High', reasoning: 'Co-alpha in same offense' },
    { name: 'Odell Beckham Jr.', type: 'Insurance', priority: 'Medium', reasoning: 'Veteran depth option' }
  ],
  
  // TE situations
  'Travis Kelce': [
    { name: 'Noah Gray', type: 'Direct', priority: 'Low', reasoning: 'Primary backup tight end' }
  ],
  'Mark Andrews': [
    { name: 'Isaiah Likely', type: 'Direct', priority: 'Medium', reasoning: 'Talented backup with standalone value' }
  ]
};

export const generateHandcuffRecommendations = (
  draftedPlayers: Player[],
  availablePlayers: Player[],
  userTeamId: string
): HandcuffRecommendation[] => {
  const userDraftedPlayers = draftedPlayers.filter(p => p.draftedBy === userTeamId);
  const recommendations: HandcuffRecommendation[] = [];

  userDraftedPlayers.forEach(primaryPlayer => {
    const handcuffData = HANDCUFF_MAPPINGS[primaryPlayer.name];
    if (!handcuffData) return;

    const availableHandcuffs = handcuffData
      .map(handcuffInfo => {
        const handcuffPlayer = availablePlayers.find(p => 
          p.name.toLowerCase().includes(handcuffInfo.name.toLowerCase()) ||
          handcuffInfo.name.toLowerCase().includes(p.name.toLowerCase())
        );
        
        if (!handcuffPlayer) return null;
        
        return {
          player: handcuffPlayer,
          type: handcuffInfo.type,
          priority: handcuffInfo.priority,
          reasoning: handcuffInfo.reasoning
        };
      })
      .filter(Boolean) as HandcuffRecommendation['handcuffs'];

    if (availableHandcuffs.length > 0) {
      recommendations.push({
        primaryPlayer,
        handcuffs: availableHandcuffs.sort((a, b) => {
          const priorityOrder = { 'High': 3, 'Medium': 2, 'Low': 1 };
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        })
      });
    }
  });

  return recommendations.sort((a, b) => {
    // Sort by highest priority handcuff available
    const aMaxPriority = Math.max(...a.handcuffs.map(h => h.priority === 'High' ? 3 : h.priority === 'Medium' ? 2 : 1));
    const bMaxPriority = Math.max(...b.handcuffs.map(h => h.priority === 'High' ? 3 : h.priority === 'Medium' ? 2 : 1));
    return bMaxPriority - aMaxPriority;
  });
};

export const getPositionHandcuffs = (position: Position, availablePlayers: Player[]): Player[] => {
  // Get general handcuff candidates by position for committee backfields
  const positionPlayers = availablePlayers.filter(p => p.position === position);
  
  switch (position) {
    case 'RB':
      // Look for RBs in committees or timeshares
      return positionPlayers.filter(p => 
        p.name.includes('Roschon Johnson') || // Bears committee
        p.name.includes('Ty Chandler') ||     // Vikings backup
        p.name.includes('Antonio Gibson') ||   // Patriots committee
        p.name.includes('Damien Harris') ||    // Various teams
        p.adp > 100 && p.tier <= 6  // Late round RBs with upside
      );
    
    case 'WR':
      // Target WRs in high-volume offenses
      return positionPlayers.filter(p => 
        ['KC', 'BUF', 'MIA', 'LAR', 'CIN'].includes(p.team) &&
        p.adp > 80 && p.tier <= 7
      );
    
    case 'TE':
      // Backup TEs with upside
      return positionPlayers.filter(p =>
        p.adp > 120 && p.tier <= 5
      );
    
    default:
      return [];
  }
};