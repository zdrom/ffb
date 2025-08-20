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
      
      // Console log the prompt for review
      console.group('🤖 AI Prompt Being Sent:');
      console.log(prompt);
      console.groupEnd();
      
      const providerConfig: AIProviderConfig = {
        apiKey: this.config.apiKey,
        model: this.config.model,
        baseURL: this.config.baseURL,
        timeout: this.config.timeout || 15000
      };

      const rawResponse = await this.provider.generateCompletion(prompt, providerConfig);
      
      // Console log the raw response for review
      console.group('🤖 AI Raw Response:');
      console.log(rawResponse);
      console.groupEnd();
      
      const parsedResponse = this.parseAndValidateResponse(rawResponse);
      
      return parsedResponse;
    } catch (error) {
      console.error('AI Strategy generation failed:', error);
      throw new Error(`AI Strategy failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private buildPrompt(input: AIStrategyInput): string {
    const { 
      candidates,
      userTeam, 
      draftState, 
      picksUntilMyTurn,
      tierCountsRemaining,
      opponentWindows,
      positionAlerts,
      playstyle,
      scoringWeights,
      kDefWindow 
    } = input;

    // Analyze roster needs
    const rosterNeeds = this.analyzeRosterNeeds(userTeam, draftState.settings);
    
    // Minify data for compact prompt
    const myRosterMin = Object.entries(userTeam.roster)
      .filter(([_, players]) => players.length > 0)
      .map(([pos, players]) => `${pos}:${players.length}`)
      .join(' ');
    
    const needsSummary = rosterNeeds.join(', ') || 'None critical';
    
    const structuralPrefsMin = JSON.stringify({
      QB: 1, RB: 3, WR: 4, TE: 2, K: 1, DEF: 1 // Default structural targets
    });
    
    const tierCountsMin = JSON.stringify(tierCountsRemaining);
    
    const positionAlertsMin = positionAlerts?.join('; ') || 'None';
    
    const opponentWindowsMin = opponentWindows?.map(w => 
      `${w.team}:${w.picksBeforeMe}picks,needs:${w.needs.slice(0,2).join(',')}`
    ).join(' | ') || 'None';
    
    const candidatesJsonMin = JSON.stringify(candidates.slice(0, 20)); // Top 20 only
    
    const minifiedRosterSlots = Object.entries(draftState.settings.rosterSlots)
      .map(([pos, count]) => `${pos}:${count}`)
      .join(' ');

    const prompt = `FANTASY DRAFT ANALYSIS
Pick: ${draftState.currentPick} | Picks until my turn: ${picksUntilMyTurn}
League: ${draftState.settings.scoringType || 'Standard'} | Draft: Snake | Slots: ${minifiedRosterSlots}

HARD CONSTRAINTS
- Recommend EXACTLY 3 players.
- Never suggest taken players or exceed roster limits.
- Priority: VORP > positional need/scarcity > ADP value > stack > bye balance > risk preference.
- If any input missing, add to "warnings" and proceed.

MY TEAM
- Roster: ${myRosterMin}
- Needs: ${needsSummary}
- Playstyle: ${playstyle} | Structural targets: ${structuralPrefsMin}
- Existing stacks: QB-WR:0 QB-TE:0

MARKET SNAPSHOT
- Tier counts remaining: ${tierCountsMin}
- Position alerts: ${positionAlertsMin}
- Opponent windows (before my next pick): ${opponentWindowsMin}

CANDIDATES (top ~20)
${candidatesJsonMin}

SCORING GUIDANCE (0..1 weights)
w_vorp=${scoringWeights?.w_vorp} w_need=${scoringWeights?.w_need} w_adp=${scoringWeights?.w_adp} w_stack=${scoringWeights?.w_stack} w_bye=${scoringWeights?.w_bye} w_risk=${scoringWeights?.w_risk} w_snipe=${scoringWeights?.w_snipe}

HEURISTICS
- urgency = High if p_available_next_pick < 0.30 OR tier_cliff_pressure(pos) >= 0.7; Medium if < 0.60 or cliff >= 0.4; else Low
- confidence is the normalized margin between the chosen player's composite score and the best non-selected alternative (typically rank #4), truncated to [0,1]
- adp_delta = adp - currentPick (negative = reach)
- If any of (tier, adp, p_available_next_pick) is missing, keep recommendation but add an item to "warnings"
- Do NOT invent data. If a field is missing, mention it in "warnings" and proceed
- K/DEF only if picksUntilMyTurn < ${kDefWindow} AND needs satisfied

TIE-BREAKERS (apply only if composites within 2%):
1) Roster fit vs structural targets
2) ADP value
3) Stack equity
4) Bye diversity
5) Risk aligned to playstyle

