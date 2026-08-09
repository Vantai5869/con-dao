import './App.css';
import { LanguageProvider } from './lib/i18n';
import { CheckInFlow } from './components/CheckInFlow';
import { useViewportHeight } from './hooks/useViewportHeight';

function App() {
  useViewportHeight();

  return (
    <div className="app">
      <LanguageProvider>
        <CheckInFlow />
      </LanguageProvider>
    </div>
  );
}

export default App;
