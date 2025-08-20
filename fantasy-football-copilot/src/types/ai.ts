import { z } from 'zod';
import type { Player, Position, DraftState, Team } from './index';

// AI Provider Configuration
export interface AIProviderConfig {
  apiKey: string;
  baseURL?: string;
  model?: string;
  timeout?: number;
}

export interface AIProvider {
  name: string;
  generateCompletion(prompt: string, config: AIProviderConfig): Promise<string>;
}

// Enhanced candidate feature structure
export interface CandidateFeature {
  id: string;
  name: string;
  pos: "QB" | "RB" | "WR" | "TE" | "K" | "DEF";
  team?: string;
  bye?: number;
  vorp: number;
  tier?: number;                 // 1..n
  adp?: number;                  // market ADP
  adp_delta?: number;            // adp - currentPick
  stack_bonus?: number;          // 0..1 (calc from my roster)
  risk?: number;                 // 0..1
  p_available_next_pick?: number;// 0..1 (from quick sim or heuristic)
}

// Enhanced AI Strategy Input
export interface AIStrategyInput {
  availablePlayers: Player[];
  userTeam: Team;
  allTeams: Team[];
  draftState: DraftState;
  picksUntilMyTurn: number;
  
  // Enhanced features
  candidates: CandidateFeature[];
  tierCountsRemaining: Record<string, Record<number, number>>; // pos → tier → remaining
  
  // Playstyle and preferences
  playstyle: "ceiling" | "floor" | "value" | "structural";
  structuralPrefs?: Record<string, number>; // desired counts per position
  kDefWindow?: number; // default 12
  
  // Enhanced opponent analysis
  opponentWindows?: {
    team: string;
    picksBeforeMe: number;
    needs: Position[];
    stacksInProgress?: string[]; // position pairs like "QB-WR"
  }[];
  
  // Position alerts and scoring weights
  positionAlerts?: string[]; // e.g., "TE: Tier-2 nearly empty"
  scoringWeights?: {
    w_vorp: number;
    w_need: number;
    w_adp: number;
    w_stack: number;
    w_bye: number;
    w_risk: number;
    w_snipe: number;
  };
}

// Schema Definitions
export const PickRecommendationSchema = z.object({
  playerId: z.string(),
  playerName: z.string(),
  position: z.enum(['QB', 'RB', 'WR', 'TE', 'K', 'DEF']),
  team: z.string().optional(),
  vorp: z.number(),
  tier: z.number().optional(),
  adp: z.number().optional(),
  adpDelta: z.number(), // adp - currentPick (negative = reach)
  pAvailableNextPick: z.number().min(0).max(1).optional(),
  urgency: z.enum(['High', 'Medium', 'Low']),
  confidence: z.number().min(0).max(1),
  explanation: z.string().max(100),
  scoreBreakdown: z.object({
    vorp: z.number().min(0).max(1),
    need: z.number().min(0).max(1),
    adpValue: z.number().min(0).max(1),
    stack: z.number().min(0).max(1),
    bye: z.number().min(0).max(1),
    risk: z.number().min(0).max(1),
    snipe: z.number().min(0).max(1)
  }),
  tieBreakersApplied: z.array(z.enum(['RosterFit', 'ADPValue', 'StackEquity', 'ByeDiversity', 'RiskProfile'])),
  // Enhanced strategic reasoning
  strategicReasoning: z.object({
    rosterFit: z.string().max(50), // How this fills a roster need
    positionalScarcity: z.string().max(50), // Scarcity vs depth at position
    opponentImpact: z.string().max(50), // How this affects opponents
    futureFlexibility: z.string().max(50), // How this sets up future picks
    opportunityCost: z.number().min(0).max(1) // 0=low cost, 1=high cost to wait
  })
});

export const WhatIfForesightSchema = z.object({
  nextPickProbabilities: z.array(z.object({
    playerId: z.string(),
    playerName: z.string(),
    position: z.enum(['QB', 'RB', 'WR', 'TE', 'K', 'DEF']),
    availabilityProbability: z.number().min(0).max(1),
    explanation: z.string().max(100)
  })),
  recommendedStrategy: z.enum(['Wait', 'Draft_Now', 'Consider_Alternatives']),
  strategyExplanation: z.string().max(100)
});

export const RosterBalanceGuidanceSchema = z.object({
  positionNeeds: z.array(z.object({
    position: z.enum(['QB', 'RB', 'WR', 'TE', 'K', 'DEF']),
    urgency: z.enum(['Critical', 'High', 'Medium', 'Low']),
    explanation: z.string().max(100)
  })),
  tierAlerts: z.array(z.object({
    position: z.enum(['QB', 'RB', 'WR', 'TE', 'K', 'DEF']),
    tier: z.number(),
    playersRemaining: z.number(),
    isCliff: z.boolean(),
    explanation: z.string().max(100)
  })),
  byeWeekConcerns: z.array(z.object({
    week: z.number(),
    affectedPositions: z.array(z.enum(['QB', 'RB', 'WR', 'TE', 'K', 'DEF'])),
    severity: z.enum(['High', 'Medium', 'Low'])
  }))
});

export const TargetAlertSchema = z.object({
  lastChanceTargets: z.array(z.object({
    playerId: z.string(),
    playerName: z.string(),
    position: z.enum(['QB', 'RB', 'WR', 'TE', 'K', 'DEF']),
    roundsLeft: z.number(),
    explanation: z.string().max(100),
    priority: z.enum(['Must_Draft', 'High', 'Medium'])
  })),
  stackingOpportunities: z.array(z.object({
    primaryPlayerId: z.string(),
    stackPlayerId: z.string(),
    stackType: z.enum(['QB_WR', 'QB_TE', 'RB_DEF']),
    explanation: z.string().max(100),
    value: z.number().min(0).max(1)
  }))
});

export const WhatIfPassSchema = z.object({
  likelyAvailableNextPick: z.array(z.string()), // playerIds
  risks: z.array(z.string()), // e.g., "TE Tier-1 likely gone"
  notes: z.string().max(120)
});

export const AIStrategyResponseSchema = z.object({
  topRecommendations: z.array(PickRecommendationSchema).max(3).min(1),
  whatIfPass: WhatIfPassSchema,
  warnings: z.array(z.string()).optional(),
  timestamp: z.number(),
  confidence: z.number().min(0).max(1),
  summary: z.string().max(150).optional() // Brief strategic summary
});

// Exported Types
export type PickRecommendation = z.infer<typeof PickRecommendationSchema>;
export type WhatIfPass = z.infer<typeof WhatIfPassSchema>;
export type WhatIfForesight = z.infer<typeof WhatIfForesightSchema>;
export type RosterBalanceGuidance = z.infer<typeof RosterBalanceGuidanceSchema>;
export type TargetAlert = z.infer<typeof TargetAlertSchema>;
export type AIStrategyResponse = z.infer<typeof AIStrategyResponseSchema>;

// AI Service Configuration
export interface AIServiceConfig {
  provider: 'openai' | 'anthropic' | 'custom';
  apiKey: string;
  model?: string;
  baseURL?: string;
  timeout?: number;
  userPreferences?: {
    riskTolerance: 'Conservative' | 'Balanced' | 'Aggressive';
    prioritizeVORP: boolean;
    stackingPreference: boolean;
    byeWeekAwareness: boolean;
  };
}