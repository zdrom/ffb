import { DraftProvider } from './contexts/DraftContext';
import { PlayerMappingProvider } from './contexts/PlayerMappingContext';
import AppContent from './components/AppContent';
import ErrorBoundary from './components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <DraftProvider>
        <PlayerMappingProvider>
          <AppContent />
        </PlayerMappingProvider>
      </DraftProvider>
    </ErrorBoundary>
  );
}

export default App;
