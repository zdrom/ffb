import { DraftProvider } from './contexts/DraftContext';
import AppContent from './components/AppContent';
import ErrorBoundary from './components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <DraftProvider>
        <AppContent />
      </DraftProvider>
    </ErrorBoundary>
  );
}

export default App;
