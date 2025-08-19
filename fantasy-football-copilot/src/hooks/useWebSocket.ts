import { useEffect, useRef, useState } from 'react';
import { useDraft } from '../contexts/DraftContext';
import { loadGlobalVORPRankings } from '../utils/globalVORPStorage';
import { useDraftSyncWorker } from './useDraftSyncWorker';
import { usePlayerMapping } from '../contexts/PlayerMappingContext';
import { findPlayerWithMapping, trackUnmappedFailure } from '../utils/playerNameMapping';

export const useWebSocket = (url: string = 'ws://localhost:3001') => {
  const { state, dispatch } = useDraft();
  const { processBatchSync, processIncrementalSync, isProcessing } = useDraftSyncWorker();
  const { showMappingPopup } = usePlayerMapping();
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Helper function to ensure VORP players are loaded
  const ensureVORPPlayersLoadedFn = () => {
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

      wsRef.current.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('WebSocket message received:', data);
          
          if (data.type === 'draft_pick') {
            await handleDraftPick(data.data);
          } else if (data.type === 'draft_sync') {
            handleDraftSync(data.data);
          } else if (data.type === 'draft_incremental') {
            handleIncrementalSync(data.data);
          } else if (data.type === 'draft_sync_verify') {
            handleSyncVerification(data.data);
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


  const handleDraftPick = async (pickData: any) => {
    console.log('Processing draft pick from extension:', pickData);
    
    const players = ensureVORPPlayersLoadedFn();
    if (!players || players.length === 0) {
      alert('Please import your VORP rankings first before syncing draft picks.');
      return;
    }

    // Try to find the player first
    let player = findPlayerWithMapping(pickData.player, players);
    
    // If not found, show mapping popup
    if (!player) {
      player = await showMappingPopup(pickData.player);
      if (!player) {
        // User skipped mapping
        trackUnmappedFailure(pickData.player);
        console.warn('Player mapping skipped for:', pickData.player);
        return;
      }
    }

    // Use the new automatic pick system
    dispatch({
      type: 'AUTO_MAKE_PICK',
      payload: {
        playerName: player.name, // Use the mapped player name
        teamName: pickData.team,
        pickNumber: pickData.overall || pickData.pick || state.currentPick
      }
    });
  };

  const handleIncrementalSync = async (incrementalData: any) => {
    console.log('🔄 Processing incremental sync from extension:', incrementalData);
    
    if (!incrementalData.newPicks || !Array.isArray(incrementalData.newPicks)) {
      console.error('❌ Invalid incremental sync data format');
      return;
    }

    if (incrementalData.newPicks.length === 0) {
      console.log('ℹ️ No new picks to sync');
      return;
    }

    // Auto-load players if needed
    const players = ensureVORPPlayersLoadedFn();
    if (!players || players.length === 0) {
      console.warn('⚠️ No VORP rankings available for incremental sync');
      return;
    }

    const totalPicks = incrementalData.newPicks.length;
    console.log(`🔄 Incrementally syncing ${totalPicks} new picks using worker...`);
    
    // Convert to worker format
    const picks = incrementalData.newPicks.map((pickData: any) => ({
      playerName: pickData.player,
      teamName: pickData.team,
      pickNumber: pickData.overall || pickData.pick
    }));

    try {
      // Use worker-based incremental sync
      await processIncrementalSync(picks);
      console.log(`✅ Worker-based incremental sync completed: ${incrementalData.addedCount} added, ${incrementalData.skippedCount} skipped`);
      
      // Force a UI update notification
      console.log('🎯 UI should now reflect the new draft picks automatically');
    } catch (error) {
      console.error('❌ Error during worker-based incremental sync:', error);
    }
  };

  const handleSyncVerification = (verificationData: any) => {
    console.log('Processing draft sync verification from extension:', verificationData);
    
    if (!verificationData.picks || !Array.isArray(verificationData.picks)) {
      console.error('Invalid sync verification data format');
      return;
    }

    // Auto-load players if needed
    const players = ensureVORPPlayersLoadedFn();
    if (!players || players.length === 0) {
      console.warn('No VORP rankings available for sync verification');
      return;
    }

    console.log(`Sync verification: ${verificationData.totalPicks} total picks, gaps: ${verificationData.gaps?.length || 0}, verified: ${verificationData.verified}`);
    
    if (verificationData.gaps && verificationData.gaps.length > 0) {
      console.warn(`Draft sequence has gaps at picks: ${verificationData.gaps.join(', ')}`);
      // Show user notification about gaps
      const gapWarning = document.createElement('div');
      gapWarning.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded shadow-lg z-50';
      gapWarning.innerHTML = `
        <div class="flex">
          <div class="flex-shrink-0">⚠️</div>
          <div class="ml-3">
            <p class="text-sm font-medium">Draft sequence gaps detected</p>
            <p class="text-xs mt-1">Missing picks: ${verificationData.gaps.join(', ')}</p>
          </div>
        </div>
      `;
      document.body.appendChild(gapWarning);
      setTimeout(() => gapWarning.remove(), 10000);
    }

    // Reset draft and sync all picks
    dispatch({ type: 'RESET_DRAFT' });
    
    const picks = verificationData.picks.map((pickData: any) => ({
      playerName: pickData.player,
      teamName: pickData.team,
      pickNumber: pickData.overall || pickData.pick
    }));

    // Use batch sync for verified complete data
    dispatch({
      type: 'BATCH_SYNC_PICKS',
      payload: { picks }
    });

    console.log(`Sync verification completed: ${verificationData.addedCount} picks processed, ${verificationData.verified ? 'no gaps' : `${verificationData.gaps?.length || 0} gaps`} found`);
  };

  const handleDraftSync = async (syncData: any) => {
    console.log('Processing draft sync from extension:', syncData);
    console.log('Current player count in rankings:', state.players.length);
    
    if (!syncData.picks || !Array.isArray(syncData.picks)) {
      console.error('Invalid sync data format');
      return;
    }

    // Auto-load players if needed
    const players = ensureVORPPlayersLoadedFn();
    if (!players || players.length === 0) {
      alert('Please import your VORP rankings first before syncing draft picks.');
      return;
    }

    console.log(`Using ${players.length} VORP players for draft sync`);
    
    const totalPicks = syncData.picks.length;
    console.log(`Syncing ${totalPicks} picks using worker-based processing...`);

    // Convert sync data to worker format
    const picks = syncData.picks.map((pickData: any, index: number) => ({
      playerName: pickData.player,
      teamName: pickData.team,
      pickNumber: pickData.overall || pickData.pick || (index + 1)
    }));

    // Show user feedback during sync
    const processingOverlay = document.createElement('div');
    processingOverlay.id = 'draft-sync-overlay';
    processingOverlay.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center';
    
    const updateOverlay = (processed: number, total: number) => {
      const percentage = Math.round((processed / total) * 100);
      processingOverlay.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-lg text-center max-w-sm">
          <div class="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <h3 class="text-lg font-semibold">Syncing Draft Picks</h3>
          <p class="text-gray-600">Processing ${processed} of ${total} picks...</p>
          <div class="w-full bg-gray-200 rounded-full h-2 mt-3">
            <div class="bg-blue-600 h-2 rounded-full transition-all duration-300" style="width: ${percentage}%"></div>
          </div>
          <div class="mt-2 text-sm text-blue-600">${percentage}% complete</div>
          <div class="mt-1 text-xs text-gray-500">Using Web Worker for non-blocking processing</div>
        </div>
      `;
    };
    
    updateOverlay(0, totalPicks);
    document.body.appendChild(processingOverlay);

    // Reset draft first
    dispatch({ type: 'RESET_DRAFT' });

    try {
      // Use the worker-based sync with progress updates
      await processBatchSync(picks, (progress) => {
        updateOverlay(progress.processed, progress.total);
      });
      
      // All processing completed, clean up
      setTimeout(() => {
        const overlay = document.getElementById('draft-sync-overlay');
        if (overlay) {
          overlay.remove();
        }
        console.log('Worker-based draft sync completed successfully');
      }, 300);
    } catch (error) {
      console.error('Error during worker-based sync:', error);
      const overlay = document.getElementById('draft-sync-overlay');
      if (overlay) {
        overlay.remove();
      }
    }
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
    disconnect,
    isSyncProcessing: isProcessing
  };
};