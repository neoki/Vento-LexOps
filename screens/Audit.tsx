import React from 'react';
import { MOCK_AUDIT_LOG } from '../constants';
import { Shield, Search, Filter } from 'lucide-react';

const Audit: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Registro de Auditoría</h2>
          <p className="text-gray-500">Trazabilidad inmutable de acciones críticas (Blockchain-ready).</p>
        </div>
        <button className="text-blue-600 text-sm font-medium hover:underline flex items-center gap-1">
             <Filter size={16} /> Filtros Avanzados
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex gap-4">
             <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input 
                    type="text" 
                    placeholder="Buscar por ID de notificación, usuario o acción..." 
                    className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
             </div>
        </div>
        
        <table className="w-full text-left border-collapse">
            <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                    <th className="p-4 font-semibold">Timestamp</th>
                    <th className="p-4 font-semibold">Actor</th>
                    <th className="p-4 font-semibold">Acción</th>
                    <th className="p-4 font-semibold">Objetivo (ID)</th>
                    <th className="p-4 font-semibold">Detalles</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                {MOCK_AUDIT_LOG.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-50">
                        <td className="p-4 whitespace-nowrap font-mono text-gray-500">{entry.timestamp}</td>
                        <td className="p-4 font-medium flex items-center gap-2">
                            {entry.actor.includes('System') ? <Shield size={14} className="text-blue-500"/> : <div className="w-2 h-2 rounded-full bg-green-500"></div>}
                            {entry.actor}
                        </td>
                        <td className="p-4">
                            <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-bold border border-gray-200">
                                {entry.action}
                            </span>
                        </td>
                        <td className="p-4 font-mono text-blue-600">{entry.targetId}</td>
                        <td className="p-4 text-gray-600 max-w-md truncate" title={entry.details}>{entry.details}</td>
                    </tr>
                ))}
            </tbody>
        </table>
        <div className="p-4 border-t border-gray-200 bg-gray-50 text-center text-xs text-gray-400">
            End of Append-Only Log. Hash: 8a7b...9c2d
        </div>
      </div>
    </div>
  );
};

export default Audit;
