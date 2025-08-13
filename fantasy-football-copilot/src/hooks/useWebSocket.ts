import { useEffect, useRef, useState } from 'react';
import { useDraft } from '../contexts/DraftContext';
import { loadGlobalVORPRankings } from '../utils/globalVORPStorage';

export const useWebSocket = (url: string = 'ws://localhost:3001') => {
  const { state, dispatch } = useDraft();
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Helper function to ensure VORP players are loaded
  const ensureVORPPlayersLoaded = () => {
    if (state.players.length === 0) {
      console.log('No players loaded, attempting to load from global VORP rankings...');
      const globalVORPData = loadGlobalVORPRankings();
      if (globalVORPData && globalVORPData.players.length > 0) {
        console.log(`Auto-loading ${globalVORPData.players.length} VORP rankings for draft sync`);
        dispatch({ type: 'LOAD_PLAYERS', payload: globalVORPData.players });
        return globalVORPData.players; // Return the actual players data
      } else {
        console.error('No global VORP rankings found in storage');
        return null;
      }
    }
    return state.players; // Return existing players
  };

  const connect = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setConnectionStatus('connecting');
    
    try {
      wsRef.current = new WebSocket(url);

      wsRef.current.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setConnectionStatus('connected');
        
        // Clear any reconnection timeout
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('WebSocket message received:', data);
          
          if (data.type === 'draft_pick') {
            handleDraftPick(data.data);
          } else if (data.type === 'draft_sync') {
            handleDraftSync(data.data);
          } else if (data.type === 'draft_reset') {
            dispatch({ type: 'RESET_DRAFT' });
          } else if (data.type === 'connection') {
            console.log('Connection confirmed:', data);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      wsRef.current.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        setIsConnected(false);
        setConnectionStatus('disconnected');
        
        // Attempt to reconnect after 3 seconds
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('Attempting to reconnect...');
          connect();
        }, 3000);
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnected(false);
        setConnectionStatus('disconnected');
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setConnectionStatus('disconnected');
    }
  };

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setIsConnected(false);
    setConnectionStatus('disconnected');
  };

  const findPlayerByName = (playerName: string) => {
    // Try exact match first
    let player = state.players.find(p => 
      p.name.toLowerCase() === playerName.toLowerCase()
    );

    if (player) return player;

    // Try partial matches (both directions)
    player = state.players.find(p => 
      p.name.toLowerCase().includes(playerName.toLowerCase()) ||
      playerName.toLowerCase().includes(p.name.toLowerCase())
    );

    if (player) return player;

    // Try name variations (remove common suffixes, handle punctuation)
    const cleanPlayerName = playerName.toLowerCase()
      .replace(/[.']/g, '')
      .replace(/\s+jr\.?$/, '')
      .replace(/\s+sr\.?$/, '')
      .replace(/\s+iii?$/, '')
      .trim();

    player = state.players.find(p => {
      const cleanDBName = p.name.toLowerCase()
        .replace(/[.']/g, '')
        .replace(/\s+jr\.?$/, '')
        .replace(/\s+sr\.?$/, '')
        .replace(/\s+iii?$/, '')
        .trim();
      return cleanDBName === cleanPlayerName ||
             cleanDBName.includes(cleanPlayerName) ||
             cleanPlayerName.includes(cleanDBName);
    });

    return player;
  };

  const findTeamByName = (teamName: string) => {
    // Try exact match first
    let team = state.teams.find(t => 
      t.name.toLowerCase() === teamName.toLowerCase()
    );

    if (team) return team;

    // Try partial matches
    team = state.teams.find(t => 
      t.name.toLowerCase().includes(teamName.toLowerCase()) ||
      teamName.toLowerCase().includes(t.name.toLowerCase())
    );

    return team;
  };

  const handleDraftPick = (pickData: any) => {
    console.log('Processing draft pick from extension:', pickData);
    
    const players = ensureVORPPlayersLoaded();
    if (!players || players.length === 0) {
      alert('Please import your VORP rankings first before syncing draft picks.');
      return;
    }

    // Use the new automatic pick system
    dispatch({
      type: 'AUTO_MAKE_PICK',
      payload: {
        playerName: pickData.player,
        teamName: pickData.team,
        pickNumber: pickData.overall || pickData.pick || state.currentPick
      }
    });
  };

  const handleDraftSync = (syncData: any) => {
    console.log('Processing draft sync from extension:', syncData);
    console.log('Current player count in rankings:', state.players.length);
    
    if (!syncData.picks || !Array.isArray(syncData.picks)) {
      console.error('Invalid sync data format');
      return;
    }

    // Auto-load players if needed
    const players = ensureVORPPlayersLoaded();
    if (!players || players.length === 0) {
      alert('Please import your VORP rankings first before syncing draft picks.');
      return;
    }

    console.log(`Using ${players.length} VORP players for draft sync`);
    console.log('Sample player names:', players.slice(0, 5).map(p => p.name));

    // Reset draft first
    dispatch({ type: 'RESET_DRAFT' });

    // Process each pick in order using the automatic system
    syncData.picks.forEach((pickData: any, index: number) => {
      setTimeout(() => {
        console.log(`Processing pick ${index + 1}:`, pickData.player, 'to', pickData.team);
        
        // Use the new automatic pick system
        dispatch({
          type: 'AUTO_MAKE_PICK',
          payload: {
            playerName: pickData.player,
            teamName: pickData.team,
            pickNumber: pickData.overall || pickData.pick || (index + 1)
          }
        });
      }, index * 100); // Small delay between picks to ensure proper order
    });
  };

  // Auto-connect on mount
  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, [url]);

  return {
    isConnected,
    connectionStatus,
    connect,
    disconnect
  };
};