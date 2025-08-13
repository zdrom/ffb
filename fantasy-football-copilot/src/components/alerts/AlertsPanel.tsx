import React, { useMemo, useEffect } from 'react';
import { AlertTriangle, TrendingDown, Volume2, Bell, Target, Users } from 'lucide-react';
import { useDraft } from '../../contexts/DraftContext';
import { AlertsEngine } from '../../utils/alerts';

const AlertsPanel: React.FC = () => {
  const { state } = useDraft();

  const alertsData = useMemo(() => {
    const engine = new AlertsEngine(state.picks, state.players);
    
    return {
      positionalRuns: engine.detectPositionalRuns(),
      tierAlerts: engine.detectTierAlerts(),
      shouldFlash: engine.shouldFlashTab(),
      alertSound: engine.getAlertSound(),
      scarcity: {
        QB: engine.getPositionScarcity('QB'),
        RB: engine.getPositionScarcity('RB'),
        WR: engine.getPositionScarcity('WR'),
        TE: engine.getPositionScarcity('TE'),
        K: engine.getPositionScarcity('K'),
        DEF: engine.getPositionScarcity('DEF')
      }
    };
  }, [state.picks, state.players]);

  // Flash browser tab when there are critical alerts
  useEffect(() => {
    if (alertsData.shouldFlash) {
      const originalTitle = document.title;
      let isFlashing = false;
      
      const flashInterval = setInterval(() => {
        document.title = isFlashing ? originalTitle : '🚨 ALERT - Fantasy Draft';
        isFlashing = !isFlashing;
      }, 1000);

      // Stop flashing after 10 seconds
      setTimeout(() => {
        clearInterval(flashInterval);
        document.title = originalTitle;
      }, 10000);

      return () => {
        clearInterval(flashInterval);
        document.title = originalTitle;
      };
    }
  }, [alertsData.shouldFlash]);

  // Play alert sounds (optional)
  useEffect(() => {
    if (alertsData.alertSound) {
      // In a real app, you'd play actual sounds here
      console.log(`Alert sound: ${alertsData.alertSound}`);
      
      // Optional: Use Web Audio API or HTML5 audio
      // const audio = new Audio(`/sounds/${alertsData.alertSound}.mp3`);
      // audio.play().catch(() => {});
    }
  }, [alertsData.alertSound]);

  const getPositionColor = (position: string) => {
    const colors: { [key: string]: string } = {
      QB: 'bg-red-100 text-red-800 border-red-200',
      RB: 'bg-green-100 text-green-800 border-green-200',
      WR: 'bg-blue-100 text-blue-800 border-blue-200',
      TE: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      K: 'bg-purple-100 text-purple-800 border-purple-200',
      DEF: 'bg-gray-100 text-gray-800 border-gray-200'
    };
    return colors[position] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getScarcityLevel = (count: number, position: string): { level: string; color: string } => {
    if (position === 'QB' || position === 'K' || position === 'DEF') {
      if (count <= 1) return { level: 'Critical', color: 'text-red-600' };
      if (count <= 3) return { level: 'Low', color: 'text-yellow-600' };
      return { level: 'Good', color: 'text-green-600' };
    } else {
      if (count <= 2) return { level: 'Critical', color: 'text-red-600' };
      if (count <= 5) return { level: 'Low', color: 'text-yellow-600' };
      return { level: 'Good', color: 'text-green-600' };
    }
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center">
          <Bell className="h-5 w-5 text-gray-500 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">Alerts & Insights</h2>
          {alertsData.shouldFlash && (
            <div className="ml-2 flex items-center">
              <div className="h-2 w-2 bg-red-500 rounded-full animate-pulse"></div>
            </div>
          )}
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Position Runs */}
        {alertsData.positionalRuns.length > 0 && (
          <div>
            <div className="flex items-center mb-3">
              <Users className="h-4 w-4 text-orange-500 mr-2" />
              <h3 className="text-sm font-medium text-gray-900">Position Runs</h3>
            </div>
            <div className="space-y-2">
              {alertsData.positionalRuns.map((run) => (
                <div
                  key={run.position}
                  className={`p-3 rounded-md border ${run.isActive ? 'bg-orange-50 border-orange-200' : 'bg-yellow-50 border-yellow-200'}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border mr-2 ${getPositionColor(run.position)}`}>
                        {run.position}
                      </span>
                      <span className="text-sm font-medium">
                        {run.count} picked in last {run.inLastPicks} picks
                      </span>
                      {run.isActive && (
                        <TrendingDown className="h-4 w-4 text-orange-500 ml-2" />
                      )}
                    </div>
                    {run.isActive && (
                      <span className="text-xs font-medium text-orange-600">ACTIVE RUN</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tier Alerts */}
        {alertsData.tierAlerts.length > 0 && (
          <div>
            <div className="flex items-center mb-3">
              <AlertTriangle className="h-4 w-4 text-red-500 mr-2" />
              <h3 className="text-sm font-medium text-gray-900">Tier Alerts</h3>
            </div>
            <div className="space-y-2">
              {alertsData.tierAlerts.slice(0, 6).map((alert) => (
                <div
                  key={`${alert.position}-${alert.tier}`}
                  className={`p-3 rounded-md border ${alert.isCollapsing ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border mr-2 ${getPositionColor(alert.position)}`}>
                        {alert.position}
                      </span>
                      <span className="text-sm">
                        Tier {alert.tier}: {alert.remainingPlayers} player{alert.remainingPlayers > 1 ? 's' : ''} left
                      </span>
                    </div>
                    {alert.isCollapsing && (
                      <div className="flex items-center">
                        <AlertTriangle className="h-4 w-4 text-red-500 mr-1" />
                        <span className="text-xs font-medium text-red-600">COLLAPSING</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Position Scarcity */}
        <div>
          <div className="flex items-center mb-3">
            <Target className="h-4 w-4 text-blue-500 mr-2" />
            <h3 className="text-sm font-medium text-gray-900">Position Scarcity (Top 3 Tiers)</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(alertsData.scarcity).map(([position, data]) => {
              const totalTop3 = data.tier1 + data.tier2 + data.tier3;
              const scarcity = getScarcityLevel(totalTop3, position);
              
              return (
                <div key={position} className="p-3 bg-gray-50 rounded-md border border-gray-200">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border ${getPositionColor(position)}`}>
                      {position}
                    </span>
                    <span className={`text-xs font-medium ${scarcity.color}`}>
                      {scarcity.level}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600">
                    T1: {data.tier1} | T2: {data.tier2} | T3: {data.tier3}
                  </div>
                  <div className="text-xs font-medium text-gray-900">
                    Total: {totalTop3} elite players
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sound Settings Info */}
        <div className="pt-4 border-t border-gray-200">
          <div className="flex items-center text-xs text-gray-500">
            <Volume2 className="h-3 w-3 mr-1" />
            <span>Tab flashing and sound alerts are active for critical events</span>
          </div>
        </div>
      </div>

      {alertsData.positionalRuns.length === 0 && alertsData.tierAlerts.length === 0 && (
        <div className="p-6 text-center">
          <Bell className="h-8 w-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-500">
            No active alerts. Position runs and tier collapses will appear here.
          </p>
        </div>
      )}
    </div>
  );
};

export default AlertsPanel;