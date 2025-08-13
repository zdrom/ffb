import React from 'react';
import { BarChart3, Trophy } from 'lucide-react';

interface PlayerImportProps {
  onComplete: () => void;
}

const PlayerImport: React.FC<PlayerImportProps> = ({ onComplete }) => {
  return (
    <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-6">
      <div className="border-b border-gray-200 pb-4 mb-6">
        <div className="flex items-center mb-2">
          <Trophy className="h-6 w-6 text-blue-600 mr-2" />
          <h1 className="text-2xl font-bold text-gray-900">VORP Rankings Required</h1>
        </div>
        <p className="text-gray-600">
          VORP rankings are now managed globally. Set them up once and use across all drafts.
        </p>
      </div>

      <div className="text-center py-12">
        <Trophy className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">No Global VORP Rankings Found</h2>
        <p className="text-gray-600 mb-6">
          Click the "VORP Rankings" button in the header to set up your player rankings.
        </p>
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-yellow-800 text-sm">
            <strong>Note:</strong> This step only appears when no global VORP rankings exist. 
            Once you set them up, you'll skip straight to the draft after configuring league settings.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PlayerImport;