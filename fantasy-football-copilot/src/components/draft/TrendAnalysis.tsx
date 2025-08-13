import { useState, useMemo, useEffect } from 'react';
import { useDraft } from '../../contexts/DraftContext';
import { calculateTrendData, calculatePositionScarcity, getTopMovers, initializeTrendTracking } from '../../utils/trendAnalysis';
import type { TrendData, PositionScarcity } from '../../types';
import { TrendingUp, TrendingDown, AlertCircle, BarChart3 } from 'lucide-react';

const TrendAnalysis = () => {
  const { state } = useDraft();
  const [activeTab, setActiveTab] = useState<'movers' | 'scarcity'>('movers');
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [scarcityData, setScarcityData] = useState<PositionScarcity[]>([]);

  useEffect(() => {
    // Initialize trend tracking with current players
    initializeTrendTracking(state.players);
    
    // Calculate trend data
    const trends = calculateTrendData(state.players);
    setTrendData(trends);
    
    // Calculate position scarcity
    const draftedPlayers = state.picks.map(pick => pick.player).filter((player): player is NonNullable<typeof player> => Boolean(player));
    const scarcity = calculatePositionScarcity(state.players, draftedPlayers);
    setScarcityData(scarcity);
  }, [state.players, state.picks]);

  const { rising, falling } = useMemo(() => {
    return getTopMovers(trendData, 8);
  }, [trendData]);

  const getScarcityColor = (level: 'Critical' | 'High' | 'Medium' | 'Low') => {
    switch (level) {
      case 'Critical': return 'text-red-700 bg-red-100 border-red-200';
      case 'High': return 'text-orange-700 bg-orange-100 border-orange-200';
      case 'Medium': return 'text-yellow-700 bg-yellow-100 border-yellow-200';
      case 'Low': return 'text-green-700 bg-green-100 border-green-200';
    }
  };

  const getTrendIcon = (trend: 'Rising' | 'Falling' | 'Stable') => {
    switch (trend) {
      case 'Rising': return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'Falling': return <TrendingDown className="h-4 w-4 text-red-600" />;
      default: return <BarChart3 className="h-4 w-4 text-gray-400" />;
    }
  };

  const formatAdpChange = (change: number) => {
    const prefix = change > 0 ? '+' : '';
    return `${prefix}${change.toFixed(1)}`;
  };

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Tab Headers */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('movers')}
          className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'movers'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <div className="flex items-center justify-center">
            <TrendingUp className="h-4 w-4 mr-2" />
            ADP Movers
          </div>
        </button>
        <button
          onClick={() => setActiveTab('scarcity')}
          className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'scarcity'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <div className="flex items-center justify-center">
            <AlertCircle className="h-4 w-4 mr-2" />
            Position Scarcity
          </div>
        </button>
      </div>

      <div className="p-4">
        {activeTab === 'movers' && (
          <div className="space-y-4">
            <div className="text-xs text-gray-500 mb-4">
              ADP changes over the last 24-48 hours
            </div>

            {/* Rising Players */}
            {rising.length > 0 && (
              <div>
                <h4 className="flex items-center text-sm font-medium text-green-700 mb-2">
                  <TrendingUp className="h-4 w-4 mr-1" />
                  Rising ({rising.length})
                </h4>
                <div className="space-y-2">
                  {rising.map((trend) => (
                    <div key={trend.playerId} className="flex items-center justify-between p-2 bg-green-50 rounded border border-green-200">
                      <div className="flex items-center">
                        {getTrendIcon(trend.adpTrend)}
                        <div className="ml-2">
                          <div className="text-sm font-medium text-gray-900">
                            {trend.playerName}
                          </div>
                          <div className="text-xs text-gray-600">
                            {trend.position} • ADP: {trend.currentADP.toFixed(1)}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-green-700">
                          {formatAdpChange(trend.adpChange)}
                        </div>
                        <div className="text-xs text-gray-500">
                          from {trend.previousADP.toFixed(1)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Falling Players */}
            {falling.length > 0 && (
              <div>
                <h4 className="flex items-center text-sm font-medium text-red-700 mb-2">
                  <TrendingDown className="h-4 w-4 mr-1" />
                  Falling ({falling.length})
                </h4>
                <div className="space-y-2">
                  {falling.map((trend) => (
                    <div key={trend.playerId} className="flex items-center justify-between p-2 bg-red-50 rounded border border-red-200">
                      <div className="flex items-center">
                        {getTrendIcon(trend.adpTrend)}
                        <div className="ml-2">
                          <div className="text-sm font-medium text-gray-900">
                            {trend.playerName}
                          </div>
                          <div className="text-xs text-gray-600">
                            {trend.position} • ADP: {trend.currentADP.toFixed(1)}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-red-700">
                          {formatAdpChange(trend.adpChange)}
                        </div>
                        <div className="text-xs text-gray-500">
                          from {trend.previousADP.toFixed(1)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {rising.length === 0 && falling.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <BarChart3 className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm">No significant ADP movements detected</p>
                <p className="text-xs mt-1">Check back later for trending players</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'scarcity' && (
          <div className="space-y-3">
            <div className="text-xs text-gray-500 mb-4">
              Remaining elite players by position and tier
            </div>

            {scarcityData.map((scarcity) => (
              <div
                key={scarcity.position}
                className={`p-3 rounded-lg border ${getScarcityColor(scarcity.scarcityLevel)}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center">
                    <span className="font-medium text-sm">{scarcity.position}</span>
                    <span className={`ml-2 text-xs px-2 py-1 rounded-full font-medium ${getScarcityColor(scarcity.scarcityLevel)}`}>
                      {scarcity.scarcityLevel}
                    </span>
                  </div>
                  {scarcity.scarcityLevel === 'Critical' && (
                    <AlertCircle className="h-4 w-4 text-red-600" />
                  )}
                </div>
                
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="text-center">
                    <div className="font-medium text-gray-900">{scarcity.tier1Remaining}</div>
                    <div className="text-gray-600">Tier 1-2</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-gray-900">{scarcity.tier2Remaining}</div>
                    <div className="text-gray-600">Tier 3-4</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-gray-900">{scarcity.tier3Remaining}</div>
                    <div className="text-gray-600">Tier 5-6</div>
                  </div>
                </div>
                
                {scarcity.avgPicksUntilNextTier <= 3 && scarcity.tier1Remaining > 0 && (
                  <div className="mt-2 text-xs text-orange-700 bg-orange-50 p-2 rounded">
                    ⏰ Next tier likely gone in ~{scarcity.avgPicksUntilNextTier} picks
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TrendAnalysis;