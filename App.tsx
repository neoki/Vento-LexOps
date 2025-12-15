import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './screens/Dashboard';
import Triage from './screens/Triage';
import Audit from './screens/Audit';
import LexNetSetup from './screens/LexNetSetup';
import CalendarView from './screens/CalendarView';
import NotificationsList from './screens/NotificationsList';
import Login from './screens/Login';
import Settings from './screens/Settings';

interface User {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: string;
}

const App: React.FC = () => {
  const [activeScreen, setActiveScreen] = useState('dashboard');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include'
      });
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      }
    } catch (error) {
      console.log('Not authenticated');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (userData: User) => {
    setUser(userData);
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '') || 'dashboard';
      setActiveScreen(hash);
    };

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate = (screen: string) => {
    window.location.hash = screen;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin text-4xl">⏳</div>
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

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
      case 'lexnet':
        return <LexNetSetup />;
      case 'settings':
        return <Settings user={user} />;
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
    <Layout 
      activeScreen={activeScreen} 
      onNavigate={navigate}
      user={user}
      onLogout={handleLogout}
    >
      {renderScreen()}
    </Layout>
  );
};

export default App;
