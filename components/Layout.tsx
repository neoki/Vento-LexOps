import React from 'react';
import { LayoutDashboard, Inbox, FileText, Calendar, ShieldCheck, Settings, Bell, Search, User, Briefcase, LogOut, Monitor, Package, CheckSquare, Sliders } from 'lucide-react';
import { APP_NAME } from '../constants';

interface UserInfo {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: string;
}

interface LayoutProps {
  children: React.ReactNode;
  activeScreen: string;
  onNavigate: (screen: string) => void;
  user?: UserInfo;
  onLogout?: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeScreen, onNavigate, user, onLogout }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { id: 'packages', label: 'Paquetes LexNET', icon: <Package size={20} /> },
    { id: 'triage', label: 'Bandeja Triage', icon: <Inbox size={20} />, badge: 3 },
    { id: 'review', label: 'Revisión', icon: <CheckSquare size={20} /> },
    { id: 'notifications', label: 'Notificaciones', icon: <Bell size={20} /> },
    { id: 'cases', label: 'Expedientes', icon: <Briefcase size={20} /> },
    { id: 'calendar', label: 'Agenda & Plazos', icon: <Calendar size={20} /> },
    { id: 'audit', label: 'Auditoría', icon: <ShieldCheck size={20} />, adminOnly: true },
    { id: 'lexnet', label: 'Config. LexNET', icon: <Monitor size={20} /> },
    { id: 'configuration', label: 'Sistema', icon: <Sliders size={20} />, adminOnly: true },
    { id: 'settings', label: 'Mi cuenta', icon: <Settings size={20} /> },
  ];

  const filteredNavItems = navItems.filter(item => {
    if (item.adminOnly && user?.role !== 'ADMIN') {
      return false;
    }
    return true;
  });

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'ADMIN': return 'Administrador';
      case 'LAWYER': return 'Abogado';
      case 'ASSISTANT': return 'Asistente';
      default: return role;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 text-gray-800 font-sans overflow-hidden">
      <aside className="w-64 bg-slate-900 text-white flex flex-col shadow-xl z-20">
        <div className="p-6 border-b border-slate-700">
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center font-serif italic font-black">V</div>
            {APP_NAME}
          </h1>
          <p className="text-xs text-slate-400 mt-1">Jurídico Laboral Automation</p>
        </div>

        <nav className="flex-1 py-6 px-3 space-y-1">
          {filteredNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeScreen === item.id
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              {item.icon}
              <span className="flex-1 text-left">{item.label}</span>
              {item.badge && (
                <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-700 bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
              <User size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.fullName || 'Usuario'}</p>
              <p className="text-xs text-slate-400">{user ? getRoleLabel(user.role) : ''}</p>
            </div>
            {onLogout && (
              <button 
                onClick={onLogout}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                title="Cerrar sesión"
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shadow-sm z-10">
          <div className="flex items-center gap-4 text-gray-500">
            <span className="text-sm font-medium">Estado del Agente LexNET:</span>
            <span className="flex items-center gap-1.5 text-xs bg-green-100 text-green-700 px-2.5 py-1 rounded-full font-semibold border border-green-200">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              ONLINE
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input 
                type="text" 
                placeholder="Buscar autos, lexnet ID..." 
                className="pl-9 pr-4 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none w-64"
              />
            </div>
            <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-full relative">
              <Bell size={20} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-auto bg-gray-50 p-6 custom-scrollbar">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
