import { useState, useCallback, useRef, useEffect } from 'react';
import type { AIStrategyResponse, AIServiceConfig, AIStrategyInput } from '../types/ai';
import type { Player } from '../types';
import { AIStrategyService } from '../services/ai';
import { DynamicVORPEngine } from '../utils/dynamicVORP';

export interface UseAIStrategyOptions {
  config?: Partial<AIServiceConfig>;
  autoRefresh?: boolean;
  refreshInterval?: number; // milliseconds
  enabled?: boolean;
}

export interface UseAIStrategyReturn {
  strategy: AIStrategyResponse | null;
  isLoading: boolean;
  error: string | null;
  isConfigured: boolean;
  lastUpdated: Date | null;
  refreshStrategy: () => Promise<void>;
  clearError: () => void;
  updateConfig: (newConfig: Partial<AIServiceConfig>) => void;
}

export function useAIStrategy(
  input: AIStrategyInput | null,
  options: UseAIStrategyOptions = {}
): UseAIStrategyReturn {
  const {
    config = {},
    autoRefresh = false,
    refreshInterval = 30000, // 30 seconds
    enabled = true
  } = options;

  const [strategy, setStrategy] = useState<AIStrategyResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [currentConfig, setCurrentConfig] = useState<Partial<AIServiceConfig>>(config);

  const serviceRef = useRef<AIStrategyService | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Check if AI is configured
  const isConfigured = AIStrategyService.isConfigured(currentConfig);

  // Initialize or update service when config changes
  useEffect(() => {
    if (isConfigured) {
      try {
        serviceRef.current = currentConfig.apiKey 
          ? new AIStrategyService(currentConfig as AIServiceConfig)
          : AIStrategyService.createDefault();
      } catch (err) {
        console.error('Failed to initialize AI service:', err);
        setError('Failed to initialize AI service');
      }
    } else {
      serviceRef.current = null;
    }
  }, [currentConfig, isConfigured]);

  // Generate AI strategy
  const refreshStrategy = useCallback(async () => {
    if (!input || !serviceRef.current || !enabled || !isConfigured) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Enrich input with VORP data if not provided
      const enrichedInput = input.vorpData.length > 0 ? input : {
        ...input,
        vorpData: enrichVORPData(input)
      };

      const response = await serviceRef.current.generateStrategy(enrichedInput);
      setStrategy(response);
      setLastUpdated(new Date());
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate AI strategy';
      console.error('AI Strategy error:', err);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [input, enabled, isConfigured]);

  // Auto-refresh functionality
  useEffect(() => {
    if (autoRefresh && enabled && isConfigured && input) {
      intervalRef.current = setInterval(refreshStrategy, refreshInterval);
      
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    }
  }, [autoRefresh, enabled, isConfigured, input, refreshInterval, refreshStrategy]);

  // Initial load when input changes
  useEffect(() => {
    if (enabled && isConfigured && input && !strategy) {
      refreshStrategy();
    }
  }, [input, enabled, isConfigured, strategy, refreshStrategy]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const updateConfig = useCallback((newConfig: Partial<AIServiceConfig>) => {
    setCurrentConfig(prev => ({ ...prev, ...newConfig }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    strategy,
    isLoading,
    error,
    isConfigured,
    lastUpdated,
    refreshStrategy,
    clearError,
    updateConfig
  };
}

// Helper function to enrich input with VORP data
function enrichVORPData(input: AIStrategyInput) {
  try {
    const { availablePlayers, userTeam, allTeams, draftState } = input;
    const dynamicVORP = new DynamicVORPEngine(
      draftState.players,
      draftState.settings,
      allTeams
    );

    return availablePlayers.map(player => {
      const vorp = dynamicVORP.calculateDynamicVORP(player);
      const analysis = dynamicVORP.getPositionDepthAnalysis(player.position);
      
      return {
        playerId: player.id,
        vorp,
        position: player.position,
        scarcityMultiplier: analysis.scarcityMultiplier
      };
    });
  } catch (error) {
    console.error('Failed to enrich VORP data:', error);
    return [];
  }
}

// Helper hook for AI configuration status
export function useAIConfig() {
  const [apiKey, setApiKey] = useState(
    import.meta.env.VITE_OPENAI_API_KEY || 
    (typeof process !== 'undefined' && process.env?.OPENAI_API_KEY) || 
    localStorage.getItem('ai_api_key') || 
    ''
  );
  
  const isConfigured = Boolean(apiKey);
  
  const updateApiKey = useCallback((newApiKey: string) => {
    setApiKey(newApiKey);
    if (newApiKey) {
      localStorage.setItem('ai_api_key', newApiKey);
    } else {
      localStorage.removeItem('ai_api_key');
    }
  }, []);

  return {
    apiKey,
    isConfigured,
    updateApiKey
  };
}