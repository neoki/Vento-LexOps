import React, { useState, useEffect } from 'react';
import { 
  Clock, FileText, AlertTriangle, CheckCircle, 
  Calendar, Bell, ChevronRight, TrendingUp,
  Inbox, Timer, Eye
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

interface DeadlineItem {
  id: number;
  title: string;
  dueDate: string;
  gracePeriodEnd?: string;
  taskType: string;
  status: string;
  priority: string;
  procedureNumber: string;
  court: string;
  daysRemaining: number;
}

interface NotificationItem {
  id: number;
  lexnetId: string;
  procedureNumber: string;
  court: string;
  status: string;
  priority: string;
  receivedDate: string;
}

interface LawyerStats {
  pendingNotifications: number;
  urgentDeadlines: number;
  tasksToday: number;
  completedThisWeek: number;
}

export default function LawyerDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<LawyerStats | null>(null);
  const [upcomingDeadlines, setUpcomingDeadlines] = useState<DeadlineItem[]>([]);
  const [pendingNotifications, setPendingNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const [statsRes, deadlinesRes, notifsRes] = await Promise.all([
        api.get('/api/lawyer/stats'),
        api.get('/api/lawyer/deadlines'),
        api.get('/api/lawyer/notifications/pending')
      ]);
      
      setStats(statsRes);
      setUpcomingDeadlines(deadlinesRes.deadlines || []);
      setPendingNotifications(notifsRes.notifications || []);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL': return 'bg-red-100 text-red-800 border-red-300';
      case 'HIGH': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getDaysRemainingColor = (days: number) => {
    if (days <= 0) return 'text-red-600';
    if (days <= 3) return 'text-orange-600';
    if (days <= 7) return 'text-yellow-600';
    return 'text-green-600';
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', { 
      weekday: 'short', 
      day: 'numeric', 
      month: 'short' 
    });
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Mi Panel</h1>
        <p className="text-gray-500 text-sm mt-1">
          Vista general de tus plazos y notificaciones
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div 
          className="bg-white rounded-xl shadow-sm p-4 border border-gray-200 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => navigate('/notifications')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Notificaciones Pendientes</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.pendingNotifications || 0}</p>
            </div>
            <Inbox className="w-10 h-10 text-blue-500 opacity-80" />
          </div>
        </div>
        
        <div 
          className="bg-white rounded-xl shadow-sm p-4 border border-gray-200 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => navigate('/calendar')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Plazos Urgentes</p>
              <p className="text-2xl font-bold text-orange-600">{stats?.urgentDeadlines || 0}</p>
            </div>
            <AlertTriangle className="w-10 h-10 text-orange-500 opacity-80" />
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Tareas Hoy</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.tasksToday || 0}</p>
            </div>
            <Calendar className="w-10 h-10 text-indigo-500 opacity-80" />
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Completadas (semana)</p>
              <p className="text-2xl font-bold text-green-600">{stats?.completedThisWeek || 0}</p>
            </div>
            <CheckCircle className="w-10 h-10 text-green-500 opacity-80" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Mis Vencimientos
            </h2>
            <button
              onClick={() => navigate('/calendar')}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              Ver todos
            </button>
          </div>
          
          <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
            {upcomingDeadlines.map(deadline => (
              <div
                key={deadline.id}
                className="p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => navigate(`/task/${deadline.id}`)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${getPriorityColor(deadline.priority)}`}>
                        {deadline.priority}
                      </span>
                      <span className="text-xs text-gray-500">{deadline.taskType}</span>
                    </div>
                    <h3 className="font-medium text-gray-900 mt-1">{deadline.title}</h3>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {deadline.procedureNumber} - {deadline.court}
                    </p>
                  </div>
                  <div className="text-right ml-4">
                    <p className="text-sm font-medium text-gray-900">{formatDate(deadline.dueDate)}</p>
                    <p className={`text-sm font-bold ${getDaysRemainingColor(deadline.daysRemaining)}`}>
                      {deadline.daysRemaining === 0 ? 'HOY' : 
                       deadline.daysRemaining < 0 ? `${Math.abs(deadline.daysRemaining)}d vencido` :
                       `${deadline.daysRemaining}d restantes`}
                    </p>
                    {deadline.gracePeriodEnd && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        Gracia: {new Date(deadline.gracePeriodEnd).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
            
            {upcomingDeadlines.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                {loading ? 'Cargando...' : 'No hay plazos próximos'}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Mis Notificaciones Pendientes
            </h2>
            <button
              onClick={() => navigate('/notifications')}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              Ver todas
            </button>
          </div>
          
          <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
            {pendingNotifications.map(notif => (
              <div
                key={notif.id}
                className="p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => navigate(`/notification/${notif.id}`)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${getPriorityColor(notif.priority)}`}>
                        {notif.priority}
                      </span>
                      <span className="text-xs text-gray-500">{notif.status}</span>
                    </div>
                    <h3 className="font-medium text-gray-900 mt-1">{notif.procedureNumber}</h3>
                    <p className="text-sm text-gray-500 mt-0.5">{notif.court}</p>
                  </div>
                  <div className="text-right ml-4">
                    <p className="text-sm text-gray-600">{formatDate(notif.receivedDate)}</p>
                    <button className="mt-1 text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      Ver
                    </button>
                  </div>
                </div>
              </div>
            ))}
            
            {pendingNotifications.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                {loading ? 'Cargando...' : 'No hay notificaciones pendientes'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
