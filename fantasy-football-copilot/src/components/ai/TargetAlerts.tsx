import type { TargetAlert as TargetAlertType } from '../../types/ai';
import type { Player } from '../../types';
import { Target, Clock, Link, AlertCircle } from 'lucide-react';

interface TargetAlertsProps {
  alerts: TargetAlertType;
  availablePlayers: Player[];
}

export function TargetAlerts({ alerts, availablePlayers }: TargetAlertsProps) {
  const getPriorityColor = (priority: TargetAlertType['lastChanceTargets'][0]['priority']) => {
    switch (priority) {
      case 'Must_Draft': return 'text-red-700 bg-red-100 border-red-200';
      case 'High': return 'text-orange-700 bg-orange-100 border-orange-200';
      case 'Medium': return 'text-yellow-700 bg-yellow-100 border-yellow-200';
      default: return 'text-gray-700 bg-gray-100 border-gray-200';
    }
  };

  const getStackTypeLabel = (stackType: string) => {
    switch (stackType) {
      case 'QB_WR': return 'QB + WR';
      case 'QB_TE': return 'QB + TE';
      case 'RB_DEF': return 'RB + DEF';
      default: return stackType.replace('_', ' + ');
    }
  };

  const getPlayerName = (playerId: string) => {
    const player = availablePlayers.find(p => p.id === playerId);
    return player?.name || 'Unknown Player';
  };

  const hasAnyAlerts = alerts.lastChanceTargets.length > 0 || 
                      alerts.stackingOpportunities.length > 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Target className="h-5 w-5 text-red-600" />
        <h4 className="font-semibold text-gray-900">Target Alerts</h4>
      </div>

      {!hasAnyAlerts && (
        <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-center">
          <p className="text-sm text-gray-600">No critical targets or stacking opportunities</p>
        </div>
      )}

      {/* Last Chance Targets */}
      {alerts.lastChanceTargets.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-sm font-medium text-gray-700 flex items-center gap-1">
            <Clock className="h-4 w-4" />
            Last Chance Targets
          </h5>
          
          <div className="space-y-2">
            {alerts.lastChanceTargets.map((target, index) => (
              <div 
                key={`${target.playerId}-${index}`}
                className={`p-3 rounded-md border ${getPriorityColor(target.priority)}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{target.playerName}</span>
                      <span className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded">
                        {target.position}
                      </span>
                      {target.priority === 'Must_Draft' && (
                        <AlertCircle className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                    <p className="text-xs text-gray-700 mb-2">{target.explanation}</p>
                    
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <Clock className="h-3 w-3" />
                      <span>
                        {target.roundsLeft === 1 
                          ? 'Last round to draft' 
                          : `${target.roundsLeft} rounds left`
                        }
                      </span>
                    </div>
                  </div>
                  
                  <span className="text-xs font-medium px-2 py-1 rounded">
                    {target.priority.replace('_', ' ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stacking Opportunities */}
      {alerts.stackingOpportunities.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-sm font-medium text-gray-700 flex items-center gap-1">
            <Link className="h-4 w-4" />
            Stacking Opportunities
          </h5>
          
          <div className="space-y-2">
            {alerts.stackingOpportunities.map((stack, index) => (
              <div 
                key={`${stack.primaryPlayerId}-${stack.stackPlayerId}-${index}`}
                className="p-3 bg-blue-50 border border-blue-200 rounded-md"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium">
                        {getPlayerName(stack.primaryPlayerId)} + {getPlayerName(stack.stackPlayerId)}
                      </span>
                      <span className="px-2 py-1 text-xs bg-blue-200 text-blue-700 rounded">
                        {getStackTypeLabel(stack.stackType)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-700 mb-2">{stack.explanation}</p>
                    
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 text-xs text-gray-600">
                        <span>Stack Value:</span>
                        <div className="flex items-center">
                          <div className="w-12 h-2 bg-gray-200 rounded-full mr-1">
                            <div 
                              className="h-2 bg-blue-500 rounded-full transition-all"
                              style={{ width: `${stack.value * 100}%` }}
                            ></div>
                          </div>
                          <span className="font-medium">{Math.round(stack.value * 100)}%</span>
                        </div>
                      </div>
                    </div>
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