import React, { useState, useEffect } from 'react';
import { FileText, Download, Eye, ExternalLink, Check, AlertTriangle, Clock, RefreshCcw } from 'lucide-react';

interface Notification {
  id: number;
  lexnetId: string;
  court: string;
  procedureNumber: string;
  procedureType?: string;
  docType?: string;
  status: string;
  priority: string;
  suggestedCaseId?: string;
  inventoCaseId?: string;
  createdAt: string;
}

interface Document {
  id: number;
  fileName: string;
  mimeType: string;
  isPrimary: boolean;
}

const NotificationsList: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingPdf, setViewingPdf] = useState<{ docId: number; fileName: string } | null>(null);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const response = await fetch('/api/notifications', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setNotifications(data);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewPdf = async (notificationId: number) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}/documents`, { credentials: 'include' });
      if (response.ok) {
        const docs: Document[] = await response.json();
        const pdfDoc = docs.find(d => d.mimeType === 'application/pdf' && d.isPrimary) || 
                       docs.find(d => d.mimeType === 'application/pdf');
        if (pdfDoc) {
          setViewingPdf({ docId: pdfDoc.id, fileName: pdfDoc.fileName });
        } else {
          alert('No hay documentos PDF disponibles');
        }
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
    }
  };

  const handleDownload = async (notificationId: number) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}/documents`, { credentials: 'include' });
      if (response.ok) {
        const docs: Document[] = await response.json();
        for (const doc of docs) {
          const link = document.createElement('a');
          link.href = `/api/documents/${doc.id}/download`;
          link.download = doc.fileName;
          link.click();
        }
      }
    } catch (error) {
      console.error('Error downloading:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full text-xs font-bold border border-orange-200 flex items-center w-fit gap-1"><AlertTriangle size={10}/> Pendiente</span>;
      case 'APPROVED':
        return <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-bold border border-green-200 flex items-center w-fit gap-1"><Check size={10}/> Aprobado</span>;
      case 'REJECTED':
        return <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs font-bold border border-red-200 flex items-center w-fit gap-1"><AlertTriangle size={10}/> Rechazado</span>;
      case 'SYNCED':
        return <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-bold border border-blue-200 flex items-center w-fit gap-1"><Check size={10}/> Sincronizado</span>;
      default:
        return <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs font-bold border border-gray-200">{status}</span>;
    }
  };

  const getPriorityDot = (priority: string) => {
    switch (priority) {
      case 'HIGH':
        return 'bg-red-500';
      case 'MEDIUM':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-300';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCcw className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Notificaciones</h2>
          <p className="text-gray-500">Histórico completo de notificaciones descargadas de LexNET.</p>
        </div>
        <button 
          onClick={fetchNotifications}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <RefreshCcw size={16} />
          Actualizar
        </button>
      </div>

      {viewingPdf && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-8">
          <div className="bg-white rounded-xl w-full max-w-5xl h-[80vh] flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-bold">{viewingPdf.fileName}</h3>
              <button 
                onClick={() => setViewingPdf(null)}
                className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                Cerrar
              </button>
            </div>
            <iframe
              src={`/api/documents/${viewingPdf.docId}/pdf`}
              className="flex-1 w-full"
              title="Vista previa PDF"
            />
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-xs uppercase tracking-wider">
              <th className="p-4 font-semibold w-12">#</th>
              <th className="p-4 font-semibold">Fecha / ID</th>
              <th className="p-4 font-semibold">Juzgado / Autos</th>
              <th className="p-4 font-semibold">Tipo</th>
              <th className="p-4 font-semibold">Expediente</th>
              <th className="p-4 font-semibold">Estado</th>
              <th className="p-4 font-semibold text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
            {notifications.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-gray-500">
                  No hay notificaciones. Sube un paquete ZIP de LexNET para comenzar.
                </td>
              </tr>
            ) : (
              notifications.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 group">
                  <td className="p-4">
                    <div className={`w-2 h-2 rounded-full ${getPriorityDot(item.priority)}`}></div>
                  </td>
                  <td className="p-4">
                    <div className="font-medium text-gray-900">{new Date(item.createdAt).toLocaleDateString('es-ES')}</div>
                    <div className="text-xs text-gray-400 font-mono mt-0.5">{item.lexnetId}</div>
                  </td>
                  <td className="p-4 max-w-xs">
                    <div className="font-medium text-gray-800 truncate" title={item.court}>{item.court}</div>
                    <div className="text-xs text-blue-600 bg-blue-50 w-fit px-1.5 py-0.5 rounded mt-1">{item.procedureNumber}</div>
                  </td>
                  <td className="p-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800">
                      {item.docType || item.procedureType || 'N/A'}
                    </span>
                  </td>
                  <td className="p-4">
                    {item.inventoCaseId || item.suggestedCaseId ? (
                      <div className="flex items-center gap-1 text-gray-700">
                        <ExternalLink size={12} className="text-gray-400" />
                        {item.inventoCaseId || item.suggestedCaseId}
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
                      <button 
                        onClick={() => handleViewPdf(item.id)}
                        className="p-1.5 text-gray-500 hover:bg-gray-200 rounded-lg" 
                        title="Ver PDF"
                      >
                        <Eye size={16} />
                      </button>
                      <button 
                        onClick={() => handleDownload(item.id)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg" 
                        title="Descargar"
                      >
                        <Download size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default NotificationsList;