OUTPUT JSON (STRICT):
{
  "topRecommendations": [
    {
      "playerId": "string",
      "playerName": "string",
      "position": "QB|RB|WR|TE|K|DEF",
      "team": "string",
      "vorp": number,
      "tier": number,
      "adp": number,
      "adpDelta": number,
      "pAvailableNextPick": 0.0-1.0,
      "urgency": "High|Medium|Low",
      "confidence": 0.0-1.0,
      "explanation": "≤100 chars",
      "scoreBreakdown": {
        "vorp": number,
        "need": number,
        "adpValue": number,
        "stack": number,
        "bye": number,
        "risk": number,
        "snipe": number
      },
      "tieBreakersApplied": [ "RosterFit" | "ADPValue" | "StackEquity" | "ByeDiversity" | "RiskProfile" ],
      "strategicReasoning": {
        "rosterFit": "≤50 chars",
        "positionalScarcity": "≤50 chars",
        "opponentImpact": "≤50 chars",
        "futureFlexibility": "≤50 chars",
        "opportunityCost": 0.0-1.0
      }
    }
  ],
  "whatIfPass": {
    "likelyAvailableNextPick": [ "playerId", "playerId" ],
    "risks": [ "string" ],
    "notes": "≤120 chars"
  },
  "warnings": [ "string" ],
  "timestamp": ${Date.now()},
  "confidence": 0.0-1.0,
  "summary": "≤150 chars"
}

Return STRICT JSON only. No backticks, no markdown, no commentary.`;

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
      // Parse pure JSON (no code fence stripping needed with strict JSON mode)
      const parsed = JSON.parse(rawResponse.trim());
      
      // Validate with Zod schema
      const validated = AIStrategyResponseSchema.parse(parsed);
      
      // Normalize urgency using explicit heuristics if model deviates
      validated.topRecommendations.forEach(rec => {
        if (rec.pAvailableNextPick !== undefined) {
          const tierCliffPressure = 0.5; // Default - could calculate from input if available
          
          // Apply explicit urgency thresholds as defined in requirements
          if (rec.pAvailableNextPick < 0.30 || tierCliffPressure >= 0.7) {
            if (rec.urgency !== 'High') {
              console.warn(`Correcting urgency to High for ${rec.playerName} (p_available=${rec.pAvailableNextPick})`);
              rec.urgency = 'High';
            }
          } else if (rec.pAvailableNextPick < 0.60 || tierCliffPressure >= 0.4) {
            if (rec.urgency !== 'Medium' && rec.urgency !== 'High') {
              console.warn(`Correcting urgency to Medium for ${rec.playerName} (p_available=${rec.pAvailableNextPick})`);
              rec.urgency = 'Medium';
            }
          } else {
            if (rec.urgency !== 'Low' && rec.urgency !== 'Medium' && rec.urgency !== 'High') {
              console.warn(`Correcting urgency to Low for ${rec.playerName} (p_available=${rec.pAvailableNextPick})`);
              rec.urgency = 'Low';
            }
          }
        }
      });
      
      return validated;
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