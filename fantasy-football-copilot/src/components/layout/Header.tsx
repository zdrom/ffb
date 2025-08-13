import React from 'react';
import { Settings, Download, Upload, RotateCcw, BarChart3, Trophy } from 'lucide-react';

interface HeaderProps {
  onSettingsClick: () => void;
  onVORPSettingsClick: () => void;
  onImportClick: () => void;
  onExportClick: () => void;
  onResetClick: () => void;
  leagueName?: string;
}

const Header: React.FC<HeaderProps> = ({
  onSettingsClick,
  onVORPSettingsClick,
  onImportClick,
  onExportClick,
  onResetClick,
  leagueName
}) => {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <BarChart3 className="h-8 w-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">
              VORP Draft Assistant
            </h1>
          </div>
          {leagueName && (
            <span className="text-lg text-gray-600 font-medium">
              {leagueName}
            </span>
          )}
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={onVORPSettingsClick}
            className="inline-flex items-center px-3 py-2 border border-blue-300 shadow-sm text-sm leading-4 font-medium rounded-md text-blue-700 bg-blue-50 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <Trophy className="h-4 w-4 mr-2" />
            VORP Rankings
          </button>
          
          <button
            onClick={onImportClick}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <Upload className="h-4 w-4 mr-2" />
            Import
          </button>
          
          <button
            onClick={onExportClick}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </button>
          
          <button
            onClick={onResetClick}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </button>
          
          <button
            onClick={onSettingsClick}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;