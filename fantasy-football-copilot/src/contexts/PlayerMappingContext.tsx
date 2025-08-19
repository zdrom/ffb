import React, { createContext, useContext, useState, useCallback } from 'react';
import type { Player } from '../types';
import { PlayerMappingPopup } from '../components/PlayerMappingPopup';

interface MappingRequest {
  unmappedPlayerName: string;
  resolve: (player: Player | null) => void;
}

interface PlayerMappingContextType {
  showMappingPopup: (playerName: string) => Promise<Player | null>;
}

const PlayerMappingContext = createContext<PlayerMappingContextType | null>(null);

export const PlayerMappingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentRequest, setCurrentRequest] = useState<MappingRequest | null>(null);

  const showMappingPopup = useCallback((playerName: string): Promise<Player | null> => {
    return new Promise((resolve) => {
      setCurrentRequest({
        unmappedPlayerName: playerName,
        resolve
      });
    });
  }, []);

  const handleMap = useCallback((player: Player) => {
    if (currentRequest) {
      currentRequest.resolve(player);
      setCurrentRequest(null);
    }
  }, [currentRequest]);

  const handleSkip = useCallback(() => {
    if (currentRequest) {
      currentRequest.resolve(null);
      setCurrentRequest(null);
    }
  }, [currentRequest]);

  const handleClose = useCallback(() => {
    if (currentRequest) {
      currentRequest.resolve(null);
      setCurrentRequest(null);
    }
  }, [currentRequest]);

  return (
    <PlayerMappingContext.Provider value={{ showMappingPopup }}>
      {children}
      {currentRequest && (
        <PlayerMappingPopup
          unmappedPlayerName={currentRequest.unmappedPlayerName}
          onMap={handleMap}
          onSkip={handleSkip}
          onClose={handleClose}
        />
      )}
    </PlayerMappingContext.Provider>
  );
};

export const usePlayerMapping = () => {
  const context = useContext(PlayerMappingContext);
  if (!context) {
    throw new Error('usePlayerMapping must be used within a PlayerMappingProvider');
  }
  return context;
};