import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './screens/Dashboard';
import Triage from './screens/Triage';
import Audit from './screens/Audit';
import LexNetSetup from './screens/LexNetSetup';
import CalendarView from './screens/CalendarView';
import NotificationsList from './screens/NotificationsList';

const App: React.FC = () => {
  const [activeScreen, setActiveScreen] = useState('dashboard');

  // Simple Hash Router logic
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '') || 'dashboard';
      setActiveScreen(hash);
    };

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange(); // Initial load

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate = (screen: string) => {
    window.location.hash = screen;
  };

  const renderScreen = () => {
    switch (activeScreen) {
      case 'dashboard':
        return <Dashboard />;
      case 'triage':
        return <Triage />;
      case 'notifications':
        return <NotificationsList />;
      case 'calendar':
        return <CalendarView />;
      case 'audit':
        return <Audit />;
      case 'settings':
        return <LexNetSetup />;
      default:
        return (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <h2 className="text-xl font-bold">Pantalla en construcción ({activeScreen})</h2>
            <p>Implementación completa en próxima iteración.</p>
          </div>
        );
    }
  };

  return (
    <Layout activeScreen={activeScreen} onNavigate={navigate}>
      {renderScreen()}
    </Layout>
  );
};

export default App;