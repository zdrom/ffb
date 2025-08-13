import React, { useMemo } from 'react';
import { useDraft } from '../../contexts/DraftContext';
import type { DraftPick } from '../../types';

interface PickEvaluation {
  pick: DraftPick;
  isGoodPick: boolean;
  vorpScore: number;
  expectedVorp: number;
  pickGrade: 'Excellent' | 'Good' | 'Average' | 'Poor' | 'Terrible';
  reasoning: string;
}

export const DraftHistory: React.FC = () => {
  const { state } = useDraft();

  const evaluatedPicks = useMemo(() => {
    return state.picks
      .filter(pick => pick.player)
      .map(pick => evaluatePick(pick))
      .sort((a, b) => a.pick.overall - b.pick.overall);
  }, [state.picks]);

  const gradeStats = useMemo(() => {
    const stats = evaluatedPicks.reduce((acc, pick) => {
      acc[pick.pickGrade] = (acc[pick.pickGrade] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return stats;
  }, [evaluatedPicks]);

  if (state.picks.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Draft History</h2>
        <p className="text-gray-500">No picks have been made yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-xl font-bold text-gray-900">Draft History</h2>
        <div className="mt-4 flex flex-wrap gap-4">
          {Object.entries(gradeStats).map(([grade, count]) => (
            <div key={grade} className="text-sm">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getGradeColor(grade as 'Excellent' | 'Good' | 'Average' | 'Poor' | 'Terrible')}`}>
                {grade}: {count}
              </span>
            </div>
          ))}
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pick</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Player</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Team</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Position</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">VORP</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Grade</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Analysis</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {evaluatedPicks.map((evaluation) => (
              <tr key={evaluation.pick.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {evaluation.pick.round}.{evaluation.pick.pick} ({evaluation.pick.overall})
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{evaluation.pick.player?.name}</div>
                  <div className="text-sm text-gray-500">{evaluation.pick.player?.team}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {state.teams.find(t => t.id === evaluation.pick.team)?.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {evaluation.pick.player?.position}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {evaluation.vorpScore !== undefined ? evaluation.vorpScore.toFixed(1) : 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getGradeColor(evaluation.pickGrade)}`}>
                    {evaluation.pickGrade}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-900 max-w-xs">
                  {evaluation.reasoning}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

function evaluatePick(pick: DraftPick): PickEvaluation {
  if (!pick.player) {
    return {
      pick,
      isGoodPick: false,
      vorpScore: 0,
      expectedVorp: 0,
      pickGrade: 'Poor',
      reasoning: 'No player data available'
    };
  }

  const playerVorp = pick.player.vorp || 0;
  
  // Calculate expected VORP based on position and pick number
  const expectedVorp = calculateExpectedVorp(pick.overall, pick.player.position);
  
  // Determine if it's a good pick based on VORP comparison
  const vorpDiff = playerVorp - expectedVorp;
  const isGoodPick = vorpDiff > 0;
  
  // Grade the pick
  let pickGrade: 'Excellent' | 'Good' | 'Average' | 'Poor' | 'Terrible';
  let reasoning: string;
  
  if (vorpDiff > 5) {
    pickGrade = 'Excellent';
    reasoning = `Outstanding value! VORP ${vorpDiff.toFixed(1)} points above expected for this pick.`;
  } else if (vorpDiff > 2) {
    pickGrade = 'Good';
    reasoning = `Good value with VORP ${vorpDiff.toFixed(1)} points above expected.`;
  } else if (vorpDiff > -2) {
    pickGrade = 'Average';
    reasoning = `Fair pick, VORP roughly matches expected value (${vorpDiff.toFixed(1)}).`;
  } else if (vorpDiff > -5) {
    pickGrade = 'Poor';
    reasoning = `Below expected value with VORP ${Math.abs(vorpDiff).toFixed(1)} points under expected.`;
  } else {
    pickGrade = 'Terrible';
    reasoning = `Significant reach! VORP ${Math.abs(vorpDiff).toFixed(1)} points below expected value.`;
  }

  return {
    pick,
    isGoodPick,
    vorpScore: playerVorp,
    expectedVorp,
    pickGrade,
    reasoning
  };
}

function calculateExpectedVorp(pickNumber: number, position: string): number {
  // Base VORP expectations by position and pick tier
  const baseVorp: Record<string, number[]> = {
    QB: [15, 12, 8, 5, 2, 0, -2, -4], // Rounds 1-8+
    RB: [18, 15, 10, 6, 3, 0, -3, -5],
    WR: [16, 13, 9, 5, 2, -1, -3, -5],
    TE: [12, 8, 4, 1, -2, -4, -6, -8],
    K: [1, 0, -1, -2, -3, -4, -5, -6],
    DEF: [3, 2, 0, -1, -2, -3, -4, -5]
  };

  const round = Math.ceil(pickNumber / 12); // Assuming 12-team league
  const tierIndex = Math.min(round - 1, 7); // Cap at index 7
  
  return baseVorp[position]?.[tierIndex] || 0;
}

function getGradeColor(grade: 'Excellent' | 'Good' | 'Average' | 'Poor' | 'Terrible'): string {
  switch (grade) {
    case 'Excellent':
      return 'bg-green-100 text-green-800';
    case 'Good':
      return 'bg-blue-100 text-blue-800';
    case 'Average':
      return 'bg-gray-100 text-gray-800';
    case 'Poor':
      return 'bg-orange-100 text-orange-800';
    case 'Terrible':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}