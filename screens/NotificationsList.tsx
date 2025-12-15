import React from 'react';
import { MOCK_NOTIFICATIONS } from '../constants';
import { NotificationStatus, Priority } from '../types';
import { FileText, Download, Eye, ExternalLink, Check, AlertTriangle, Clock } from 'lucide-react';

const NotificationsList: React.FC = () => {
    const getStatusBadge = (status: NotificationStatus) => {
        switch (status) {
            case NotificationStatus.TRIAGE_REQUIRED:
                return <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full text-xs font-bold border border-orange-200 flex items-center w-fit gap-1"><AlertTriangle size={10}/> Triage</span>;
            case NotificationStatus.READY_FOR_INVENTO:
                return <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-bold border border-blue-200 flex items-center w-fit gap-1"><Clock size={10}/> Ready</span>;
            case NotificationStatus.SYNCED:
                return <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-bold border border-green-200 flex items-center w-fit gap-1"><Check size={10}/> Synced</span>;
            default:
                return <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs font-bold border border-gray-200">{status}</span>;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Notificaciones</h2>
                    <p className="text-gray-500">Histórico completo de notificaciones descargadas de LexNET.</p>
                </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-xs uppercase tracking-wider">
                            <th className="p-4 font-semibold w-12">#</th>
                            <th className="p-4 font-semibold">Fecha / ID</th>
                            <th className="p-4 font-semibold">Juzgado / Autos</th>
                            <th className="p-4 font-semibold">Tipo</th>
                            <th className="p-4 font-semibold">Expediente Asignado</th>
                            <th className="p-4 font-semibold">Estado</th>
                            <th className="p-4 font-semibold text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                        {MOCK_NOTIFICATIONS.map((item) => (
                            <tr key={item.id} className="hover:bg-gray-50 group">
                                <td className="p-4">
                                    <div className={`w-2 h-2 rounded-full ${item.priority === Priority.HIGH ? 'bg-red-500' : 'bg-gray-300'}`}></div>
                                </td>
                                <td className="p-4">
                                    <div className="font-medium text-gray-900">{new Date(item.downloadedDate).toLocaleDateString()}</div>
                                    <div className="text-xs text-gray-400 font-mono mt-0.5">{item.lexnetId}</div>
                                </td>
                                <td className="p-4 max-w-xs">
                                    <div className="font-medium text-gray-800 truncate" title={item.court}>{item.court}</div>
                                    <div className="text-xs text-blue-600 bg-blue-50 w-fit px-1.5 py-0.5 rounded mt-1">{item.procedureNumber}</div>
                                </td>
                                <td className="p-4">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800">
                                        {item.docType}
                                    </span>
                                </td>
                                <td className="p-4">
                                    {item.suggestedCaseId ? (
                                        <div className="flex items-center gap-1 text-gray-700">
                                            <ExternalLink size={12} className="text-gray-400" />
                                            {item.suggestedCaseId.split(' ')[0]}
                                        </div>
                                    ) : (
                                        <span className="text-gray-400 italic text-xs">-- Sin asignar --</span>
                                    )}
                                </td>
                                <td className="p-4">
                                    {getStatusBadge(item.status)}
                                </td>
                                <td className="p-4 text-right">
                                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button className="p-1.5 text-gray-500 hover:bg-gray-200 rounded-lg tooltip" title="Ver PDF">
                                            <Eye size={16} />
                                        </button>
                                        <button className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg tooltip" title="Descargar Paquete">
                                            <Download size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-center">
                     <button className="text-sm text-gray-500 hover:text-gray-800">Cargar más resultados...</button>
                </div>
            </div>
        </div>
    );
};

export default NotificationsList;