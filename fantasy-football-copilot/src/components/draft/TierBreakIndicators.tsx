import React, { useMemo } from 'react';
import { AlertTriangle, TrendingDown, Info } from 'lucide-react';
import { useDraft } from '../../contexts/DraftContext';
import { DynamicVORPEngine } from '../../utils/dynamicVORP';
import type { Position } from '../../types';

interface TierBreak {
  position: Position;
  playersBeforeBreak: number;
  vorpDropOff: number;
  nextTierAverageVORP: number;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  recommendation: string;
}

const TierBreakIndicators: React.FC = () => {
  const { state } = useDraft();
  
  const tierBreaks = useMemo(() => {
    const positions: Position[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
    const vorpEngine = new DynamicVORPEngine(state.players, state.settings, state.teams);
    const breaks: TierBreak[] = [];
    
    positions.forEach(position => {
      const availablePlayers = state.players
        .filter(p => p.position === position && !p.isDrafted && !p.isDoNotDraft)
        .map(p => ({
          ...p,
          calculatedVORP: vorpEngine.calculateDynamicVORP(p)
        }))
        .sort((a, b) => b.calculatedVORP - a.calculatedVORP);

      // Find significant VORP drops
      for (let i = 0; i < Math.min(availablePlayers.length - 3, 10); i++) {
        const currentPlayer = availablePlayers[i];
        const nextPlayers = availablePlayers.slice(i + 1, i + 4);
        
        if (nextPlayers.length === 0) continue;
        
        const avgNextVORP = nextPlayers.reduce((sum, p) => sum + p.calculatedVORP, 0) / nextPlayers.length;
        const vorpDrop = currentPlayer.calculatedVORP - avgNextVORP;
        const dropPercentage = vorpDrop / Math.max(currentPlayer.calculatedVORP, 1);
        
        // Significant drop detected
        if (vorpDrop > 15 && dropPercentage > 0.2) {
          let severity: TierBreak['severity'];
          let recommendation: string;
          
          if (i <= 2 && vorpDrop > 30) {
            severity = 'Critical';
            recommendation = `Must draft a ${position} in next ${i + 1} player${i === 0 ? '' : 's'} to avoid major tier drop`;
          } else if (i <= 4 && vorpDrop > 20) {
            severity = 'High';
            recommendation = `Strong consideration for ${position} in next ${i + 1} players`;
          } else if (i <= 6 && vorpDrop > 15) {
            severity = 'Medium';
            recommendation = `Consider ${position} before ${i + 1} players are taken`;
          } else {
            severity = 'Low';
            recommendation = `Minor tier break after ${i + 1} players`;
          }
          
          breaks.push({
            position,
            playersBeforeBreak: i + 1,
            vorpDropOff: vorpDrop,
            nextTierAverageVORP: avgNextVORP,
            severity,
            recommendation
          });
          
          break; // Only show the most immediate tier break per position
        }
      }
    });
    
    return breaks.sort((a, b) => {
      const severityOrder = { 'Critical': 0, 'High': 1, 'Medium': 2, 'Low': 3 };
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;
      return a.playersBeforeBreak - b.playersBeforeBreak;
    });
  }, [state.players, state.settings, state.teams]);

  const getSeverityColor = (severity: TierBreak['severity']) => {
    const colors = {
      Critical: 'border-red-500 bg-red-50 text-red-800',
      High: 'border-orange-500 bg-orange-50 text-orange-800',
      Medium: 'border-yellow-500 bg-yellow-50 text-yellow-800',
      Low: 'border-blue-500 bg-blue-50 text-blue-800'
    };
    return colors[severity];
  };

  const getSeverityIcon = (severity: TierBreak['severity']) => {
    switch (severity) {
      case 'Critical':
        return <AlertTriangle className="h-4 w-4" />;
      case 'High':
        return <TrendingDown className="h-4 w-4" />;
      case 'Medium':
        return <TrendingDown className="h-4 w-4" />;
      case 'Low':
        return <Info className="h-4 w-4" />;
    }
  };

  const getPositionColor = (position: Position) => {
    const colors: Record<Position, string> = {
      QB: 'bg-red-100 text-red-800',
      RB: 'bg-green-100 text-green-800',
      WR: 'bg-blue-100 text-blue-800',
      TE: 'bg-yellow-100 text-yellow-800',
      K: 'bg-purple-100 text-purple-800',
      DEF: 'bg-gray-100 text-gray-800'
    };
    return colors[position];
  };

  if (tierBreaks.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Tier Break Indicators</h3>
        <div className="text-center py-6">
          <Info className="h-8 w-8 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500 text-sm">No significant tier breaks detected</p>
          <p className="text-gray-400 text-xs mt-1">All positions have relatively even value distribution</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-4">
        <TrendingDown className="h-5 w-5 text-orange-600" />
        <h3 className="text-lg font-semibold text-gray-900">Tier Break Indicators</h3>
        <span className="bg-orange-100 text-orange-800 text-xs font-medium px-2 py-1 rounded-full">
          {tierBreaks.length}
        </span>
      </div>
      
      <div className="space-y-3">
        {tierBreaks.map((tierBreak, index) => (
          <div
            key={`${tierBreak.position}-${index}`}
            className={`p-3 rounded-lg border-2 ${getSeverityColor(tierBreak.severity)}`}
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                {getSeverityIcon(tierBreak.severity)}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getPositionColor(tierBreak.position)}`}>
                    {tierBreak.position}
                  </span>
                  <span className="font-semibold text-sm">
                    {tierBreak.severity} Tier Break
                  </span>
                </div>
                
                <p className="text-sm mb-2">{tierBreak.recommendation}</p>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="font-medium">Players before drop:</span> {tierBreak.playersBeforeBreak}
                  </div>
                  <div>
                    <span className="font-medium">VORP drop-off:</span> {tierBreak.vorpDropOff.toFixed(1)}
                  </div>
                  <div>
                    <span className="font-medium">Next tier avg VORP:</span> {tierBreak.nextTierAverageVORP.toFixed(1)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-4 p-3 bg-gray-50 rounded border text-xs text-gray-600">
        <div className="font-medium mb-1">Severity Levels:</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-red-600" />
            <span>Critical: Must draft</span>
          </div>
          <div className="flex items-center gap-1">
            <TrendingDown className="h-3 w-3 text-orange-600" />
            <span>High: Strong consideration</span>
          </div>
          <div className="flex items-center gap-1">
            <TrendingDown className="h-3 w-3 text-yellow-600" />
            <span>Medium: Consider soon</span>
          </div>
          <div className="flex items-center gap-1">
            <Info className="h-3 w-3 text-blue-600" />
            <span>Low: Minor drop</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TierBreakIndicators;