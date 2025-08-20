import { useMemo } from 'react';
import { useDraft } from '../../contexts/DraftContext';
import { useAIStrategy, useAIConfig } from '../../hooks/useAIStrategy';
import { DynamicVORPEngine } from '../../utils/dynamicVORP';
import { calculateReachProbability } from '../../utils/reachProbability';
import { StrategicAnalysisEngine } from '../../utils/strategicAnalysis';
import type { AIStrategyInput } from '../../types/ai';
import { Brain, TrendingUp, AlertTriangle, Target, Loader2 } from 'lucide-react';

import { TopRecommendations } from './TopRecommendations';
import { AIConfigPanel } from './AIConfigPanel';

interface AIStrategyOverlayProps {
  className?: string;
  collapsed?: boolean;
}

export function AIStrategyOverlay({ className = '', collapsed = false }: AIStrategyOverlayProps) {
  const { state } = useDraft();
  const { apiKey, isConfigured: isApiConfigured } = useAIConfig();
  
  // Prepare AI input data
  const aiInput = useMemo((): AIStrategyInput | null => {
    if (state.players.length === 0 || state.teams.length === 0) {
      return null;
    }

    const availablePlayers = state.players.filter(p => !p.isDrafted && !p.isDoNotDraft);
    const userTeam = state.teams.find(t => t.isUser);
    
    if (!userTeam || availablePlayers.length === 0) {
      return null;
    }

    // Calculate probabilities for top players
    const probabilities: Record<string, number> = {};
    const topPlayers = availablePlayers
      .sort((a, b) => (b.vorp || 0) - (a.vorp || 0))
      .slice(0, 20);

    topPlayers.forEach(player => {
      const reachResult = calculateReachProbability(player, state);
      probabilities[player.id] = reachResult.probability / 100;
    });

    // Generate VORP data
    const dynamicVORP = new DynamicVORPEngine(state.players, state.settings, state.teams);
    const vorpData = availablePlayers.map(player => {
      const vorp = dynamicVORP.calculateDynamicVORP(player);
      const analysis = dynamicVORP.getPositionDepthAnalysis(player.position);
      
      return {
        playerId: player.id,
        vorp,
        position: player.position,
        scarcityMultiplier: analysis.scarcityMultiplier
      };
    });

    // Generate enhanced strategic analysis
    const strategicEngine = new StrategicAnalysisEngine(state.players, state.teams, state);
    const baseInput = {
      availablePlayers,
      userTeam,
      allTeams: state.teams,
      draftState: state,
      picksUntilMyTurn: state.picksUntilMyTurn,
      probabilities,
      vorpData
    };
    
    return strategicEngine.generateEnhancedInput(baseInput);
  }, [state]);

  const {
    strategy,
    isLoading,
    error,
    lastUpdated,
    refreshStrategy,
    clearError
  } = useAIStrategy(aiInput, {
    enabled: true,
    autoRefresh: false,
    config: isApiConfigured ? {
      provider: 'openai',
      apiKey: apiKey,
      model: 'gpt-4o-mini'
    } : undefined
  });

  if (!isApiConfigured) {
    return (
      <div className={`bg-white rounded-lg shadow-md border p-4 ${className}`}>
        <div className="flex items-center gap-2 mb-3">
          <Brain className="h-5 w-5 text-blue-600" />
          <h3 className="font-semibold text-gray-900">AI Strategy Assistant</h3>
        </div>
        <AIConfigPanel />
      </div>
    );
  }

  if (collapsed) {
    return (
      <div className={`bg-white rounded-lg shadow-md border p-3 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-blue-600" />
            <span className="font-medium text-gray-900">AI Assistant</span>
            {isLoading && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
          </div>
          {strategy && (
            <div className="flex items-center gap-1 text-sm text-gray-600">
              <TrendingUp className="h-4 w-4" />
              <span>Confidence: {Math.round(strategy.confidence * 100)}%</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-md border ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-blue-600" />
          <h3 className="font-semibold text-gray-900">AI Strategy Assistant</h3>
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
        </div>
        
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-gray-500">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          {strategy && (
            <div className="flex items-center gap-1 text-sm">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <span className="font-medium text-green-600">
                {Math.round(strategy.confidence * 100)}%
              </span>
            </div>
          )}
          <button
            onClick={refreshStrategy}
            disabled={isLoading || !aiInput}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 bg-red-50 border-b border-red-200">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-red-700 font-medium">AI Strategy Error</p>
              <p className="text-xs text-red-600 mt-1">{error}</p>
            </div>
            <button
              onClick={clearError}
              className="text-red-500 hover:text-red-700"
              aria-label="Clear error"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && !strategy && (
        <div className="p-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-2" />
          <p className="text-sm text-gray-600">Analyzing draft situation...</p>
        </div>
      )}

      {/* Strategy Content */}
      {strategy && (
        <div className="p-4">
          {/* Strategic Summary */}
          {strategy.summary && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800 font-medium">{strategy.summary}</p>
            </div>
          )}

          {/* Top 3 Recommendations Only */}
          <TopRecommendations 
            recommendations={strategy.topRecommendations}
            picksUntilMyTurn={state.picksUntilMyTurn}
          />
        </div>
      )}

      {/* No Strategy State */}
      {!isLoading && !strategy && !error && aiInput && (
        <div className="p-8 text-center">
          <Target className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 mb-2">Ready to analyze your draft</p>
          <p className="text-sm text-gray-500 mb-4">
            Get AI-powered recommendations based on your draft situation
          </p>
          <button
            onClick={refreshStrategy}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Generate Strategy
          </button>
        </div>
      )}

      {/* Inactive Draft State */}
      {!aiInput && (
        <div className="p-8 text-center">
          <Brain className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Start your draft to get AI recommendations</p>
        </div>
      )}
    </div>
  );
}