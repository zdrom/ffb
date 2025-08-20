import type { PickRecommendation } from '../../types/ai';
import { Star, TrendingUp, Clock, AlertCircle, Brain, Users, Target, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { useDraft } from '../../contexts/DraftContext';
import { ProbabilityDisplay } from '../common/ProbabilityDisplay';

interface TopRecommendationsProps {
  recommendations: PickRecommendation[];
  picksUntilMyTurn: number;
}

export function TopRecommendations({ recommendations, picksUntilMyTurn }: TopRecommendationsProps) {
  const { state } = useDraft();
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  
  if (recommendations.length === 0) {
    return null;
  }
  
  const toggleCard = (playerId: string) => {
    const newExpanded = new Set(expandedCards);
    if (newExpanded.has(playerId)) {
      newExpanded.delete(playerId);
    } else {
      newExpanded.add(playerId);
    }
    setExpandedCards(newExpanded);
  };

  const getUrgencyColor = (urgency: PickRecommendation['urgency']) => {
    switch (urgency) {
      case 'High': return 'text-red-600 bg-red-100';
      case 'Medium': return 'text-yellow-600 bg-yellow-100';
      case 'Low': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Star className="h-5 w-5 text-yellow-500" />
        <h4 className="font-semibold text-gray-900">Top 3 AI Picks</h4>
        {picksUntilMyTurn > 0 && (
          <div className="flex items-center gap-1 text-sm text-gray-600">
            <Clock className="h-4 w-4" />
            <span>{picksUntilMyTurn} picks until your turn</span>
          </div>
        )}
      </div>

      <div className="space-y-2">
        {recommendations.map((rec, index) => (
          <div 
            key={rec.playerId} 
            className={`p-3 rounded-lg border transition-all hover:shadow-md ${
              index === 0 ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-gray-50'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex items-center gap-1">
                    <span className="font-bold text-gray-900">{index + 1}.</span>
                    <span className="font-semibold text-gray-900">{rec.playerName}</span>
                    <span className="px-2 py-1 text-xs font-medium bg-gray-200 text-gray-700 rounded">
                      {rec.position}
                    </span>
                  </div>
                  
                  {index === 0 && (
                    <Star className="h-4 w-4 text-yellow-500 fill-current" />
                  )}
                </div>

                <p className="text-sm text-gray-700 mb-2">{rec.explanation}</p>
                
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex items-center gap-1 text-sm">
                    <TrendingUp className="h-4 w-4 text-blue-500" />
                    <span className="text-gray-600">VORP: </span>
                    <span className="font-medium">{rec.vorp.toFixed(1)}</span>
                  </div>
                  
                  <div className={`flex items-center gap-1 text-sm ${getConfidenceColor(rec.confidence)}`}>
                    <span>Confidence: {Math.round(rec.confidence * 100)}%</span>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-gray-600">Available:</span>
                    <ProbabilityDisplay 
                      player={state.players.find(p => p.id === rec.playerId)!} 
                      draftState={state} 
                      size="small"
                    />
                  </div>
                </div>

                {/* Strategic Reasoning Toggle */}
                <button
                  onClick={() => toggleCard(rec.playerId)}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors"
                >
                  <Brain className="h-3 w-3" />
                  <span>Strategic Analysis</span>
                  {expandedCards.has(rec.playerId) ? 
                    <ChevronUp className="h-3 w-3" /> : 
                    <ChevronDown className="h-3 w-3" />
                  }
                </button>

                {/* Expanded Strategic Reasoning */}
                {expandedCards.has(rec.playerId) && rec.strategicReasoning && (
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-md space-y-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                      <div className="flex items-start gap-2">
                        <Target className="h-3 w-3 text-green-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <span className="font-medium text-gray-700">Roster Fit:</span>
                          <p className="text-gray-600">{rec.strategicReasoning.rosterFit}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-2">
                        <TrendingUp className="h-3 w-3 text-orange-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <span className="font-medium text-gray-700">Position Scarcity:</span>
                          <p className="text-gray-600">{rec.strategicReasoning.positionalScarcity}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-2">
                        <Users className="h-3 w-3 text-purple-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <span className="font-medium text-gray-700">Opponent Impact:</span>
                          <p className="text-gray-600">{rec.strategicReasoning.opponentImpact}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-2">
                        <Clock className="h-3 w-3 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <span className="font-medium text-gray-700">Future Flexibility:</span>
                          <p className="text-gray-600">{rec.strategicReasoning.futureFlexibility}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 pt-2 border-t border-blue-200">
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                      <span className="text-xs font-medium text-gray-700">Opportunity Cost:</span>
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-amber-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${rec.strategicReasoning.opportunityCost * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-600">
                        {rec.strategicReasoning.opportunityCost > 0.7 ? 'High' : 
                         rec.strategicReasoning.opportunityCost > 0.4 ? 'Medium' : 'Low'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col items-end gap-2">
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getUrgencyColor(rec.urgency)}`}>
                  {rec.urgency}
                </span>
                
                {rec.urgency === 'High' && picksUntilMyTurn === 0 && (
                  <div className="flex items-center gap-1 text-xs text-red-600">
                    <AlertCircle className="h-3 w-3" />
                    <span>Draft Now</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {picksUntilMyTurn === 0 && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-green-700">
            <AlertCircle className="h-4 w-4" />
            <span className="font-medium">Your turn to pick!</span>
          </div>
        </div>
      )}
    </div>
  );
}