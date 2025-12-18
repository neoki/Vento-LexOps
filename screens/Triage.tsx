import React, { useState, useEffect } from 'react';
import { AlertCircle, Check, X, FileText, Brain, Calendar, Info, RefreshCcw, Inbox, Trash2, ChevronDown } from 'lucide-react';

interface TriageNotification {
  id: number;
  lexnetId: string;
  court: string;
  procedureNumber: string;
  procedureType?: string;
  actType?: string;
  docType?: string;
  status: string;
  priority: string;
  aiConfidence?: number;
  aiReasoning?: string[];
  aiEvidences?: string[];
  extractedDeadlines?: Array<{ type: string; date: string; description: string; days?: number }>;
  suggestedCaseId?: string;
  parties?: { client?: string; opponent?: string };
  createdAt: string;
}

interface Document {
  id: number;
  fileName: string;
  mimeType: string;
  isPrimary: boolean;
  isReceipt: boolean;
  fileSize: number;
}

const Triage: React.FC = () => {
  const [items, setItems] = useState<TriageNotification[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [processing, setProcessing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);

  const selectedItem = items.find(i => i.id === selectedId);

  useEffect(() => {
    fetchNotifications();
  }, []);

  useEffect(() => {
    if (selectedId) {
      fetchDocuments(selectedId);
    }
  }, [selectedId]);

  const fetchNotifications = async () => {
    try {
      const response = await fetch('/api/notifications', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setItems(data);
        if (data.length > 0 && !selectedId) {
          setSelectedId(data[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDocuments = async (notificationId: number) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}/documents`, { credentials: 'include' });
      if (response.ok) {
        const docs = await response.json();
        const pdfDocs = docs.filter((d: Document) => d.mimeType === 'application/pdf');
        setDocuments(pdfDocs);
        const primary = pdfDocs.find((d: Document) => d.isPrimary);
        const firstNonReceipt = pdfDocs.find((d: Document) => !d.isReceipt);
        setSelectedDocId(primary?.id || firstNonReceipt?.id || pdfDocs[0]?.id || null);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
      setDocuments([]);
      setSelectedDocId(null);
    }
  };

  const handleApprove = async () => {
    if (!selectedItem) return;
    setProcessing(true);
    try {
      const response = await fetch(`/api/notifications/${selectedItem.id}/approve`, {
        method: 'POST',
        credentials: 'include'
      });
      if (response.ok) {
        await fetchNotifications();
        const pending = items.filter(i => i.status === 'PENDING' && i.id !== selectedItem.id);
        setSelectedId(pending.length > 0 ? pending[0].id : null);
      }
    } catch (error) {
      console.error('Error approving:', error);
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedItem) return;
    setProcessing(true);
    try {
      const response = await fetch(`/api/notifications/${selectedItem.id}/reject`, {
        method: 'POST',
        credentials: 'include'
      });
      if (response.ok) {
        await fetchNotifications();
        const pending = items.filter(i => i.status === 'PENDING' && i.id !== selectedItem.id);
        setSelectedId(pending.length > 0 ? pending[0].id : null);
      }
    } catch (error) {
      console.error('Error rejecting:', error);
    } finally {
      setProcessing(false);
    }
  };

  const handleClearAll = async () => {
    if (!confirm('¿Estás seguro de que quieres eliminar todas las notificaciones?')) return;
    try {
      const response = await fetch('/api/notifications/clear', {
        method: 'DELETE',
        credentials: 'include'
      });
      if (response.ok) {
        setItems([]);
        setSelectedId(null);
      }
    } catch (error) {
      console.error('Error clearing:', error);
    }
  };

  const pendingCount = items.filter(i => i.status === 'PENDING').length;

  if (loading) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
        <RefreshCcw className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Bandeja de Triaje</h2>
          <p className="text-gray-500 text-sm">Validación humana requerida para notificaciones con baja confianza IA.</p>
        </div>
        <div className="flex gap-2">
          <span className="bg-yellow-100 text-yellow-800 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
            <AlertCircle size={14} />
            {pendingCount} Pendientes
          </span>
          {items.length > 0 && (
            <button
              onClick={handleClearAll}
              className="bg-red-100 text-red-700 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 hover:bg-red-200"
            >
              <Trash2 size={14} />
              Limpiar todo
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-1 gap-6 overflow-hidden">
        <div className="w-1/3 bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50 font-medium text-gray-700">
            Cola de Trabajo ({items.length})
          </div>
          <div className="overflow-y-auto custom-scrollbar flex-1">
            {items.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <Inbox size={32} className="mx-auto mb-2 opacity-50" />
                <p>No hay notificaciones</p>
                <p className="text-xs mt-1">Sube un paquete LexNET para comenzar</p>
              </div>
            ) : (
              items.map(item => (
                <div 
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-blue-50 transition-colors ${selectedId === item.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'border-l-4 border-l-transparent'}`}
                >
                  <div className="flex justify-between mb-1">
                    <span className="font-bold text-gray-800 text-sm truncate">{item.court}</span>
                    {item.status === 'APPROVED' && <Check size={16} className="text-green-500"/>}
                    {item.status === 'REJECTED' && <X size={16} className="text-red-500"/>}
                  </div>
                  <div className="text-xs text-gray-500 mb-2">Autos: {item.procedureNumber}</div>
                  <div className="flex gap-2 flex-wrap">
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-sm ${(item.aiConfidence || 0) > 80 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      IA: {item.aiConfidence || 0}%
                    </span>
                    {item.docType && (
                      <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-sm">
                        {item.docType}
                      </span>
                    )}
                    <span className={`text-[10px] px-2 py-0.5 rounded-sm ${
                      item.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                      item.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {item.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {selectedItem ? (
          <div className="w-2/3 flex flex-col gap-4 overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-50 to-white p-4 rounded-xl border border-indigo-100 shadow-sm flex items-start gap-4">
              <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg mt-1">
                <Brain size={24} />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-indigo-900 mb-1">Análisis IA (Gemini)</h3>
                <p className="text-sm text-indigo-800">
                  Confianza: {selectedItem.aiConfidence || 0}%
                  {(selectedItem.aiConfidence || 0) < 50 && (
                    <span className="text-red-600 ml-2">- Requiere revisión manual</span>
                  )}
                </p>
                {selectedItem.aiReasoning && selectedItem.aiReasoning.length > 0 && (
                  <div className="mt-3 flex gap-4 text-xs flex-wrap">
                    {selectedItem.aiReasoning.map((r, idx) => (
                      <span key={idx} className="flex items-center gap-1 text-indigo-700 bg-indigo-100/50 px-2 py-1 rounded">
                        <Info size={12}/> {r}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 flex gap-4 overflow-hidden">
              <div className="flex-1 bg-gray-800 rounded-xl flex flex-col overflow-hidden border border-gray-700">
                {documents.length > 1 && (
                  <div className="p-2 bg-gray-900 border-b border-gray-700 flex items-center gap-2">
                    <label className="text-xs text-gray-400">Documento:</label>
                    <select
                      value={selectedDocId || ''}
                      onChange={(e) => setSelectedDocId(parseInt(e.target.value))}
                      className="flex-1 text-xs bg-gray-700 text-white border-gray-600 rounded px-2 py-1"
                    >
                      {documents.map(doc => (
                        <option key={doc.id} value={doc.id}>
                          {doc.fileName} {doc.isPrimary ? '(Principal)' : ''} {doc.isReceipt ? '(Justificante)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {selectedDocId ? (
                  <iframe
                    src={`/api/documents/${selectedDocId}/pdf`}
                    className="flex-1 w-full bg-white"
                    title="Vista previa PDF"
                  />
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                    <FileText size={48} className="mb-4" />
                    <p>No hay documentos PDF disponibles</p>
                  </div>
                )}
              </div>

              <div className="w-80 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col">
                <div className="p-4 border-b border-gray-100 font-bold text-gray-800">Datos Extraídos</div>
                <div className="p-4 flex-1 overflow-y-auto space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Juzgado</label>
                    <input 
                      type="text" 
                      className="w-full text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" 
                      defaultValue={selectedItem.court} 
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Procedimiento</label>
                    <input 
                      type="text" 
                      className="w-full text-sm border-gray-300 rounded-md" 
                      defaultValue={selectedItem.procedureNumber} 
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Tipo Documento</label>
                    <select className="w-full text-sm border-gray-300 rounded-md" defaultValue={selectedItem.docType || ''}>
                      <option value="">Sin determinar</option>
                      <option>SENTENCIA</option>
                      <option>AUTO</option>
                      <option>DECRETO</option>
                      <option>PROVIDENCIA</option>
                      <option>DILIGENCIA</option>
                      <option>CITACION</option>
                    </select>
                  </div>

                  {selectedItem.parties && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Partes</label>
                      <div className="text-sm text-gray-700">
                        {selectedItem.parties.client && <p>Cliente: {selectedItem.parties.client}</p>}
                        {selectedItem.parties.opponent && <p>Contrario: {selectedItem.parties.opponent}</p>}
                      </div>
                    </div>
                  )}

                  <div className="bg-orange-50 p-3 rounded-lg border border-orange-100">
                    <div className="flex items-center gap-2 mb-2 text-orange-800 font-bold text-xs uppercase">
                      <Calendar size={14} /> Plazos Detectados
                    </div>
                    {selectedItem.extractedDeadlines && selectedItem.extractedDeadlines.length > 0 ? (
                      selectedItem.extractedDeadlines.map((d, idx) => (
                        <div key={idx} className="mb-2 last:mb-0">
                          <div className="text-sm font-medium text-gray-800">{d.date}</div>
                          <div className="text-xs text-gray-600">{d.description}</div>
                          {d.days && <span className="text-[10px] bg-blue-100 text-blue-700 px-1 rounded">{d.days} días</span>}
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-gray-400 italic">No se han detectado plazos.</p>
                    )}
                  </div>

                  {selectedItem.suggestedCaseId && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Expediente Sugerido</label>
                      <input 
                        type="text" 
                        className="w-full text-sm border-gray-300 rounded-md" 
                        defaultValue={selectedItem.suggestedCaseId} 
                      />
                    </div>
                  )}
                </div>
                
                <div className="p-4 border-t border-gray-100 bg-gray-50 flex gap-2">
                  <button 
                    onClick={handleReject}
                    disabled={processing || selectedItem.status !== 'PENDING'}
                    className="flex-1 bg-white border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 flex justify-center items-center gap-2 disabled:opacity-50"
                  >
                    <X size={16} /> Rechazar
                  </button>
                  <button 
                    onClick={handleApprove}
                    disabled={processing || selectedItem.status !== 'PENDING'}
                    className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 flex justify-center items-center gap-2 disabled:opacity-50"
                  >
                    {processing ? <RefreshCcw className="animate-spin" size={16}/> : <><Check size={16} /> Aprobar</>}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 flex-col">
            <Inbox size={48} className="mb-4 text-gray-300" />
            <p>Selecciona una notificación para revisar</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Triage;
