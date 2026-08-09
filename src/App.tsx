import './App.css';
import { LanguageProvider } from './lib/i18n';
import { CheckInFlow } from './components/CheckInFlow';

function App() {
  return (
    <div className="app">
      <LanguageProvider>
        <CheckInFlow />
      </LanguageProvider>
    </div>
  );
}

export default App;
