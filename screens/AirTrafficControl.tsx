import React, { useState, useEffect } from 'react';
import { 
  Users, AlertTriangle, Clock, CheckCircle, 
  ChevronRight, Bell, Calendar, FileText,
  Filter, RefreshCw, TrendingUp, Activity
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

interface LawyerStatus {
  id: number;
  fullName: string;
  color: string;
  pendingNotifications: number;
  urgentDeadlines: number;
  overdueTasks: number;
  completedToday: number;
  workload: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
}

interface ThreeDayAlert {
  id: number;
  lexnetId: string;
  procedureNumber: string;
  court: string;
  hoursRemaining: number;
  alertLevel: 'WARNING' | 'URGENT' | 'CRITICAL';
  assignedLawyerName?: string;
  assignedLawyerColor?: string;
}

interface Summary {
  totalLawyers: number;
  totalPendingNotifications: number;
  totalUrgentDeadlines: number;
  totalOverdueTasks: number;
  threeDayAlerts: {
    critical: ThreeDayAlert[];
    urgent: ThreeDayAlert[];
    warning: ThreeDayAlert[];
  };
}

export default function AirTrafficControl() {
  const navigate = useNavigate();
  const [lawyers, setLawyers] = useState<LawyerStatus[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'urgent' | 'overdue'>('all');
  const [lastRefresh, setLastRefresh] = useState(new Date());

  useEffect(() => {
    loadDashboard();
    const interval = setInterval(loadDashboard, 60000);
    return () => clearInterval(interval);
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const [lawyersRes, alertsRes] = await Promise.all([
        api.get('/api/manager/lawyers-status'),
        api.get('/api/alerts/three-day-rule')
      ]);
      
      setLawyers(lawyersRes.lawyers || []);
      setSummary({
        totalLawyers: lawyersRes.lawyers?.length || 0,
        totalPendingNotifications: lawyersRes.totalPendingNotifications || 0,
        totalUrgentDeadlines: lawyersRes.totalUrgentDeadlines || 0,
        totalOverdueTasks: lawyersRes.totalOverdueTasks || 0,
        threeDayAlerts: alertsRes || { critical: [], urgent: [], warning: [] }
      });
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const getWorkloadColor = (workload: string) => {
    switch (workload) {
      case 'CRITICAL': return 'bg-red-100 text-red-800 border-red-300';
      case 'HIGH': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'NORMAL': return 'bg-green-100 text-green-800 border-green-300';
      case 'LOW': return 'bg-blue-100 text-blue-800 border-blue-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const filteredLawyers = lawyers.filter(l => {
    if (selectedFilter === 'urgent') return l.urgentDeadlines > 0;
    if (selectedFilter === 'overdue') return l.overdueTasks > 0;
    return true;
  });

  const totalCriticalAlerts = summary?.threeDayAlerts.critical.length || 0;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Activity className="w-7 h-7 text-blue-600" />
            Panel de Control - Gestora
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Vista general de todos los letrados y notificaciones
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">
            Última actualización: {lastRefresh.toLocaleTimeString()}
          </span>
          <button
            onClick={loadDashboard}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
      </div>

      {totalCriticalAlerts > 0 && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-r-lg">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-red-600 animate-pulse" />
            <div>
              <h3 className="font-bold text-red-800">
                ¡ALERTA CRÍTICA! {totalCriticalAlerts} notificación(es) a punto de expirar
              </h3>
              <p className="text-red-700 text-sm">
                Quedan menos de 6 horas para aceptar estas notificaciones en LexNET
              </p>
            </div>
            <button
              onClick={() => navigate('/alerts')}
              className="ml-auto px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Ver Alertas
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Letrados Activos</p>
              <p className="text-2xl font-bold text-gray-900">{summary?.totalLawyers || 0}</p>
            </div>
            <Users className="w-10 h-10 text-blue-500 opacity-80" />
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Notificaciones Pendientes</p>
              <p className="text-2xl font-bold text-gray-900">{summary?.totalPendingNotifications || 0}</p>
            </div>
            <FileText className="w-10 h-10 text-indigo-500 opacity-80" />
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Plazos Urgentes</p>
              <p className="text-2xl font-bold text-orange-600">{summary?.totalUrgentDeadlines || 0}</p>
            </div>
            <Clock className="w-10 h-10 text-orange-500 opacity-80" />
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Tareas Vencidas</p>
              <p className="text-2xl font-bold text-red-600">{summary?.totalOverdueTasks || 0}</p>
            </div>
            <AlertTriangle className="w-10 h-10 text-red-500 opacity-80" />
          </div>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setSelectedFilter('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            selectedFilter === 'all' 
              ? 'bg-blue-600 text-white' 
              : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          Todos
        </button>
        <button
          onClick={() => setSelectedFilter('urgent')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            selectedFilter === 'urgent' 
              ? 'bg-orange-600 text-white' 
              : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          Con Urgencias
        </button>
        <button
          onClick={() => setSelectedFilter('overdue')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            selectedFilter === 'overdue' 
              ? 'bg-red-600 text-white' 
              : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          Con Vencidos
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Estado de Letrados
          </h2>
        </div>
        
        <div className="divide-y divide-gray-100">
          {filteredLawyers.map(lawyer => (
            <div
              key={lawyer.id}
              className="p-4 hover:bg-gray-50 transition-colors cursor-pointer"
              onClick={() => navigate(`/lawyer/${lawyer.id}/tasks`)}
            >
              <div className="flex items-center gap-4">
                <div 
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
                  style={{ backgroundColor: lawyer.color }}
                >
                  {lawyer.fullName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-gray-900">{lawyer.fullName}</h3>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${getWorkloadColor(lawyer.workload)}`}>
                      {lawyer.workload === 'CRITICAL' ? 'Crítico' : 
                       lawyer.workload === 'HIGH' ? 'Alto' :
                       lawyer.workload === 'NORMAL' ? 'Normal' : 'Bajo'}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <FileText className="w-4 h-4" />
                      {lawyer.pendingNotifications} pendientes
                    </span>
                    {lawyer.urgentDeadlines > 0 && (
                      <span className="flex items-center gap-1 text-orange-600">
                        <Clock className="w-4 h-4" />
                        {lawyer.urgentDeadlines} urgentes
                      </span>
                    )}
                    {lawyer.overdueTasks > 0 && (
                      <span className="flex items-center gap-1 text-red-600">
                        <AlertTriangle className="w-4 h-4" />
                        {lawyer.overdueTasks} vencidos
                      </span>
                    )}
                    {lawyer.completedToday > 0 && (
                      <span className="flex items-center gap-1 text-green-600">
                        <CheckCircle className="w-4 h-4" />
                        {lawyer.completedToday} hoy
                      </span>
                    )}
                  </div>
                </div>
                
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </div>
            </div>
          ))}
          
          {filteredLawyers.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              {loading ? 'Cargando...' : 'No hay letrados que mostrar con el filtro actual'}
            </div>
          )}
        </div>
      </div>

      {summary && (summary.threeDayAlerts.critical.length > 0 || summary.threeDayAlerts.urgent.length > 0) && (
        <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-red-50">
            <h2 className="font-semibold text-red-800 flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Alertas de Regla de 3 Días
            </h2>
          </div>
          
          <div className="p-4 space-y-3">
            {summary.threeDayAlerts.critical.map(alert => (
              <div key={alert.id} className="flex items-center gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
                <AlertTriangle className="w-5 h-5 text-red-600 animate-pulse" />
                <div className="flex-1">
                  <p className="font-medium text-red-800">{alert.procedureNumber}</p>
                  <p className="text-sm text-red-600">{alert.court}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-red-700">{alert.hoursRemaining}h restantes</p>
                  {alert.assignedLawyerName && (
                    <span 
                      className="inline-block px-2 py-0.5 text-xs text-white rounded-full mt-1"
                      style={{ backgroundColor: alert.assignedLawyerColor || '#666' }}
                    >
                      {alert.assignedLawyerName}
                    </span>
                  )}
                </div>
              </div>
            ))}
            
            {summary.threeDayAlerts.urgent.map(alert => (
              <div key={alert.id} className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
                <Clock className="w-5 h-5 text-orange-600" />
                <div className="flex-1">
                  <p className="font-medium text-orange-800">{alert.procedureNumber}</p>
                  <p className="text-sm text-orange-600">{alert.court}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-orange-700">{alert.hoursRemaining}h restantes</p>
                  {alert.assignedLawyerName && (
                    <span 
                      className="inline-block px-2 py-0.5 text-xs text-white rounded-full mt-1"
                      style={{ backgroundColor: alert.assignedLawyerColor || '#666' }}
                    >
                      {alert.assignedLawyerName}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
