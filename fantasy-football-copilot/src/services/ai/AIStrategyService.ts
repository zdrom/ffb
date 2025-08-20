import type { 
  AIServiceConfig, 
  AIStrategyInput, 
  AIStrategyResponse,
  AIProviderConfig 
} from '../../types/ai';
import type { Player, Position, DraftSettings } from '../../types';
import { AIStrategyResponseSchema } from '../../types/ai';
import { createAIProvider } from './providers';
import { DynamicVORPEngine } from '../../utils/dynamicVORP';
import { calculateReachProbability } from '../../utils/reachProbability';

export class AIStrategyService {
  private config: AIServiceConfig;
  private provider;
  
  constructor(config: AIServiceConfig) {
    this.config = config;
    const providerName = config.provider === 'openai' ? 'openai' : 'openai'; // Default to openai for now
    this.provider = createAIProvider(providerName);
  }

  async generateStrategy(input: AIStrategyInput): Promise<AIStrategyResponse> {
    try {
      const prompt = this.buildPrompt(input);
      
      const providerConfig: AIProviderConfig = {
        apiKey: this.config.apiKey,
        model: this.config.model,
        baseURL: this.config.baseURL,
        timeout: this.config.timeout || 15000
      };

      const rawResponse = await this.provider.generateCompletion(prompt, providerConfig);
      const parsedResponse = this.parseAndValidateResponse(rawResponse);
      
      return parsedResponse;
    } catch (error) {
      console.error('AI Strategy generation failed:', error);
      throw new Error(`AI Strategy failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private buildPrompt(input: AIStrategyInput): string {
    const { availablePlayers, userTeam, draftState, picksUntilMyTurn, vorpData } = input;
    
    // Get top 20 players by VORP for context
    const topPlayers = availablePlayers
      .filter(p => !p.isDrafted && !p.isDoNotDraft)
      .map(p => {
        const vorp = vorpData.find(v => v.playerId === p.id);
        return { ...p, vorpValue: vorp?.vorp || 0 };
      })
      .sort((a, b) => b.vorpValue - a.vorpValue)
      .slice(0, 20);

    // Analyze roster needs
    const rosterNeeds = this.analyzeRosterNeeds(userTeam, draftState.settings);
    
    // Calculate position scarcity
    const positionScarcity = this.calculatePositionScarcity(availablePlayers);

    const prompt = `Draft Analysis Request:

CURRENT SITUATION:
- Pick ${draftState.currentPick} of ${draftState.settings.numberOfTeams * draftState.settings.numberOfRounds}
- Picks until my turn: ${picksUntilMyTurn}
- Draft position: ${draftState.settings.draftSlot}/${draftState.settings.numberOfTeams}

USER ROSTER:
${Object.entries(userTeam.roster).map(([pos, players]) => 
  `${pos}: ${players.map(p => p.name).join(', ') || 'Empty'}`
).join('\n')}

ROSTER NEEDS: ${rosterNeeds.join(', ')}

TOP AVAILABLE PLAYERS (by VORP):
${topPlayers.slice(0, 10).map(p => 
  `${p.name} (${p.position}) - VORP: ${p.vorpValue.toFixed(1)}, ADP: ${p.adp}`
).join('\n')}

POSITION SCARCITY:
${Object.entries(positionScarcity).map(([pos, data]) => 
  `${pos}: ${data.available} available, ${data.quality} quality`
).join('\n')}

USER PREFERENCES:
- Risk Tolerance: ${this.config.userPreferences?.riskTolerance || 'Balanced'}
- Prioritize VORP: ${this.config.userPreferences?.prioritizeVORP || true}
- Stacking Preference: ${this.config.userPreferences?.stackingPreference || false}

CONSTRAINTS:
- Do not recommend drafted players
- Respect position limits
- Explanations ≤35 words
- Prioritize: VORP → positional need → ADP value → stacking → bye balance

Provide a JSON response with exactly this structure:
{
  "topRecommendations": [
    {
      "playerId": "string",
      "playerName": "string", 
      "position": "QB|RB|WR|TE|K|DEF",
      "vorp": number,
      "explanation": "≤35 words explaining why this pick makes sense",
      "confidence": 0.0-1.0,
      "urgency": "High|Medium|Low"
    }
  ],
  "whatIfForesight": {
    "nextPickProbabilities": [
      {
        "playerId": "string",
        "playerName": "string",
        "position": "QB|RB|WR|TE|K|DEF", 
        "availabilityProbability": 0.0-1.0,
        "explanation": "≤35 words"
      }
    ],
    "recommendedStrategy": "Wait|Draft_Now|Consider_Alternatives",
    "strategyExplanation": "≤35 words"
  },
  "rosterBalance": {
    "positionNeeds": [
      {
        "position": "QB|RB|WR|TE|K|DEF",
        "urgency": "Critical|High|Medium|Low", 
        "explanation": "≤35 words"
      }
    ],
    "tierAlerts": [
      {
        "position": "QB|RB|WR|TE|K|DEF",
        "tier": number,
        "playersRemaining": number,
        "isCliff": boolean,
        "explanation": "≤35 words"
      }
    ],
    "byeWeekConcerns": [
      {
        "week": number,
        "affectedPositions": ["QB|RB|WR|TE|K|DEF"],
        "severity": "High|Medium|Low"
      }
    ]
  },
  "targetAlerts": {
    "lastChanceTargets": [
      {
        "playerId": "string", 
        "playerName": "string",
        "position": "QB|RB|WR|TE|K|DEF",
        "roundsLeft": number,
        "explanation": "≤35 words",
        "priority": "Must_Draft|High|Medium"
      }
    ],
    "stackingOpportunities": [
      {
        "primaryPlayerId": "string",
        "stackPlayerId": "string", 
        "stackType": "QB_WR|QB_TE|RB_DEF",
        "explanation": "≤35 words",
        "value": 0.0-1.0
      }
    ]
  },
  "timestamp": ${Date.now()},
  "confidence": 0.0-1.0
}`;

    return prompt;
  }

  private analyzeRosterNeeds(userTeam: any, settings: DraftSettings): Position[] {
    const needs: Position[] = [];
    const roster = userTeam.roster;
    const slots = settings.rosterSlots;

    Object.entries(slots).forEach(([position, requiredCount]) => {
      if (position === 'W/R/T' || position === 'FLEX' || position === 'SUPERFLEX') return;
      
      const currentCount = roster[position as Position]?.length || 0;
      if (currentCount < requiredCount) {
        needs.push(position as Position);
      }
    });

    return needs;
  }

  private calculatePositionScarcity(players: Player[]): Record<Position, { available: number; quality: number }> {
    const positions: Position[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
    const scarcity: Record<Position, { available: number; quality: number }> = {} as any;

    positions.forEach(pos => {
      const posPlayers = players.filter(p => p.position === pos && !p.isDrafted && !p.isDoNotDraft);
      const qualityPlayers = posPlayers.filter(p => p.tier <= 3).length;
      
      scarcity[pos] = {
        available: posPlayers.length,
        quality: qualityPlayers
      };
    });

    return scarcity;
  }

  private parseAndValidateResponse(rawResponse: string): AIStrategyResponse {
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = rawResponse.match(/```json\n([\s\S]*?)\n```/) || 
                       rawResponse.match(/```\n([\s\S]*?)\n```/) ||
                       [null, rawResponse];
      
      const jsonStr = jsonMatch[1] || rawResponse;
      const parsed = JSON.parse(jsonStr.trim());
      
      return AIStrategyResponseSchema.parse(parsed);
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      console.error('Raw response:', rawResponse);
      throw new Error(`Invalid AI response format: ${error instanceof Error ? error.message : 'Parse error'}`);
    }
  }

  // Utility method to check if API key is configured
  static isConfigured(config?: Partial<AIServiceConfig>): boolean {
    return Boolean(
      config?.apiKey || 
      import.meta.env.VITE_OPENAI_API_KEY || 
      (typeof process !== 'undefined' && process.env?.OPENAI_API_KEY)
    );
  }

  // Create default service instance
  static createDefault(): AIStrategyService | null {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY || 
                   (typeof process !== 'undefined' && process.env?.OPENAI_API_KEY);
    if (!apiKey) {
      console.warn('OPENAI_API_KEY not found in environment variables');
      return null;
    }

    return new AIStrategyService({
      provider: 'openai',
      apiKey,
      model: import.meta.env.VITE_OPENAI_MODEL || 
             (typeof process !== 'undefined' && process.env?.OPENAI_MODEL) || 
             'gpt-4o-mini',
      baseURL: import.meta.env.VITE_OPENAI_BASE_URL || 
               (typeof process !== 'undefined' && process.env?.OPENAI_BASE_URL),
      timeout: parseInt(
        import.meta.env.VITE_OPENAI_TIMEOUT || 
        (typeof process !== 'undefined' && process.env?.OPENAI_TIMEOUT) || 
        '15000'
      ),
      userPreferences: {
        riskTolerance: 'Balanced',
        prioritizeVORP: true,
        stackingPreference: false,
        byeWeekAwareness: true
      }
    });
  }
}