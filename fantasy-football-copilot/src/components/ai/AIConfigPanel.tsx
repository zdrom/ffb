import { useState } from 'react';
import { useAIConfig } from '../../hooks/useAIStrategy';
import { Settings, Key, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';

export function AIConfigPanel() {
  const { apiKey, isConfigured, updateApiKey } = useAIConfig();
  const [inputKey, setInputKey] = useState(apiKey);
  const [showKey, setShowKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      updateApiKey(inputKey);
      // In a real app, you might want to validate the key here
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate validation
    } catch (error) {
      console.error('Failed to save API key:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const maskKey = (key: string) => {
    if (key.length <= 8) return key;
    return key.slice(0, 6) + '...' + key.slice(-4);
  };

  return (
    <div className="space-y-4">
      {!isConfigured && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">AI Assistant Not Configured</p>
              <p className="text-xs text-amber-700 mt-1">
                Add your OpenAI API key to enable AI-powered draft recommendations.
              </p>
            </div>
          </div>
        </div>
      )}

      {isConfigured && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <p className="text-sm font-medium text-green-800">AI Assistant Ready</p>
          </div>
          <p className="text-xs text-green-700 mt-1">
            Using API key: {maskKey(apiKey)}
          </p>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4 text-gray-600" />
          <h5 className="font-medium text-gray-900">Configuration</h5>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            OpenAI API Key
          </label>
          
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                placeholder="sk-..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
                aria-label={showKey ? 'Hide key' : 'Show key'}
              >
                {showKey ? '🙈' : '👁️'}
              </button>
            </div>
            
            <button
              onClick={handleSave}
              disabled={isSaving || inputKey === apiKey}
              className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>

          <div className="flex items-start gap-2 mt-2">
            <Key className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-gray-600">
              <p>Your API key is stored locally and never sent to our servers.</p>
              <div className="flex items-center gap-1 mt-1">
                <span>Don't have an API key?</span>
                <a 
                  href="https://platform.openai.com/api-keys" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 underline flex items-center gap-1"
                >
                  Get one here
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Usage Information */}
        <div className="p-3 bg-gray-50 rounded-lg">
          <h6 className="text-sm font-medium text-gray-900 mb-2">About AI Recommendations</h6>
          <ul className="text-xs text-gray-600 space-y-1">
            <li>• Analyzes your roster, available players, and VORP data</li>
            <li>• Provides top-5 pick recommendations with explanations</li>
            <li>• Shows probability of players being available at your next pick</li>
            <li>• Alerts you to roster imbalances and tier cliffs</li>
            <li>• Identifies last-chance targets and stacking opportunities</li>
          </ul>
        </div>

        {/* Cost Warning */}
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-blue-700">
              <p className="font-medium">API Usage Notice</p>
              <p className="mt-1">
                Each AI recommendation costs approximately $0.01-0.03 in OpenAI credits. 
                Refresh manually to control costs.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}