import type { Player, Team, DraftSettings, Position, DraftPick } from '../types';
import { DynamicVORPEngine } from '../utils/dynamicVORP';

export interface AIRecommendationContext {
  userTeam: Team;
  allTeams: Team[];
  availablePlayers: Player[];
  topVORPPlayers: Array<{ player: Player; vorp: number }>;
  settings: DraftSettings;
  currentPick: number;
  recentPicks: DraftPick[];
  positionScarcity: Record<Position, {
    available: number;
    averageVORP: number;
    scarcityLevel: 'Low' | 'Medium' | 'High';
  }>;
  competitorAnalysis: Array<{
    team: Team;
    likelyTargets: Position[];
    urgentNeeds: Position[];
  }>;
}

export interface AIRecommendation {
  recommendedPlayer: Player;
  confidence: number; // 0-100
  reasoning: string;
  alternativeOptions: Array<{
    player: Player;
    reason: string;
  }>;
  strategicNote: string;
  urgency: 'Low' | 'Medium' | 'High' | 'Critical';
}

export class AIRecommendationService {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl: string = 'https://api.openai.com/v1') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async getRecommendation(context: AIRecommendationContext): Promise<AIRecommendation> {
    try {
      const prompt = this.buildPrompt(context);
      
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: this.getSystemPrompt()
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.3, // Lower temperature for more consistent recommendations
          max_tokens: 800
        })
      });

      if (!response.ok) {
        throw new Error(`AI API request failed: ${response.statusText}`);
      }

      const data = await response.json();
      const aiResponse = data.choices[0].message.content;
      
      return this.parseAIResponse(aiResponse, context);
    } catch (error) {
      console.error('AI Recommendation Service Error:', error);
      // Fallback to top VORP player
      return this.getFallbackRecommendation(context);
    }
  }

  private getSystemPrompt(): string {
    return `You are an elite fantasy football draft advisor. Your recommendations should:

1. HEAVILY FAVOR VORP (Value Over Replacement Player) as the primary metric
2. Consider positional scarcity and availability
3. Analyze other teams' rosters and likely next picks
4. Factor in draft position strategy (early/mid/late round considerations)
5. Account for bye week conflicts and injury risks
6. Provide clear, actionable reasoning

CRITICAL RULE: You MUST only recommend players from the "AVAILABLE PLAYERS" list provided. Do NOT recommend any player who is not explicitly listed as available.

Always respond in this JSON format:
{
  "recommendedPlayer": "Exact Player Name From Available List",
  "confidence": 85,
  "reasoning": "Clear explanation favoring VORP with context",
  "alternativeOptions": [
    {"player": "Alt Player 1 From Available List", "reason": "Why this could work"},
    {"player": "Alt Player 2 From Available List", "reason": "Contrarian pick explanation"}
  ],
  "strategicNote": "Broader strategy insight",
  "urgency": "High"
}

Use EXACT player names from the available players list. Be decisive but explain trade-offs. Favor proven production and VORP over hype.`;
  }

  private buildPrompt(context: AIRecommendationContext): string {
    const { userTeam, allTeams, topVORPPlayers, settings, currentPick, positionScarcity, competitorAnalysis } = context;

    // Build roster summary
    const userRosterSummary = this.summarizeRoster(userTeam);
    const competitorRosters = allTeams.filter(t => !t.isUser).map(team => ({
      name: team.name,
      roster: this.summarizeRoster(team),
      needs: this.identifyTeamNeeds(team, settings)
    }));

    // Top VORP players summary
    const topPlayers = topVORPPlayers.slice(0, 15).map(({ player, vorp }) => 
      `${player.name} (${player.position}) - VORP: ${vorp.toFixed(1)}`
    ).join('\n');

    // Position scarcity summary
    const scarcitySummary = Object.entries(positionScarcity)
      .map(([pos, data]) => `${pos}: ${data.available} available, avg VORP ${data.averageVORP.toFixed(1)}, ${data.scarcityLevel} scarcity`)
      .join('\n');

    return `FANTASY DRAFT SITUATION ANALYSIS

CURRENT PICK: ${currentPick} (Round ${Math.ceil(currentPick / settings.numberOfTeams)})
DRAFT POSITION: ${settings.draftSlot}/${settings.numberOfTeams}
LEAGUE: ${settings.scoringType}, ${settings.numberOfTeams} teams

MY CURRENT ROSTER:
${userRosterSummary}

ROSTER SLOTS NEEDED:
${Object.entries(settings.rosterSlots).map(([pos, count]) => 
  `${pos}: ${count} required (${userTeam.roster[pos as Position]?.length || 0} drafted)`
).join('\n')}

*** IMPORTANT: ONLY RECOMMEND FROM THE FOLLOWING AVAILABLE PLAYERS ***
TOP 15 AVAILABLE (UNDRAFTED) PLAYERS BY VORP:
${topPlayers}

POSITION SCARCITY ANALYSIS:
${scarcitySummary}

OTHER TEAMS' SITUATIONS:
${competitorRosters.map(team => 
  `${team.name}: ${team.roster} | Likely needs: ${team.needs.join(', ')}`
).join('\n')}

COMPETITOR PICK PREDICTIONS:
${competitorAnalysis.map(comp => 
  `${comp.team.name}: Urgent needs [${comp.urgentNeeds.join(', ')}], Likely targets [${comp.likelyTargets.join(', ')}]`
).join('\n')}

Please analyze this situation and recommend the optimal pick. Remember:
- VORP should be the PRIMARY factor in your decision
- Consider what positions/players others might target before my next pick
- Account for positional scarcity and my team's needs
- Explain opportunity cost of waiting vs. acting now
- Be specific about why this player over others`;
  }

  private summarizeRoster(team: Team): string {
    const positions: Position[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
    return positions.map(pos => {
      const players = team.roster[pos] || [];
      if (players.length === 0) return `${pos}: None`;
      return `${pos}: ${players.map(p => p.name).join(', ')}`;
    }).join(' | ');
  }

  private identifyTeamNeeds(team: Team, settings: DraftSettings): Position[] {
    const needs: Position[] = [];
    const positions: Position[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
    
    positions.forEach(pos => {
      const current = team.roster[pos]?.length || 0;
      const required = settings.rosterSlots[pos];
      if (current < required) {
        needs.push(pos);
      }
    });
    
    return needs;
  }

  private parseAIResponse(aiResponse: string, context: AIRecommendationContext): AIRecommendation {
    try {
      // Extract JSON from AI response
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      // Debug logging
      console.log('AI Response parsed:', parsed);
      console.log('Available players count:', context.availablePlayers.length);
      console.log('Looking for player:', parsed.recommendedPlayer);
      
      // Find the recommended player with more flexible matching
      const recommendedPlayer = context.availablePlayers.find(p => {
        const playerNameLower = p.name.toLowerCase().trim();
        const recommendedNameLower = parsed.recommendedPlayer.toLowerCase().trim();
        
        // Try exact match first
        if (playerNameLower === recommendedNameLower) return true;
        
        // Try partial matches
        if (playerNameLower.includes(recommendedNameLower) || 
            recommendedNameLower.includes(playerNameLower)) return true;
        
        // Try last name only match (in case AI uses just last name)
        const playerLastName = playerNameLower.split(' ').pop() || '';
        const recommendedLastName = recommendedNameLower.split(' ').pop() || '';
        if (playerLastName && recommendedLastName && 
            playerLastName === recommendedLastName && 
            playerLastName.length > 3) return true;
        
        return false;
      });

      console.log('Found recommended player:', recommendedPlayer?.name);

      if (!recommendedPlayer) {
        console.error('Available players:', context.availablePlayers.map(p => p.name).slice(0, 10));
        throw new Error(`Recommended player "${parsed.recommendedPlayer}" not found in available players`);
      }

      // Verify the player is actually available (double-check)
      if (recommendedPlayer.isDrafted) {
        console.error('AI recommended a drafted player:', recommendedPlayer.name);
        throw new Error(`Recommended player ${recommendedPlayer.name} is already drafted`);
      }

      // Find alternative players with same improved matching
      const alternativeOptions = parsed.alternativeOptions?.map((alt: any) => {
        const altPlayer = context.availablePlayers.find(p => {
          const playerNameLower = p.name.toLowerCase().trim();
          const altNameLower = alt.player.toLowerCase().trim();
          
          return playerNameLower === altNameLower ||
                 playerNameLower.includes(altNameLower) || 
                 altNameLower.includes(playerNameLower) ||
                 (playerNameLower.split(' ').pop() === altNameLower.split(' ').pop() && 
                  altNameLower.split(' ').pop()!.length > 3);
        });
        return altPlayer && !altPlayer.isDrafted ? { player: altPlayer, reason: alt.reason } : null;
      }).filter(Boolean) || [];

      return {
        recommendedPlayer,
        confidence: Math.max(0, Math.min(100, parsed.confidence || 75)),
        reasoning: parsed.reasoning || 'AI recommendation based on VORP and context analysis',
        alternativeOptions,
        strategicNote: parsed.strategicNote || 'Consider long-term team building strategy',
        urgency: parsed.urgency || 'Medium'
      };
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      return this.getFallbackRecommendation(context);
    }
  }

  private getFallbackRecommendation(context: AIRecommendationContext): AIRecommendation {
    // Fallback to highest VORP player if AI fails
    const topPlayer = context.topVORPPlayers[0];
    
    return {
      recommendedPlayer: topPlayer.player,
      confidence: 75,
      reasoning: `Highest VORP available (${topPlayer.vorp.toFixed(1)}). AI service unavailable - using pure VORP ranking.`,
      alternativeOptions: context.topVORPPlayers.slice(1, 3).map(({ player }) => ({
        player,
        reason: `Next highest VORP option at ${player.position}`
      })),
      strategicNote: 'Using fallback VORP-only recommendation. Consider position needs and scarcity.',
      urgency: 'Medium'
    };
  }
}

// Factory function to create service with API key from environment
export function createAIRecommendationService(apiKey?: string): AIRecommendationService | null {
  if (!apiKey) {
    console.warn('No AI API key provided - AI recommendations disabled');
    return null;
  }
  
  return new AIRecommendationService(apiKey);
}