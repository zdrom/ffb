import type { RosterBalanceGuidance, RosterBalanceGuidance as RosterBalanceType } from '../../types/ai';
import type { Team } from '../../types';
import { Scale, AlertTriangle, TrendingDown, Calendar } from 'lucide-react';

interface RosterBalanceProps {
  balance: RosterBalanceGuidance;
  userTeam: Team;
}

export function RosterBalance({ balance, userTeam }: RosterBalanceProps) {
  const getUrgencyColor = (urgency: RosterBalanceType['positionNeeds'][0]['urgency']) => {
    switch (urgency) {
      case 'Critical': return 'text-red-700 bg-red-100 border-red-200';
      case 'High': return 'text-orange-700 bg-orange-100 border-orange-200';
      case 'Medium': return 'text-yellow-700 bg-yellow-100 border-yellow-200';
      case 'Low': return 'text-green-700 bg-green-100 border-green-200';
      default: return 'text-gray-700 bg-gray-100 border-gray-200';
    }
  };

  const getSeverityColor = (severity: 'High' | 'Medium' | 'Low') => {
    switch (severity) {
      case 'High': return 'text-red-600 bg-red-100';
      case 'Medium': return 'text-yellow-600 bg-yellow-100';
      case 'Low': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const hasAnyAlerts = balance.positionNeeds.length > 0 || 
                      balance.tierAlerts.length > 0 || 
                      balance.byeWeekConcerns.length > 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Scale className="h-5 w-5 text-green-600" />
        <h4 className="font-semibold text-gray-900">Roster Balance</h4>
      </div>

      {!hasAnyAlerts && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-center">
          <p className="text-sm text-green-700">Your roster looks well-balanced!</p>
        </div>
      )}

      {/* Position Needs */}
      {balance.positionNeeds.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-sm font-medium text-gray-700 flex items-center gap-1">
            <AlertTriangle className="h-4 w-4" />
            Position Needs
          </h5>
          
          <div className="space-y-2">
            {balance.positionNeeds.map((need, index) => (
              <div 
                key={`${need.position}-${index}`}
                className={`p-2 rounded-md border ${getUrgencyColor(need.urgency)}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{need.position}</span>
                    <span className="text-xs">
                      ({userTeam.roster[need.position]?.length || 0} rostered)
                    </span>
                  </div>
                  <span className="text-xs font-medium px-2 py-1 rounded">
                    {need.urgency}
                  </span>
                </div>
                <p className="text-xs mt-1">{need.explanation}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tier Alerts */}
      {balance.tierAlerts.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-sm font-medium text-gray-700 flex items-center gap-1">
            <TrendingDown className="h-4 w-4" />
            Tier Alerts
          </h5>
          
          <div className="space-y-2">
            {balance.tierAlerts.map((alert, index) => (
              <div 
                key={`${alert.position}-${alert.tier}-${index}`}
                className={`p-2 rounded-md border ${
                  alert.isCliff ? 'border-red-200 bg-red-50' : 'border-yellow-200 bg-yellow-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{alert.position}</span>
                    <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded">
                      Tier {alert.tier}
                    </span>
                    {alert.isCliff && (
                      <span className="text-xs bg-red-200 text-red-700 px-2 py-1 rounded">
                        CLIFF
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-medium">
                    {alert.playersRemaining} left
                  </span>
                </div>
                <p className="text-xs mt-1 text-gray-600">{alert.explanation}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bye Week Concerns */}
      {balance.byeWeekConcerns.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-sm font-medium text-gray-700 flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            Bye Week Concerns
          </h5>
          
          <div className="space-y-2">
            {balance.byeWeekConcerns.map((concern, index) => (
              <div 
                key={`week-${concern.week}-${index}`}
                className="p-2 bg-gray-50 rounded-md border border-gray-200"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">Week {concern.week}</span>
                    <span className={`text-xs px-2 py-1 rounded ${getSeverityColor(concern.severity)}`}>
                      {concern.severity}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    {concern.affectedPositions.map(pos => (
                      <span 
                        key={pos}
                        className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded"
                      >
                        {pos}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}