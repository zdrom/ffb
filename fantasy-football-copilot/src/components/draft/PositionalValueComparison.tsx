import React, { useMemo, useState, useEffect } from 'react';
import { BarChart3, Crown, Target, Brain, AlertCircle, Key, Save, X } from 'lucide-react';
import { useDraft } from '../../contexts/DraftContext';
import { DynamicVORPEngine } from '../../utils/dynamicVORP';
import { VORPOnlyRecommendationsEngine } from '../../utils/vorpOnlyRecommendations';
import { AIRecommendationService, createAIRecommendationService } from '../../services/aiRecommendationService';
import { DraftContextAnalyzer } from '../../utils/draftContextAnalyzer';
import type { Position } from '../../types';
import type { AIRecommendation } from '../../services/aiRecommendationService';

const PositionalValueComparison: React.FC = () => {
  const { state } = useDraft();

  const [aiRecommendation, setAIRecommendation] = useState<AIRecommendation | null>(null);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [aiEnabled, setAIEnabled] = useState(false);
  const [showAIMode, setShowAIMode] = useState(true);
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');

  const { vorpByPosition, starterSatisfaction, topRecommendation, vorpEngine, userTeam } = useMemo(() => {
    const userTeam = state.teams.find(t => t.isUser);
    if (!userTeam || state.players.length === 0) {
      return { vorpByPosition: new Map(), starterSatisfaction: new Map(), topRecommendation: null, vorpEngine: null, userTeam: null };
    }

    const vorpEngine = new DynamicVORPEngine(state.players, state.settings, state.teams);
    const positions: Position[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
    const vorpByPosition = new Map();
    const starterSatisfaction = new Map();

    // Get top VORP recommendation
    const recEngine = new VORPOnlyRecommendationsEngine(
      state.players,
      userTeam,
      state.teams,
      state.settings,
      state.currentPick,
      state.picks
    );
    const recommendations = recEngine.getRecommendations(1);
    const topRecommendation = recommendations[0] || null;

    positions.forEach(position => {
      const availablePlayers = state.players.filter(p => 
        p.position === position && 
        !p.isDrafted && 
        !p.isDoNotDraft &&
        positions.includes(p.position) // Only include valid positions
      );

      const playersWithVORP = availablePlayers
        .map(p => ({
          player: p,
          vorp: vorpEngine.calculateDynamicVORP(p)
        }))
        .sort((a, b) => b.vorp - a.vorp)
        .slice(0, 6); // Leader + next 5

      vorpByPosition.set(position, playersWithVORP);

      // Calculate detailed team starter distribution
      const requiredStarters = state.settings.rosterSlots[position] || 0;
      const starterDistribution: number[] = new Array(requiredStarters + 1).fill(0);
      let teamsSatisfied = 0;
      
      state.teams.forEach(team => {
        const positionCount = team.roster[position]?.length || 0;
        const startersFilled = Math.min(positionCount, requiredStarters);
        starterDistribution[startersFilled]++;
        
        if (positionCount >= requiredStarters) {
          teamsSatisfied++;
        }
      });

      starterSatisfaction.set(position, {
        teamsSatisfied,
        totalTeams: state.teams.length,
        requiredStarters,
        percentSatisfied: Math.round((teamsSatisfied / state.teams.length) * 100),
        distribution: starterDistribution
      });
    });

    return { vorpByPosition, starterSatisfaction, topRecommendation, vorpEngine, userTeam };
  }, [state.players, state.teams, state.settings, state.currentPick, state.picks]);

  const getPositionColor = (position: Position) => {
    const colors: Record<Position, string> = {
      QB: 'bg-red-100 text-red-800 border-red-200',
      RB: 'bg-green-100 text-green-800 border-green-200',
      WR: 'bg-blue-100 text-blue-800 border-blue-200',
      TE: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      K: 'bg-purple-100 text-purple-800 border-purple-200',
      DEF: 'bg-gray-100 text-gray-800 border-gray-200'
    };
    return colors[position];
  };

  const positions: Position[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];

  // Initialize API key from localStorage
  useEffect(() => {
    const savedApiKey = localStorage.getItem('openai_api_key');
    if (savedApiKey) {
      setApiKeyInput(savedApiKey);
      setAIEnabled(true);
    }
  }, []);

  // Handle API key save
  const handleSaveApiKey = () => {
    if (apiKeyInput.trim()) {
      localStorage.setItem('openai_api_key', apiKeyInput.trim());
      setAIEnabled(true);
      setShowApiKeyInput(false);
    }
  };

  // Handle API key removal
  const handleRemoveApiKey = () => {
    localStorage.removeItem('openai_api_key');
    setApiKeyInput('');
    setAIEnabled(false);
    setAIRecommendation(null);
    setShowApiKeyInput(false);
  };

  // AI Recommendation Effect
  useEffect(() => {
    const getAIRecommendation = async () => {
      // Check for API key from localStorage only
      const apiKey = localStorage.getItem('openai_api_key');
      
      if (!apiKey || !userTeam || state.players.length === 0) {
        setAIEnabled(false);
        return;
      }

      setAIEnabled(true);
      setIsLoadingAI(true);

      try {
        const aiService = createAIRecommendationService(apiKey);
        if (!aiService) return;

        const contextAnalyzer = new DraftContextAnalyzer(
          state.players,
          state.teams,
          state.settings,
          state.picks
        );

        const context = contextAnalyzer.buildAIContext(state.currentPick);
        const recommendation = await aiService.getRecommendation(context);
        
        setAIRecommendation(recommendation);
      } catch (error) {
        console.error('AI recommendation failed:', error);
        setAIRecommendation(null);
      } finally {
        setIsLoadingAI(false);
      }
    };

    getAIRecommendation();
  }, [state.players, state.teams, state.settings, state.picks, state.currentPick, userTeam]);

  if (!userTeam) {
    return <div>Loading...</div>;
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center">
          <BarChart3 className="h-5 w-5 text-blue-600 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">VORP Leaders by Position</h2>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          Top VORP values at each position with next 5 options below
        </p>
      </div>

      <div className="p-6">
        {/* AI vs VORP Toggle */}
        {aiEnabled && (
          <div className="mb-4 flex items-center justify-center">
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setShowAIMode(true)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  showAIMode ? 'bg-purple-600 text-white' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Brain className="h-4 w-4 inline mr-1" />
                AI Recommendation
              </button>
              <button
                onClick={() => setShowAIMode(false)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  !showAIMode ? 'bg-blue-600 text-white' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Target className="h-4 w-4 inline mr-1" />
                VORP Only
              </button>
            </div>
          </div>
        )}

        {/* AI Recommendation */}
        {aiEnabled && showAIMode && aiRecommendation && !isLoadingAI && (
          <div className="mb-6 p-4 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center">
                <Brain className="h-5 w-5 text-purple-600 mr-2" />
                <h3 className="text-lg font-semibold text-purple-900">AI Strategic Recommendation</h3>
              </div>
              <div className="flex items-center">
                <span className="text-xs text-purple-600 bg-purple-100 px-2 py-1 rounded-full">
                  {aiRecommendation.confidence}% Confidence
                </span>
                <span className={`ml-2 text-xs px-2 py-1 rounded-full ${
                  aiRecommendation.urgency === 'Critical' ? 'bg-red-100 text-red-600' :
                  aiRecommendation.urgency === 'High' ? 'bg-orange-100 text-orange-600' :
                  aiRecommendation.urgency === 'Medium' ? 'bg-yellow-100 text-yellow-600' :
                  'bg-green-100 text-green-600'
                }`}>
                  {aiRecommendation.urgency} Urgency
                </span>
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <div className="mb-3">
                  <div className="font-bold text-xl text-gray-900">{aiRecommendation.recommendedPlayer.name}</div>
                  <div className="text-sm text-gray-600">{aiRecommendation.recommendedPlayer.team} - {aiRecommendation.recommendedPlayer.position}</div>
                  <div className="text-lg font-bold text-purple-600 mt-1">
                    VORP: {vorpEngine ? vorpEngine.calculateDynamicVORP(aiRecommendation.recommendedPlayer).toFixed(1) : 'N/A'}
                  </div>
                </div>
                
                <div className="text-sm text-gray-700 mb-3">
                  <strong>AI Analysis:</strong> {aiRecommendation.reasoning}
                </div>
                
                {aiRecommendation.strategicNote && (
                  <div className="text-sm text-purple-700 bg-purple-50 p-2 rounded">
                    <strong>Strategy:</strong> {aiRecommendation.strategicNote}
                  </div>
                )}
              </div>
              
              <div>
                {aiRecommendation.alternativeOptions.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Alternatives:</h4>
                    <div className="space-y-2">
                      {aiRecommendation.alternativeOptions.slice(0, 2).map((alt, index) => (
                        <div key={index} className="text-sm">
                          <div className="font-medium text-gray-800">{alt.player.name}</div>
                          <div className="text-gray-600">{alt.reason}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Loading AI */}
        {aiEnabled && isLoadingAI && (
          <div className="mb-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
            <div className="flex items-center">
              <Brain className="h-5 w-5 text-purple-600 mr-2 animate-pulse" />
              <h3 className="text-lg font-semibold text-purple-900">AI Analyzing Draft Context...</h3>
            </div>
            <div className="mt-2 text-sm text-purple-700">
              Considering team rosters, player availability, and positional scarcity...
            </div>
          </div>
        )}

        {/* VORP-Only Recommendation */}
        {(!aiEnabled || !showAIMode) && topRecommendation && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center mb-2">
              <Target className="h-5 w-5 text-blue-600 mr-2" />
              <h3 className="text-lg font-semibold text-blue-900">VORP Recommendation</h3>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="mr-4">
                  <div className="font-bold text-xl text-gray-900">{topRecommendation.player.name}</div>
                  <div className="text-sm text-gray-600">{topRecommendation.player.team} - {topRecommendation.player.position}</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-blue-600">
                    VORP: {vorpEngine ? vorpEngine.calculateDynamicVORP(topRecommendation.player).toFixed(1) : 'N/A'}
                  </div>
                  <div className="text-sm text-gray-600">{topRecommendation.reasons?.join(', ') || 'Top VORP value'}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* API Key Setup Section */}
        {!aiEnabled && !showApiKeyInput && (
          <div className="mb-4 p-4 bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Brain className="h-5 w-5 text-yellow-600 mr-3" />
                <div>
                  <div className="font-medium text-yellow-800">Enable AI-Powered Recommendations</div>
                  <div className="text-sm text-yellow-700">Get strategic draft advice that considers team rosters, player availability, and VORP analysis</div>
                </div>
              </div>
              <button
                onClick={() => setShowApiKeyInput(true)}
                className="flex items-center px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
              >
                <Key className="h-4 w-4 mr-2" />
                Setup AI
              </button>
            </div>
          </div>
        )}

        {/* API Key Input Form */}
        {showApiKeyInput && (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center mb-3">
              <Key className="h-5 w-5 text-blue-600 mr-2" />
              <h3 className="font-medium text-blue-900">Configure OpenAI API Key</h3>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  OpenAI API Key
                </label>
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="sk-..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <div className="text-xs text-gray-600 mt-1">
                  Your API key is stored locally in your browser and never shared. Get one at{' '}
                  <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    platform.openai.com
                  </a>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSaveApiKey}
                  disabled={!apiKeyInput.trim()}
                  className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save & Enable AI
                </button>
                <button
                  onClick={() => setShowApiKeyInput(false)}
                  className="flex items-center px-3 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* AI Configuration (when enabled) */}
        {aiEnabled && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center text-sm text-green-800">
                <Brain className="h-4 w-4 mr-2" />
                <span>AI recommendations enabled</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowApiKeyInput(true)}
                  className="text-xs text-green-600 hover:text-green-800 transition-colors"
                >
                  Change Key
                </button>
                <button
                  onClick={handleRemoveApiKey}
                  className="text-xs text-red-600 hover:text-red-800 transition-colors"
                >
                  Disable AI
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {positions.map(position => {
            const playersWithVORP = vorpByPosition.get(position) || [];
            const leader = playersWithVORP[0];
            const nextFive = playersWithVORP.slice(1, 6);
            const satisfaction = starterSatisfaction.get(position);

            // Calculate VORP dropoff for visualization
            const vorpValues = playersWithVORP.map(p => p.vorp);
            const maxVORP = Math.max(...vorpValues);
            const minVORP = Math.min(...vorpValues);

            return (
              <div key={position} className="border border-gray-200 rounded-lg p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${getPositionColor(position)}`}>
                    {position}
                  </div>
                  {satisfaction && (
                    <div className="text-xs text-gray-500">
                      <div className="flex justify-end space-x-1 mb-1">
                        {satisfaction.distribution.map((count, starterCount) => (
                          <div key={starterCount} className="text-center">
                            <div className="text-xs font-medium text-gray-700">{count}</div>
                            <div className="text-[10px] text-gray-400">{starterCount}</div>
                          </div>
                        ))}
                      </div>
                      <div className={`text-xs font-medium text-right ${satisfaction.percentSatisfied >= 75 ? 'text-red-600' : satisfaction.percentSatisfied >= 50 ? 'text-yellow-600' : 'text-green-600'}`}>
                        {satisfaction.percentSatisfied}% satisfied
                      </div>
                    </div>
                  )}
                </div>

                {leader ? (
                  <>
                    {/* VORP Leader */}
                    <div className="mb-4">
                      <h3 className="font-semibold text-gray-900 flex items-center text-base" title={leader.player.name}>
                        <Crown className="h-4 w-4 text-yellow-500 mr-2" />
                        {leader.player.name}
                      </h3>
                      <div className="text-lg font-bold text-blue-600 mt-1">
                        VORP: {leader.vorp.toFixed(1)}
                      </div>
                    </div>

                    {/* VORP Dropoff Visualization */}
                    {nextFive.length > 0 && (
                      <div className="mb-4">
                        <div className="text-xs font-medium text-gray-600 mb-1">VORP Dropoff:</div>
                        <div className="space-y-1">
                          {playersWithVORP.map((playerData, index) => {
                            const widthPercent = maxVORP > 0 ? (playerData.vorp / maxVORP) * 100 : 0;
                            const isLeader = index === 0;
                            
                            return (
                              <div key={playerData.player.id} className="flex items-center">
                                <div 
                                  className={`h-2 rounded transition-all ${
                                    isLeader ? 'bg-blue-500' : 'bg-gray-300'
                                  }`}
                                  style={{ width: `${Math.max(widthPercent, 5)}%` }}
                                />
                                <span className={`ml-2 text-xs ${isLeader ? 'font-medium text-gray-800' : 'text-gray-500'}`}>
                                  {playerData.vorp.toFixed(1)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Next 5 Options */}
                    {nextFive.length > 0 && (
                      <div className="border-t border-gray-100 pt-3">
                        <div className="text-xs font-medium text-gray-600 mb-2">Next Best Options:</div>
                        <div className="space-y-1">
                          {nextFive.map((playerData, index) => {
                            const vorpDiff = leader.vorp - playerData.vorp;
                            
                            return (
                              <div key={playerData.player.id} className="flex justify-between items-center text-sm text-gray-700">
                                <span className="truncate">{playerData.player.name}</span>
                                <div className="flex items-center ml-2">
                                  <span className="text-xs text-red-500 font-medium mr-1">
                                    -{vorpDiff.toFixed(1)}
                                  </span>
                                  <span className="text-xs text-gray-500 font-medium">
                                    {playerData.vorp.toFixed(1)}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-6">
                    <div className="text-gray-400 mb-1">No players available</div>
                    <div className="text-xs text-gray-500">All {position}s drafted</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PositionalValueComparison;