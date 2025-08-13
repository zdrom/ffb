import React from 'react';
import { Clock, Users, Target } from 'lucide-react';
import { useDraft } from '../../contexts/DraftContext';

const DraftStatus: React.FC = () => {
  const { state } = useDraft();
  const { currentPick, picksUntilMyTurn, settings } = state;
  
  const currentRound = Math.ceil(currentPick / settings.numberOfTeams);
  const pickInRound = ((currentPick - 1) % settings.numberOfTeams) + 1;
  const totalPicks = settings.numberOfTeams * settings.numberOfRounds;
  
  const isMyTurn = picksUntilMyTurn === 0 && state.isActive;
  
  return (
    <div className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-8">
          <div className="flex items-center space-x-2">
            <Clock className="h-5 w-5 text-gray-500" />
            <div>
              <div className="text-sm text-gray-500">Current Pick</div>
              <div className="font-semibold">
                Round {currentRound}, Pick {pickInRound} (Overall: {currentPick})
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Users className="h-5 w-5 text-gray-500" />
            <div>
              <div className="text-sm text-gray-500">Draft Progress</div>
              <div className="font-semibold">
                {currentPick - 1} / {totalPicks} picks made
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Target className={`h-5 w-5 ${isMyTurn ? 'text-green-500' : 'text-gray-500'}`} />
            <div>
              <div className="text-sm text-gray-500">My Turn</div>
              <div className={`font-semibold ${isMyTurn ? 'text-green-600' : 'text-gray-900'}`}>
                {isMyTurn ? 'Pick Now!' : `${picksUntilMyTurn} picks away`}
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          {state.isActive && (
            <div className="flex items-center space-x-2">
              <div className="h-3 w-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-green-600">Draft Active</span>
            </div>
          )}
          
          <div className="text-right">
            <div className="text-sm text-gray-500">Your Draft Slot</div>
            <div className="font-semibold text-lg">#{settings.draftSlot}</div>
          </div>
        </div>
      </div>
      
      {isMyTurn && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Target className="h-5 w-5 text-green-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-green-800">
                It's your turn to pick! Select a player from the recommendations or player list.
              </p>
            </div>
          </div>
        </div>
      )}
      
      <div className="mt-4">
        <div className="bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentPick - 1) / totalPicks) * 100}%` }}
          ></div>
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>Draft Start</span>
          <span>{Math.round(((currentPick - 1) / totalPicks) * 100)}% Complete</span>
          <span>Draft End</span>
        </div>
      </div>
    </div>
  );
};

export default DraftStatus;