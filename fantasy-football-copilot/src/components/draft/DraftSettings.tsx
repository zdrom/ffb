import React, { useState, useEffect } from 'react';
import { useDraft } from '../../contexts/DraftContext';
import { loadGlobalVORPRankings, hasGlobalVORPRankings, getGlobalVORPMetadata } from '../../utils/globalVORPStorage';
import type { DraftSettings as DraftSettingsType, CustomScoring, PositionLimits } from '../../types';

const getDefaultCustomScoring = (): CustomScoring => ({
  passing: {
    yards: 0.04,
    touchdowns: 4,
    interceptions: -1,
    twoPointConversions: 2
  },
  rushing: {
    yards: 0.1,
    touchdowns: 6,
    twoPointConversions: 2
  },
  receiving: {
    receptions: 0.5,
    yards: 0.1,
    touchdowns: 6,
    twoPointConversions: 2
  },
  misc: {
    fumblesLost: -2,
    returnTouchdowns: 6
  },
  kicking: {
    fg0to19: 3,
    fg20to29: 3,
    fg30to39: 3,
    fg40to49: 4,
    fg50plus: 5,
    patMade: 1
  },
  defense: {
    sack: 1,
    interception: 2,
    fumbleRecovery: 2,
    touchdown: 6,
    safety: 2,
    blockKick: 2,
    returnTouchdown: 6,
    extraPointReturned: 2
  }
});

const getDefaultPositionLimits = (): PositionLimits => ({
  QB: 4,
  RB: 6,
  WR: 8,
  TE: 4,
  K: 4,
  DEF: 4
});

interface DraftSettingsProps {
  onComplete: () => void;
}

