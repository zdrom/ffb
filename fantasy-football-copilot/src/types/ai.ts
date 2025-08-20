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

// Core AI Strategy Input
export interface AIStrategyInput {
  availablePlayers: Player[];
  userTeam: Team;
  allTeams: Team[];
  draftState: DraftState;
  picksUntilMyTurn: number;
  probabilities?: Record<string, number>; // Player ID -> probability of being available
  vorpData: {
    playerId: string;
    vorp: number;
    position: Position;
    scarcityMultiplier: number;
  }[];
}

// Schema Definitions
export const PickRecommendationSchema = z.object({
  playerId: z.string(),
  playerName: z.string(),
  position: z.enum(['QB', 'RB', 'WR', 'TE', 'K', 'DEF']),
  vorp: z.number(),
  explanation: z.string().max(35),
  confidence: z.number().min(0).max(1),
  urgency: z.enum(['High', 'Medium', 'Low'])
});

export const WhatIfForesightSchema = z.object({
  nextPickProbabilities: z.array(z.object({
    playerId: z.string(),
    playerName: z.string(),
    position: z.enum(['QB', 'RB', 'WR', 'TE', 'K', 'DEF']),
    availabilityProbability: z.number().min(0).max(1),
    explanation: z.string().max(35)
  })),
  recommendedStrategy: z.enum(['Wait', 'Draft_Now', 'Consider_Alternatives']),
  strategyExplanation: z.string().max(35)
});

export const RosterBalanceGuidanceSchema = z.object({
  positionNeeds: z.array(z.object({
    position: z.enum(['QB', 'RB', 'WR', 'TE', 'K', 'DEF']),
    urgency: z.enum(['Critical', 'High', 'Medium', 'Low']),
    explanation: z.string().max(35)
  })),
  tierAlerts: z.array(z.object({
    position: z.enum(['QB', 'RB', 'WR', 'TE', 'K', 'DEF']),
    tier: z.number(),
    playersRemaining: z.number(),
    isCliff: z.boolean(),
    explanation: z.string().max(35)
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
    explanation: z.string().max(35),
    priority: z.enum(['Must_Draft', 'High', 'Medium'])
  })),
  stackingOpportunities: z.array(z.object({
    primaryPlayerId: z.string(),
    stackPlayerId: z.string(),
    stackType: z.enum(['QB_WR', 'QB_TE', 'RB_DEF']),
    explanation: z.string().max(35),
    value: z.number().min(0).max(1)
  }))
});

export const AIStrategyResponseSchema = z.object({
  topRecommendations: z.array(PickRecommendationSchema).max(5),
  whatIfForesight: WhatIfForesightSchema,
  rosterBalance: RosterBalanceGuidanceSchema,
  targetAlerts: TargetAlertSchema,
  timestamp: z.number(),
  confidence: z.number().min(0).max(1)
});

// Exported Types
export type PickRecommendation = z.infer<typeof PickRecommendationSchema>;
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