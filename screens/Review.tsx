import React, { useEffect, useState } from 'react';
import { FileText, Check, X, Edit, Eye, ChevronDown, ChevronUp, Calendar, Mail, Upload, AlertCircle } from 'lucide-react';

interface ExecutionAction {
  id: number;
  actionType: string;
  actionOrder: number;
  status: string;
  title: string;
  description: string;
  config: any;
  previewData: any;
}

interface ExecutionPlan {
  id: number;
  notificationId: number;
  status: string;
  proposedBy: string;
  proposedAt: string;
  inventoConfig: any;
  outlookConfig: any;
  emailConfig: any;
  actions: ExecutionAction[];
}

const Review: React.FC = () => {
  const [plans, setPlans] = useState<ExecutionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPlan, setExpandedPlan] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('pending');

  useEffect(() => {
    fetchPlans();
  }, [statusFilter]);

  const fetchPlans = async () => {
    try {
      // Si filtro es "pending", buscamos PROPOSED y APPROVED (listos para revisar/ejecutar)
      // Si es "all", traemos todos los planes
      let url = '/api/execution-plans';
      if (statusFilter === 'pending') {
        url += '?status=PROPOSED';
      } else if (statusFilter === 'approved') {
        url += '?status=APPROVED';
      }
      
      const response = await fetch(url, { credentials: 'include' });
      const data = await response.json();
      
      const plansWithActions = await Promise.all(
        data.map(async (plan: any) => {
          const detailResponse = await fetch(`/api/execution-plans/${plan.id}`, { credentials: 'include' });
          return detailResponse.json();
        })
      );
      
      setPlans(plansWithActions);
    } catch (error) {
      console.error('Error fetching plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const approvePlan = async (planId: number) => {
    try {
      await fetch(`/api/execution-plans/${planId}/approve`, {
        method: 'POST',
        credentials: 'include'
      });
      fetchPlans();
    } catch (error) {
      console.error('Error approving plan:', error);
    }
  };

  const cancelPlan = async (planId: number) => {
    try {
      await fetch(`/api/execution-plans/${planId}/cancel`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Cancelled by user' })
      });
      fetchPlans();
    } catch (error) {
      console.error('Error cancelling plan:', error);
    }
  };

  const executePlan = async (planId: number) => {
    try {
      await fetch(`/api/execution-plans/${planId}/execute`, {
        method: 'POST',
        credentials: 'include'
      });
      fetchPlans();
    } catch (error) {
      console.error('Error executing plan:', error);
    }
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'UPLOAD_INVENTO': return <Upload size={16} />;
      case 'CREATE_NOTE': return <FileText size={16} />;
      case 'CREATE_EVENT': return <Calendar size={16} />;
      case 'SEND_EMAIL_LAWYER':
      case 'SEND_EMAIL_CLIENT': return <Mail size={16} />;
      default: return <FileText size={16} />;
    }
  };

  const getActionColor = (type: string) => {
    switch (type) {
      case 'UPLOAD_INVENTO': return 'bg-blue-100 text-blue-600';
      case 'CREATE_NOTE': return 'bg-purple-100 text-purple-600';
      case 'CREATE_EVENT': return 'bg-green-100 text-green-600';
      case 'SEND_EMAIL_LAWYER': return 'bg-orange-100 text-orange-600';
      case 'SEND_EMAIL_CLIENT': return 'bg-pink-100 text-pink-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { color: string; label: string }> = {
      DRAFT: { color: 'bg-gray-100 text-gray-800', label: 'Borrador' },
      PROPOSED: { color: 'bg-blue-100 text-blue-800', label: 'Propuesto' },
      IN_REVIEW: { color: 'bg-yellow-100 text-yellow-800', label: 'En revisión' },
      APPROVED: { color: 'bg-green-100 text-green-800', label: 'Aprobado' },
      EXECUTED: { color: 'bg-emerald-100 text-emerald-800', label: 'Ejecutado' },
      CANCELLED: { color: 'bg-red-100 text-red-800', label: 'Cancelado' },
      ERROR: { color: 'bg-red-100 text-red-800', label: 'Error' }
    };

    const badge = badges[status] || badges.DRAFT;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
        {badge.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Revisión de planes</h1>
          <p className="text-gray-500 mt-1">Revisa y aprueba los planes de ejecución propuestos</p>
        </div>
        <div className="flex items-center gap-2">
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="pending">Pendientes de revisión</option>
            <option value="approved">Aprobados (listo para ejecutar)</option>
            <option value="all">Todos los planes</option>
          </select>
        </div>
      </div>

      {plans.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <Check size={48} className="mx-auto mb-4 text-green-500 opacity-50" />
          <p className="text-gray-500">No hay planes pendientes de revisión</p>
          <p className="text-sm text-gray-400 mt-1">Los planes propuestos aparecerán aquí</p>
        </div>
      ) : (
        <div className="space-y-4">
          {plans.map(plan => (
            <div key={plan.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div 
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                onClick={() => setExpandedPlan(expandedPlan === plan.id ? null : plan.id)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <FileText size={20} className="text-blue-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Plan #{plan.id}</span>
                      {getStatusBadge(plan.status)}
                    </div>
                    <div className="text-sm text-gray-500">
                      {plan.actions?.length || 0} acciones • Propuesto por {plan.proposedBy}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {expandedPlan === plan.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
              </div>

              {expandedPlan === plan.id && (
                <div className="border-t border-gray-200">
                  <div className="p-4 space-y-3">
                    <h3 className="font-medium text-gray-700">Acciones propuestas</h3>
                    
                    {plan.actions?.map((action, index) => (
                      <div key={action.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${getActionColor(action.actionType)}`}>
                          {getActionIcon(action.actionType)}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{action.title}</div>
                          <div className="text-sm text-gray-500">{action.description}</div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded">
                            <Eye size={16} />
                          </button>
                          <button className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded">
                            <Edit size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <AlertCircle size={16} />
                      Revisa todas las acciones antes de aprobar
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => cancelPlan(plan.id)}
                        className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg flex items-center gap-2"
                      >
                        <X size={16} />
                        Cancelar
                      </button>
                      <button 
                        onClick={() => approvePlan(plan.id)}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                      >
                        <Check size={16} />
                        Aprobar y ejecutar
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Review;
