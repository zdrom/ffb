import type { DraftState } from '../types';

export class StorageManager {
  private static STORAGE_KEY = 'fantasy-draft-copilot-state';

  static saveDraftState(state: DraftState): void {
    try {
      const serializedState = JSON.stringify({
        ...state,
        // Convert dates to strings for JSON serialization
        picks: state.picks.map(pick => ({
          ...pick,
          timestamp: pick.timestamp.toISOString()
        }))
      });
      localStorage.setItem(this.STORAGE_KEY, serializedState);
    } catch (error) {
      console.error('Failed to save draft state:', error);
    }
  }

  static loadDraftState(): DraftState | null {
    try {
      const serializedState = localStorage.getItem(this.STORAGE_KEY);
      if (!serializedState) return null;

      const state = JSON.parse(serializedState);
      
      // Convert timestamp strings back to Date objects
      return {
        ...state,
        picks: state.picks.map((pick: any) => ({
          ...pick,
          timestamp: new Date(pick.timestamp)
        }))
      };
    } catch (error) {
      console.error('Failed to load draft state:', error);
      return null;
    }
  }

  static clearDraftState(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear draft state:', error);
    }
  }

  static exportDraftState(state: DraftState): string {
    return JSON.stringify({
      ...state,
      picks: state.picks.map(pick => ({
        ...pick,
        timestamp: pick.timestamp.toISOString()
      }))
    }, null, 2);
  }

  static importDraftState(jsonString: string): DraftState {
    const state = JSON.parse(jsonString);
    
    return {
      ...state,
      picks: state.picks.map((pick: any) => ({
        ...pick,
        timestamp: new Date(pick.timestamp)
      }))
    };
  }

  static exportDraftBoard(state: DraftState): string {
    const headers = ['Round', 'Pick', 'Overall', 'Team', 'Player', 'Position', 'NFL Team'];
    const rows = [headers];

    state.picks.forEach(pick => {
      rows.push([
        pick.round.toString(),
        pick.pick.toString(),
        pick.overall.toString(),
        pick.team,
        pick.player?.name || '',
        pick.player?.position || '',
        pick.player?.team || ''
      ]);
    });

    return rows.map(row => row.join(',')).join('\n');
  }

  static exportTeamRosters(state: DraftState): string {
    const headers = ['Team', 'Position', 'Player', 'NFL Team', 'Round', 'Pick'];
    const rows = [headers];

    state.teams.forEach(team => {
      Object.entries(team.roster).forEach(([position, players]) => {
        players.forEach(player => {
          const pick = state.picks.find(p => p.player?.id === player.id);
          rows.push([
            team.name,
            position,
            player.name,
            player.team,
            pick?.round.toString() || '',
            pick?.overall.toString() || ''
          ]);
        });
      });
    });

    return rows.map(row => row.join(',')).join('\n');
  }

  static downloadFile(content: string, filename: string, mimeType: string = 'text/plain'): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}