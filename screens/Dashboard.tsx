
import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ArrowUpRight, ArrowDownRight, Clock, CheckCircle, AlertTriangle, Download, Terminal, Activity, Wifi } from 'lucide-react';
import { AgentLog } from '../types';
import { api } from '../services/api';

const data = [
  { name: 'L', incoming: 12, processed: 10 },
  { name: 'M', incoming: 19, processed: 15 },
  { name: 'X', incoming: 8, processed: 8 },
  { name: 'J', incoming: 22, processed: 20 },
  { name: 'V', incoming: 15, processed: 14 },
];

const StatCard: React.FC<{ title: string; value: string; trend: string; type: 'neutral' | 'positive' | 'negative'; icon: React.ReactNode }> = ({ title, value, trend, type, icon }) => (
  <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
    <div className="flex justify-between items-start">
      <div>
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <h3 className="text-2xl font-bold text-gray-900 mt-1">{value}</h3>
      </div>
      <div className={`p-2 rounded-lg ${type === 'positive' ? 'bg-green-50 text-green-600' : type === 'negative' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
        {icon}
      </div>
    </div>
    <div className="mt-4 flex items-center text-sm">
      {type === 'positive' ? <ArrowUpRight size={16} className="text-green-500 mr-1" /> : <ArrowDownRight size={16} className="text-red-500 mr-1" />}
      <span className={type === 'positive' ? 'text-green-600 font-medium' : type === 'negative' ? 'text-red-600 font-medium' : 'text-gray-600'}>{trend}</span>
      <span className="text-gray-400 ml-1">vs ayer</span>
    </div>
  </div>
);

const LiveTerminal: React.FC<{ logs: AgentLog[], status: string }> = ({ logs, status }) => {
    return (
        <div className="bg-slate-900 rounded-xl overflow-hidden shadow-lg border border-slate-700 flex flex-col h-full">
            <div className="bg-slate-800 px-4 py-2 flex items-center justify-between border-b border-slate-700">
                <div className="flex items-center gap-2">
                    <Terminal size={14} className="text-slate-400" />
                    <span className="text-xs font-mono text-slate-300">lexops-agent-win32.exe</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${status === 'ONLINE' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
                    <span className={`text-[10px] font-bold uppercase ${status === 'ONLINE' ? 'text-green-500' : 'text-red-500'}`}>
                        {status === 'ONLINE' ? 'Live Connection' : 'Disconnected'}
                    </span>
                </div>
            </div>
            <div className="p-4 font-mono text-xs overflow-y-auto flex-1 custom-scrollbar bg-slate-950/50">
                {logs.length > 0 ? logs.map((log, idx) => (
                    <div key={idx} className="mb-2 last:mb-0 flex gap-3">
                        <span className="text-slate-500 shrink-0">[{log.timestamp}]</span>
                        <span className={`shrink-0 font-bold w-16 ${
                            log.level === 'SUCCESS' ? 'text-green-400' : 
                            log.level === 'WARN' ? 'text-yellow-400' : 
                            log.level === 'ERROR' ? 'text-red-400' : 'text-blue-400'
                        }`}>{log.level}</span>
                        <span className="text-slate-300">{log.message}</span>
                    </div>
                )) : (
                    <div className="text-slate-600 italic text-center mt-10">Esperando conexión del agente...<br/>(Ejecuta: python agent.py)</div>
                )}
            </div>
        </div>
    );
};

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState({ incoming: 0, triage: 0, synced: 0 });
  const [agentStatus, setAgentStatus] = useState('OFFLINE');
  const [logs, setLogs] = useState<AgentLog[]>([]);

  useEffect(() => {
    // Poll API every 2 seconds to get real-time status from the python agent
    const fetchData = async () => {
        const data = await api.getDashboardStats();
        // @ts-ignore - simplistic type handling for demo
        if (data && data.stats) {
            setStats(data.stats);
            setAgentStatus(data.agentStatus);
            setLogs(data.recentLogs);
        }
    };
    
    fetchData(); // Initial
    const interval = setInterval(fetchData, 2000); // Poll
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Panel de Control</h2>
        <p className="text-gray-500">Resumen de actividad LexNET e Invento del día.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
            title="Descargas Hoy" 
            value={stats.incoming.toString()} 
            trend="+12%" 
            type="neutral" 
            icon={<Download size={20} />} 
        />
        <StatCard 
            title="Pendientes Triaje" 
            value={stats.triage.toString()} 
            trend={stats.triage > 5 ? "High" : "Normal"} 
            type={stats.triage > 0 ? "negative" : "positive"} 
            icon={<AlertTriangle size={20} />} 
        />
        <StatCard 
            title="Plazos Próximos" 
            value="12" 
            trend="48h" 
            type="neutral" 
            icon={<Clock size={20} />} 
        />
        <StatCard 
            title="Sincronizados Invento" 
            value={stats.synced.toString()} 
            trend="98% Success" 
            type="positive" 
            icon={<CheckCircle size={20} />} 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[400px]">
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm col-span-2 flex flex-col">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Volumen de Notificaciones (Semanal)</h3>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{fill: '#64748b'}} axisLine={false} tickLine={false} />
                <YAxis tick={{fill: '#64748b'}} axisLine={false} tickLine={false} />
                <Tooltip 
                    contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                    itemStyle={{ color: '#1e293b' }}
                />
                <Bar dataKey="incoming" name="Recibidas" fill="#0ea5e9" radius={[4, 4, 0, 0]} barSize={32} />
                <Bar dataKey="processed" name="Procesadas" fill="#0f172a" radius={[4, 4, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="col-span-1 h-full">
            <LiveTerminal logs={logs} status={agentStatus} />
        </div>
      </div>
      
      {/* System Health Compact Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-xl shadow-sm">
             <div className="p-2 bg-green-100 text-green-600 rounded-lg"><Activity size={20} /></div>
             <div>
                <p className="text-xs text-gray-500 font-medium">Invento API Latency</p>
                <p className="text-sm font-bold text-gray-900">12ms (Local)</p>
             </div>
          </div>
          <div className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-xl shadow-sm">
             <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><Wifi size={20} /></div>
             <div>
                <p className="text-xs text-gray-500 font-medium">LexNET Connection</p>
                <p className="text-sm font-bold text-gray-900">
                    {agentStatus === 'ONLINE' ? 'Active' : 'Waiting...'}
                </p>
             </div>
          </div>
          <div className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-xl shadow-sm">
             <div className="p-2 bg-purple-100 text-purple-600 rounded-lg"><CheckCircle size={20} /></div>
             <div>
                <p className="text-xs text-gray-500 font-medium">Auto-Classification Rate</p>
                <p className="text-sm font-bold text-gray-900">92.4%</p>
             </div>
          </div>
      </div>
    </div>
  );
};

export default Dashboard;
