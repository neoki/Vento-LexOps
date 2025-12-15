import React, { useState, useEffect } from 'react';
import { MOCK_NOTIFICATIONS } from '../constants';
import { NotificationPackage, Priority, NotificationStatus } from '../types';
import { AlertCircle, Check, X, FileText, ArrowRight, Brain, Calendar, Info, RefreshCcw, Inbox } from 'lucide-react';
import { analyzeLegalText } from '../services/geminiService';

const Triage: React.FC = () => {
  const [selectedId, setSelectedId] = useState<string | null>(MOCK_NOTIFICATIONS[0].id);
  const [processing, setProcessing] = useState(false);
  const [items, setItems] = useState(MOCK_NOTIFICATIONS);
  const [aiSummary, setAiSummary] = useState<string>("");

  const selectedItem = items.find(i => i.id === selectedId);

  useEffect(() => {
    // Simulate AI summary generation when item changes
    if (selectedItem) {
        setAiSummary(""); 
        // Mock snippet extraction
        const snippet = `JUZGADO DE LO SOCIAL Nº 3 DE VIGO. AUTOS ${selectedItem.procedureNumber}. NOTIFICACIÓN SENTENCIA.`;
        
        // Call the service (which handles missing API keys gracefully)
        analyzeLegalText(snippet).then(res => {
            setAiSummary(res.summary);
        });
    }
  }, [selectedItem]);

  const handleApprove = () => {
    if (!selectedItem) return;
    setProcessing(true);
    setTimeout(() => {
        const newItems = items.map(i => i.id === selectedItem.id ? { ...i, status: NotificationStatus.READY_FOR_INVENTO } : i);
        setItems(newItems);
        // Select next pending
        const next = newItems.find(i => i.status === NotificationStatus.TRIAGE_REQUIRED);
        setSelectedId(next ? next.id : null);
        setProcessing(false);
    }, 800);
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Bandeja de Triage</h2>
          <p className="text-gray-500 text-sm">Validación humana requerida para notificaciones con baja confianza AI.</p>
        </div>
        <div className="flex gap-2">
            <span className="bg-yellow-100 text-yellow-800 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                <AlertCircle size={14} />
                {items.filter(i => i.status === NotificationStatus.TRIAGE_REQUIRED).length} Pendientes
            </span>
        </div>
      </div>

      <div className="flex flex-1 gap-6 overflow-hidden">
        {/* List Side */}
        <div className="w-1/3 bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50 font-medium text-gray-700">
            Cola de Trabajo
          </div>
          <div className="overflow-y-auto custom-scrollbar flex-1">
            {items.map(item => (
              <div 
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-blue-50 transition-colors ${selectedId === item.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'border-l-4 border-l-transparent'}`}
              >
                <div className="flex justify-between mb-1">
                    <span className="font-bold text-gray-800 text-sm">{item.court}</span>
                    {item.status === NotificationStatus.READY_FOR_INVENTO && <Check size={16} className="text-green-500"/>}
                </div>
                <div className="text-xs text-gray-500 mb-2">Autos: {item.procedureNumber}</div>
                <div className="flex gap-2">
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-sm ${item.aiConfidence > 80 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        AI Conf: {item.aiConfidence}%
                    </span>
                    <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-sm">
                        {item.docType}
                    </span>
                </div>
              </div>
            ))}
            {items.length === 0 && <div className="p-8 text-center text-gray-400">No hay tareas pendientes.</div>}
          </div>
        </div>

        {/* Detail Side */}
        {selectedItem ? (
          <div className="w-2/3 flex flex-col gap-4 overflow-hidden">
            {/* AI Insight Header */}
            <div className="bg-gradient-to-r from-indigo-50 to-white p-4 rounded-xl border border-indigo-100 shadow-sm flex items-start gap-4">
                <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg mt-1">
                    <Brain size={24} />
                </div>
                <div className="flex-1">
                    <h3 className="text-sm font-bold text-indigo-900 mb-1">Análisis IA (Gemini Flash)</h3>
                    {aiSummary ? (
                        <p className="text-sm text-indigo-800 leading-relaxed italic">"{aiSummary}"</p>
                    ) : (
                        <div className="flex items-center gap-2 text-indigo-400 text-sm">
                            <RefreshCcw size={14} className="animate-spin" /> Analizando documento...
                        </div>
                    )}
                    <div className="mt-3 flex gap-4 text-xs">
                         {selectedItem.aiReasoning.map((r, idx) => (
                             <span key={idx} className="flex items-center gap-1 text-indigo-700 bg-indigo-100/50 px-2 py-1 rounded">
                                 <Info size={12}/> {r}
                             </span>
                         ))}
                    </div>
                </div>
            </div>

            <div className="flex-1 flex gap-4 overflow-hidden">
                {/* Document Preview Placeholder */}
                <div className="flex-1 bg-gray-800 rounded-xl flex flex-col items-center justify-center text-gray-400 border border-gray-700 relative group">
                    <FileText size={48} className="mb-4" />
                    <p>Vista Previa PDF</p>
                    <p className="text-xs mt-2 opacity-50">{selectedItem.lexnetId}.pdf</p>
                    <div className="absolute top-4 right-4 bg-black/50 px-3 py-1 rounded text-xs text-white">
                        Página 1 de 5
                    </div>
                </div>

                {/* Metadata Form */}
                <div className="w-80 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col">
                    <div className="p-4 border-b border-gray-100 font-bold text-gray-800">Datos Extraídos</div>
                    <div className="p-4 flex-1 overflow-y-auto space-y-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Expediente Invento</label>
                            <input 
                                type="text" 
                                className="w-full text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" 
                                defaultValue={selectedItem.suggestedCaseId} 
                            />
                            {selectedItem.aiConfidence < 50 && <p className="text-xs text-red-500 mt-1">Confianza baja. Verificar.</p>}
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Tipo Documento</label>
                            <select className="w-full text-sm border-gray-300 rounded-md" defaultValue={selectedItem.docType}>
                                <option>SENTENCIA</option>
                                <option>AUTO</option>
                                <option>DECRETO</option>
                                <option>MERO_TRAMITE</option>
                            </select>
                        </div>

                        <div className="bg-orange-50 p-3 rounded-lg border border-orange-100">
                            <div className="flex items-center gap-2 mb-2 text-orange-800 font-bold text-xs uppercase">
                                <Calendar size={14} /> Plazos Detectados
                            </div>
                            {selectedItem.extractedDeadlines.length > 0 ? (
                                selectedItem.extractedDeadlines.map(d => (
                                    <div key={d.id} className="mb-2 last:mb-0">
                                        <div className="text-sm font-medium text-gray-800">{d.date}</div>
                                        <div className="text-xs text-gray-600">{d.description}</div>
                                        {d.isFatal && <span className="text-[10px] bg-red-100 text-red-700 px-1 rounded">FATAL</span>}
                                    </div>
                                ))
                            ) : (
                                <p className="text-xs text-gray-400 italic">No se han detectado plazos.</p>
                            )}
                            <button className="mt-2 w-full text-xs text-blue-600 hover:underline text-left">+ Añadir manual</button>
                        </div>
                    </div>
                    
                    <div className="p-4 border-t border-gray-100 bg-gray-50 flex gap-2">
                        <button 
                            className="flex-1 bg-white border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 flex justify-center items-center gap-2"
                        >
                            <X size={16} /> Rechazar
                        </button>
                        <button 
                            onClick={handleApprove}
                            disabled={processing}
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