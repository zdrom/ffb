import { useMemo } from 'react';
import { useDraft } from '../../contexts/DraftContext';
import { generateHandcuffRecommendations } from '../../utils/handcuffs';
import { ProbabilityDisplay } from '../common/ProbabilityDisplay';
import { Users, AlertTriangle } from 'lucide-react';

const HandcuffRecommendations = () => {
  const { state } = useDraft();
  
  const userTeam = state.teams.find(team => team.isUser);
  const draftedPlayers = state.picks.map(pick => pick.player).filter((player): player is NonNullable<typeof player> => Boolean(player));
  const availablePlayers = state.players.filter(player => !player.isDrafted);
  
  const handcuffRecommendations = useMemo(() => {
    if (!userTeam) return [];
    return generateHandcuffRecommendations(draftedPlayers, availablePlayers, userTeam.id);
  }, [draftedPlayers, availablePlayers, userTeam]);

  if (handcuffRecommendations.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center mb-3">
          <Users className="h-5 w-5 text-gray-600 mr-2" />
          <h3 className="text-lg font-semibold text-gray-900">Handcuff Recommendations</h3>
        </div>
        <p className="text-sm text-gray-500">
          No handcuff recommendations available yet. Draft some skill position players to see backup options.
        </p>
      </div>
    );
  }

  const getPriorityColor = (priority: 'High' | 'Medium' | 'Low') => {
    switch (priority) {
      case 'High': return 'text-red-600 bg-red-50';
      case 'Medium': return 'text-yellow-600 bg-yellow-50';
      case 'Low': return 'text-gray-600 bg-gray-50';
    }
  };

  const getTypeIcon = (type: 'Direct' | 'Committee' | 'Insurance') => {
    switch (type) {
      case 'Direct': return '🎯';
      case 'Committee': return '🔄';
      case 'Insurance': return '🛡️';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <Users className="h-5 w-5 text-blue-600 mr-2" />
          <h3 className="text-lg font-semibold text-gray-900">Handcuff Recommendations</h3>
        </div>
        <span className="text-xs text-gray-500">Protect your investments</span>
      </div>

      <div className="space-y-4">
        {handcuffRecommendations.map((recommendation) => (
          <div key={recommendation.primaryPlayer.id} className="border border-gray-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center">
                <span className="font-medium text-gray-900">
                  {recommendation.primaryPlayer.name}
                </span>
                <span className="text-xs text-gray-500 ml-2">
                  ({recommendation.primaryPlayer.position} - {recommendation.primaryPlayer.team})
                </span>
              </div>
              {recommendation.handcuffs.some(h => h.priority === 'High') && (
                <AlertTriangle className="h-4 w-4 text-red-500" />
              )}
            </div>
            
            <div className="space-y-2">
              {recommendation.handcuffs.map((handcuff, index) => (
                <div key={index} className="flex items-center justify-between bg-gray-50 rounded p-2">
                  <div className="flex items-center">
                    <span className="text-sm mr-2">{getTypeIcon(handcuff.type)}</span>
                    <div>
                      <div className="flex items-center">
                        <span className="font-medium text-sm text-gray-900">
                          {handcuff.player.name}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded-full ml-2 ${getPriorityColor(handcuff.priority)}`}>
                          {handcuff.priority}
                        </span>
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        ADP: {handcuff.player.adp.toFixed(1)} • {handcuff.reasoning}
                      </div>
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <div className="text-xs text-gray-500">Tier {handcuff.player.tier}</div>
                    {handcuff.player.vorp && (
                      <div className="text-xs text-blue-600">VORP: {handcuff.player.vorp.toFixed(1)}</div>
                    )}
                    <ProbabilityDisplay 
                      player={handcuff.player} 
                      draftState={state} 
                      size="small"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
        <div className="flex items-start">
          <div className="text-xs text-blue-800">
            <div className="font-medium mb-1">Handcuff Types:</div>
            <div className="space-y-1">
              <div>🎯 <strong>Direct:</strong> Clear primary backup</div>
              <div>🔄 <strong>Committee:</strong> Shares role in timeshare</div>
              <div>🛡️ <strong>Insurance:</strong> Depth option for injury protection</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HandcuffRecommendations;