const DraftSettings: React.FC<DraftSettingsProps> = ({ onComplete }) => {
  const { state, dispatch } = useDraft();
  const [settings, setSettings] = useState<DraftSettingsType>({
    ...state.settings,
    teamNames: state.settings.teamNames || Array.from({ length: state.settings.numberOfTeams }, (_, i) => `Pick ${i + 1}`),
    customScoring: {
      ...getDefaultCustomScoring(),
      ...state.settings.customScoring
    },
    positionLimits: {
      ...getDefaultPositionLimits(),
      ...state.settings.positionLimits
    }
  });
  const [activeTab, setActiveTab] = useState<'basic' | 'scoring' | 'limits'>('basic');
  const [vorpMetadata, setVorpMetadata] = useState(getGlobalVORPMetadata());

  // Update team names when number of teams changes - use Pick format for automatic detection
  useEffect(() => {
    const currentTeamCount = settings.teamNames.length;
    if (currentTeamCount !== settings.numberOfTeams) {
      const newTeamNames = Array.from({ length: settings.numberOfTeams }, (_, i) => `Pick ${i + 1}`);
      setSettings(prev => ({ ...prev, teamNames: newTeamNames }));
    }
  }, [settings.numberOfTeams]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Load global VORP rankings automatically if they exist
    const globalVORPData = loadGlobalVORPRankings();
    if (globalVORPData) {
      console.log(`Loading ${globalVORPData.players.length} VORP rankings from global storage`);
      dispatch({ type: 'LOAD_PLAYERS', payload: globalVORPData.players });
    }
    
    dispatch({ type: 'SET_SETTINGS', payload: settings });
    onComplete();
  };

  const updateSettings = (field: keyof DraftSettingsType, value: any) => {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const updateRosterSlots = (position: string, count: number) => {
    setSettings(prev => ({
      ...prev,
      rosterSlots: {
        ...prev.rosterSlots,
        [position]: count
      }
    }));
  };


  const updateCustomScoring = (category: keyof CustomScoring, field: string, value: number) => {
    setSettings(prev => ({
      ...prev,
      customScoring: {
        ...prev.customScoring!,
        [category]: {
          ...prev.customScoring![category],
          [field]: value
        }
      }
    }));
  };

  const updatePositionLimits = (position: keyof PositionLimits, limit: number) => {
    setSettings(prev => ({
      ...prev,
      positionLimits: {
        ...prev.positionLimits!,
        [position]: limit
      }
    }));
  };

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-6">
      <div className="border-b border-gray-200 pb-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">VORP Draft Setup</h1>
        <p className="text-gray-600 mt-1">Configure your league settings for VORP-based draft recommendations.</p>
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>VORP-Based System:</strong> This system uses exclusively VORP (Value Over Replacement Player) rankings for draft recommendations. 
            Scoring settings help calculate positional needs but do not affect VORP-based player rankings.
          </p>
        </div>
        <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-800">
            <strong>Automatic Team Detection:</strong> Team names and draft order are automatically learned from your Chrome extension. 
            Simply specify your draft position below and the system will handle the rest.
          </p>
        </div>
        
        {/* VORP Status Display */}
        {vorpMetadata ? (
          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>VORP Rankings Loaded:</strong> {vorpMetadata.playerCount.toLocaleString()} players, 
              last updated {new Date(vorpMetadata.lastUpdated).toLocaleDateString()}
            </p>
          </div>
        ) : (
          <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>No VORP Rankings:</strong> Click "VORP Rankings" in the header to set up your player rankings.
            </p>
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: 'basic', label: 'Basic Settings' },
            { key: 'scoring', label: 'Custom Scoring' },
            { key: 'limits', label: 'Position Limits' }
          ].map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic Settings Tab */}
        {activeTab === 'basic' && (
          <div className="space-y-6">
            <div className="space-y-6">
              {/* League Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    League Name
                  </label>
                  <input
                    type="text"
                    value={settings.leagueName}
                    onChange={(e) => updateSettings('leagueName', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter league name"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Scoring Type
                  </label>
                  <select
                    value={settings.scoringType}
                    onChange={(e) => updateSettings('scoringType', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="PPR">PPR (Point Per Reception)</option>
                    <option value="Half-PPR">Half PPR (0.5 PPR)</option>
                    <option value="Standard">Standard (No PPR)</option>
                    <option value="Custom">Custom Scoring</option>
                  </select>
                </div>
              </div>

              {/* Draft Configuration */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Draft Configuration</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Number of Teams
                    </label>
                    <select
                      value={settings.numberOfTeams}
                      onChange={(e) => updateSettings('numberOfTeams', parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {[8, 10, 12, 14, 16].map(num => (
                        <option key={num} value={num}>{num} Teams</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Your Draft Position
                    </label>
                    <select
                      value={settings.draftSlot}
                      onChange={(e) => updateSettings('draftSlot', parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {Array.from({ length: settings.numberOfTeams }, (_, i) => (
                        <option key={i + 1} value={i + 1}>Pick #{i + 1}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Number of Rounds
                    </label>
                    <input
                      type="number"
                      value={settings.numberOfRounds}
                      onChange={(e) => updateSettings('numberOfRounds', parseInt(e.target.value))}
                      min="10"
                      max="20"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Draft Type
                    </label>
                    <select
                      value={settings.draftType}
                      onChange={(e) => updateSettings('draftType', e.target.value as 'Snake' | 'Linear')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="Snake">Snake Draft</option>
                      <option value="Linear">Linear Draft</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Roster Configuration</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(settings.rosterSlots).map(([position, count]) => (
              <div key={position}>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {position === 'DEF' ? 'Defense' : position}
                </label>
                <input
                  type="number"
                  value={count}
                  onChange={(e) => updateRosterSlots(position, parseInt(e.target.value))}
                  min="0"
                  max="5"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            ))}
          </div>
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-sm text-blue-800">
                  <strong>Total Roster Slots:</strong> {Object.values(settings.rosterSlots).reduce((sum, count) => sum + count, 0)}
                </p>
              </div>
            </div>
          </div>
        )}


        {/* Custom Scoring Tab */}
        {activeTab === 'scoring' && settings.customScoring && (
          <div className="space-y-8">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Custom Scoring Settings</h3>
            
            {/* Passing */}
            <div>
              <h4 className="text-md font-medium text-gray-800 mb-3">Passing</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Passing Yards</label>
                  <input
                    type="number"
                    step="0.01"
                    value={settings.customScoring.passing.yards}
                    onChange={(e) => updateCustomScoring('passing', 'yards', parseFloat(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Passing TDs</label>
                  <input
                    type="number"
                    value={settings.customScoring.passing.touchdowns}
                    onChange={(e) => updateCustomScoring('passing', 'touchdowns', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Interceptions</label>
                  <input
                    type="number"
                    value={settings.customScoring.passing.interceptions}
                    onChange={(e) => updateCustomScoring('passing', 'interceptions', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">2-Point Conversions</label>
                  <input
                    type="number"
                    value={settings.customScoring.passing.twoPointConversions}
                    onChange={(e) => updateCustomScoring('passing', 'twoPointConversions', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Rushing */}
            <div>
              <h4 className="text-md font-medium text-gray-800 mb-3">Rushing</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Rushing Yards</label>
                  <input
                    type="number"
                    step="0.01"
                    value={settings.customScoring.rushing.yards}
                    onChange={(e) => updateCustomScoring('rushing', 'yards', parseFloat(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Rushing TDs</label>
                  <input
                    type="number"
                    value={settings.customScoring.rushing.touchdowns}
                    onChange={(e) => updateCustomScoring('rushing', 'touchdowns', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">2-Point Conversions</label>
                  <input
                    type="number"
                    value={settings.customScoring.rushing.twoPointConversions}
                    onChange={(e) => updateCustomScoring('rushing', 'twoPointConversions', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Receiving */}
            <div>
              <h4 className="text-md font-medium text-gray-800 mb-3">Receiving</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Receptions</label>
                  <input
                    type="number"
                    step="0.1"
                    value={settings.customScoring.receiving.receptions}
                    onChange={(e) => updateCustomScoring('receiving', 'receptions', parseFloat(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Receiving Yards</label>
                  <input
                    type="number"
                    step="0.01"
                    value={settings.customScoring.receiving.yards}
                    onChange={(e) => updateCustomScoring('receiving', 'yards', parseFloat(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Receiving TDs</label>
                  <input
                    type="number"
                    value={settings.customScoring.receiving.touchdowns}
                    onChange={(e) => updateCustomScoring('receiving', 'touchdowns', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">2-Point Conversions</label>
                  <input
                    type="number"
                    value={settings.customScoring.receiving.twoPointConversions}
                    onChange={(e) => updateCustomScoring('receiving', 'twoPointConversions', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Kicking */}
            <div>
              <h4 className="text-md font-medium text-gray-800 mb-3">Kicking</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">FG 0-19</label>
                  <input
                    type="number"
                    value={settings.customScoring.kicking.fg0to19}
                    onChange={(e) => updateCustomScoring('kicking', 'fg0to19', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">FG 20-29</label>
                  <input
                    type="number"
                    value={settings.customScoring.kicking.fg20to29}
                    onChange={(e) => updateCustomScoring('kicking', 'fg20to29', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">FG 30-39</label>
                  <input
                    type="number"
                    value={settings.customScoring.kicking.fg30to39}
                    onChange={(e) => updateCustomScoring('kicking', 'fg30to39', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">FG 40-49</label>
                  <input
                    type="number"
                    value={settings.customScoring.kicking.fg40to49}
                    onChange={(e) => updateCustomScoring('kicking', 'fg40to49', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">FG 50+</label>
                  <input
                    type="number"
                    value={settings.customScoring.kicking.fg50plus}
                    onChange={(e) => updateCustomScoring('kicking', 'fg50plus', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">PAT Made</label>
                  <input
                    type="number"
                    value={settings.customScoring.kicking.patMade}
                    onChange={(e) => updateCustomScoring('kicking', 'patMade', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Defense */}
            <div>
              <h4 className="text-md font-medium text-gray-800 mb-3">Defense/Special Teams</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Sacks</label>
                  <input
                    type="number"
                    value={settings.customScoring.defense.sack}
                    onChange={(e) => updateCustomScoring('defense', 'sack', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Interceptions</label>
                  <input
                    type="number"
                    value={settings.customScoring.defense.interception}
                    onChange={(e) => updateCustomScoring('defense', 'interception', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Fumble Recovery</label>
                  <input
                    type="number"
                    value={settings.customScoring.defense.fumbleRecovery}
                    onChange={(e) => updateCustomScoring('defense', 'fumbleRecovery', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Touchdowns</label>
                  <input
                    type="number"
                    value={settings.customScoring.defense.touchdown}
                    onChange={(e) => updateCustomScoring('defense', 'touchdown', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Safeties</label>
                  <input
                    type="number"
                    value={settings.customScoring.defense.safety}
                    onChange={(e) => updateCustomScoring('defense', 'safety', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Block Kick</label>
                  <input
                    type="number"
                    value={settings.customScoring.defense.blockKick}
                    onChange={(e) => updateCustomScoring('defense', 'blockKick', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Return TDs</label>
                  <input
                    type="number"
                    value={settings.customScoring.defense.returnTouchdown}
                    onChange={(e) => updateCustomScoring('defense', 'returnTouchdown', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">XP Returned</label>
                  <input
                    type="number"
                    value={settings.customScoring.defense.extraPointReturned}
                    onChange={(e) => updateCustomScoring('defense', 'extraPointReturned', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Misc */}
            <div>
              <h4 className="text-md font-medium text-gray-800 mb-3">Misc</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Fumbles Lost</label>
                  <input
                    type="number"
                    value={settings.customScoring.misc.fumblesLost}
                    onChange={(e) => updateCustomScoring('misc', 'fumblesLost', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Return TDs</label>
                  <input
                    type="number"
                    value={settings.customScoring.misc.returnTouchdowns}
                    onChange={(e) => updateCustomScoring('misc', 'returnTouchdowns', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Position Limits Tab */}
        {activeTab === 'limits' && settings.positionLimits && (
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Position Limits</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {Object.entries(settings.positionLimits).map(([position, limit]) => (
                <div key={position}>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {position === 'DEF' ? 'Defense' : position} Max
                  </label>
                  <input
                    type="number"
                    value={limit}
                    onChange={(e) => updatePositionLimits(position as any, parseInt(e.target.value))}
                    min="1"
                    max="15"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-md">
              <p className="text-sm text-gray-600">
                Position limits determine the maximum number of players you can draft at each position.
              </p>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center pt-6 border-t border-gray-200">
          <div className="text-sm text-gray-600">
            Draft will have {settings.numberOfTeams * settings.numberOfRounds} total picks
          </div>
          <button
            type="submit"
            disabled={!vorpMetadata}
            className={`px-6 py-3 font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${
              vorpMetadata 
                ? 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500' 
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {vorpMetadata ? 'Start Draft' : 'Set VORP Rankings First'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default DraftSettings;