import React from 'react';
import { calculateReachProbability } from '../../utils/reachProbability';
import type { Player, DraftState } from '../../types';

interface ProbabilityDisplayProps {
  player: Player;
  draftState: DraftState;
  size?: 'small' | 'medium' | 'large';
  showRisk?: boolean;
}

export const ProbabilityDisplay: React.FC<ProbabilityDisplayProps> = ({ 
  player, 
  draftState, 
  size = 'small',
  showRisk = false 
}) => {
  const reachProb = calculateReachProbability(player, draftState);
  
  const sizeClasses = {
    small: 'text-xs px-1.5 py-0.5',
    medium: 'text-sm px-2 py-1',
    large: 'text-base px-3 py-1.5'
  };
  
  const getColorClasses = (probability: number) => {
    if (probability >= 75) return 'bg-green-100 text-green-800 border-green-200';
    if (probability >= 45) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-red-100 text-red-800 border-red-200';
  };
  
  const getRiskColorClasses = (riskLevel: string) => {
    if (riskLevel === 'Low') return 'bg-green-100 text-green-800';
    if (riskLevel === 'Medium') return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <div className="flex items-center gap-1">
      {/* Next Pick Probability */}
      <span 
        className={`inline-flex items-center rounded border font-medium ${sizeClasses[size]} ${getColorClasses(reachProb.nextPickProbability)}`}
        title={`Next pick: ${reachProb.nextPickProbability}% - ${reachProb.reasoning}`}
      >
        <span className="text-xs opacity-75 mr-1">Next:</span>
        {reachProb.nextPickProbability}%
      </span>
      
      {/* Following Pick Probability */}
      <span 
        className={`inline-flex items-center rounded border font-medium ${sizeClasses[size]} ${getColorClasses(reachProb.followingPickProbability)}`}
        title={`Following pick: ${reachProb.followingPickProbability}% - ${reachProb.reasoning}`}
      >
        <span className="text-xs opacity-75 mr-1">After:</span>
        {reachProb.followingPickProbability}%
      </span>
      
      {showRisk && (
        <span 
          className={`inline-flex items-center rounded font-medium ${sizeClasses[size]} ${getRiskColorClasses(reachProb.riskLevel)}`}
        >
          {reachProb.riskLevel}
        </span>
      )}
    </div>
  );
};

export default ProbabilityDisplay;