import { DraftProvider } from './contexts/DraftContext';
import AppContent from './components/AppContent';

function App() {
  return (
    <DraftProvider>
      <AppContent />
    </DraftProvider>
  );
}

export default App;
