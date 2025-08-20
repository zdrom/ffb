import type { WhatIfForesight as WhatIfForesightType } from '../../types/ai';
import { Eye, TrendingDown, TrendingUp, Clock } from 'lucide-react';

interface WhatIfForesightProps {
  foresight: WhatIfForesightType;
  currentPick?: number;
}

export function WhatIfForesight({ foresight }: WhatIfForesightProps) {
  const getStrategyIcon = (strategy: WhatIfForesightType['recommendedStrategy']) => {
    switch (strategy) {
      case 'Wait': return <Clock className="h-4 w-4 text-blue-500" />;
      case 'Draft_Now': return <TrendingUp className="h-4 w-4 text-red-500" />;
      case 'Consider_Alternatives': return <TrendingDown className="h-4 w-4 text-yellow-500" />;
      default: return <Eye className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStrategyColor = (strategy: WhatIfForesightType['recommendedStrategy']) => {
    switch (strategy) {
      case 'Wait': return 'text-blue-700 bg-blue-50 border-blue-200';
      case 'Draft_Now': return 'text-red-700 bg-red-50 border-red-200';
      case 'Consider_Alternatives': return 'text-yellow-700 bg-yellow-50 border-yellow-200';
      default: return 'text-gray-700 bg-gray-50 border-gray-200';
    }
  };

  const getProbabilityColor = (probability: number) => {
    if (probability >= 0.8) return 'text-green-600 bg-green-100';
    if (probability >= 0.6) return 'text-yellow-600 bg-yellow-100';
    if (probability >= 0.4) return 'text-orange-600 bg-orange-100';
    return 'text-red-600 bg-red-100';
  };

  const formatStrategy = (strategy: WhatIfForesightType['recommendedStrategy']) => {
    return strategy.replace('_', ' ');
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Eye className="h-5 w-5 text-purple-600" />
        <h4 className="font-semibold text-gray-900">What-If Foresight</h4>
      </div>

      {/* Strategy Recommendation */}
      <div className={`p-3 rounded-lg border ${getStrategyColor(foresight.recommendedStrategy)}`}>
        <div className="flex items-center gap-2 mb-2">
          {getStrategyIcon(foresight.recommendedStrategy)}
          <span className="font-medium">
            Strategy: {formatStrategy(foresight.recommendedStrategy)}
          </span>
        </div>
        <p className="text-sm">{foresight.strategyExplanation}</p>
      </div>

      {/* Next Pick Probabilities */}
      {foresight.nextPickProbabilities.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-sm font-medium text-gray-700">Next Pick Availability</h5>
          
          <div className="space-y-2">
            {foresight.nextPickProbabilities.slice(0, 3).map((prob) => (
              <div 
                key={prob.playerId} 
                className="flex items-center justify-between p-2 bg-gray-50 rounded-md"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{prob.playerName}</span>
                    <span className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded">
                      {prob.position}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">{prob.explanation}</p>
                </div>
                
                <div className="text-right ml-3">
                  <div className={`px-2 py-1 text-xs font-medium rounded ${getProbabilityColor(prob.availabilityProbability)}`}>
                    {Math.round(prob.availabilityProbability * 100)}%
                  </div>
                  <div className="text-xs text-gray-500 mt-1">available</div>
                </div>
              </div>
            ))}
          </div>

          {/* Probability Legend */}
          <div className="flex items-center gap-4 pt-2 border-t border-gray-200">
            <div className="text-xs text-gray-600">Probability:</div>
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>High (80%+)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                <span>Medium (60-79%)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                <span>Low (40-59%)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <span>Very Low (&lt;40%)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {foresight.nextPickProbabilities.length === 0 && (
        <div className="p-3 bg-gray-50 rounded-lg text-center">
          <p className="text-sm text-gray-600">No foresight data available for next picks</p>
        </div>
      )}
    </div>
  );
}