import React, { useState, useEffect } from 'react';
import { Shield, Key, RefreshCw, AlertTriangle, Download, Monitor, CheckCircle, Smartphone, Laptop, Trash2, Settings, ExternalLink } from 'lucide-react';

interface Agent {
  id: number;
  agentId: string;
  name: string;
  status: string;
  lastHeartbeat: string | null;
  hostInfo: any;
  certificateThumbprint: string | null;
  pollingIntervalSeconds: number;
  createdAt: string;
}

interface AgentDownloadInfo {
  available: boolean;
  version: string;
  releaseDate: string;
  sizeFormatted: string | null;
  downloadUrl: string | null;
}

const LexNetSetup: React.FC = () => {
  const [showPairing, setShowPairing] = useState(false);
  const [pairingCode, setPairingCode] = useState('');
  const [isPairing, setIsPairing] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadInfo, setDownloadInfo] = useState<AgentDownloadInfo | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [showDocs, setShowDocs] = useState(false);

  useEffect(() => {
    fetchAgents();
    fetchDownloadInfo();
  }, []);

  const fetchAgents = async () => {
    try {
      const res = await fetch('/api/agents', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setAgents(data);
      }
    } catch (error) {
      console.error('Error fetching agents:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDownloadInfo = async () => {
    try {
      const res = await fetch('/api/agent/download-info', { credentials: 'include' });
      if (res.ok) {
        setDownloadInfo(await res.json());
      }
    } catch (error) {
      console.error('Error fetching download info:', error);
    }
  };

  const handlePair = async () => {
    setIsPairing(true);
    setTimeout(() => {
      setIsPairing(false);
      setShowPairing(false);
      setPairingCode('');
      alert("El agente se vinculará automáticamente cuando envíe su primer heartbeat. Ejecuta el agente en el PC de escritorio.");
    }, 1000);
  };

  const handleUnlink = async (agentId: number) => {
    if (!confirm('¿Estás seguro de que quieres desvincular este agente? Se eliminarán también sus logs.')) {
      return;
    }
    
    setDeletingId(agentId);
    try {
      const res = await fetch(`/api/agents/${agentId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (res.ok) {
        setAgents(agents.filter(a => a.id !== agentId));
      } else {
        const data = await res.json();
        alert(data.error || 'Error desvinculando agente');
      }
    } catch (error) {
      console.error('Error unlinking agent:', error);
      alert('Error de conexión');
    } finally {
      setDeletingId(null);
    }
  };

  const getAgentStatus = (agent: Agent) => {
    if (!agent.lastHeartbeat) return { status: 'NEVER_CONNECTED', label: 'Nunca conectado', color: 'gray' };
    
    const lastSeen = new Date(agent.lastHeartbeat).getTime();
    const now = Date.now();
    const diffMinutes = (now - lastSeen) / 1000 / 60;
    
    if (diffMinutes < 2) return { status: 'ONLINE', label: 'Conectado', color: 'green' };
    if (diffMinutes < 30) return { status: 'RECENT', label: `Hace ${Math.round(diffMinutes)} min`, color: 'yellow' };
    if (diffMinutes < 1440) return { status: 'OFFLINE', label: `Hace ${Math.round(diffMinutes / 60)} horas`, color: 'orange' };
    return { status: 'OFFLINE', label: `Hace ${Math.round(diffMinutes / 1440)} días`, color: 'red' };
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Nunca';
    const date = new Date(dateStr);
    return date.toLocaleString('es-ES', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-10">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Configuración de Acceso LexNET</h2>
        <p className="text-gray-500">Gestión de Agentes de Escritorio y credenciales criptográficas.</p>
      </div>

      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-8 text-white shadow-lg overflow-hidden relative">
        <div className="relative z-10 flex flex-col md:flex-row gap-8 items-center">
          <div className="flex-1 space-y-4">
            <div className="inline-flex items-center gap-2 bg-blue-500/20 border border-blue-500/30 text-blue-300 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide">
              <Shield size={12} /> Arquitectura Segura
            </div>
            <h3 className="text-2xl font-bold">¿Cómo conectamos con LexNET?</h3>
            <p className="text-slate-300 text-sm leading-relaxed">
              LexNET requiere certificados locales (tarjetas ACA/FNMT). Por seguridad, <strong>Vento LexOps no guarda tus certificados en la nube</strong>.
              Utilizamos un "Agente de Escritorio" que instalas en tu PC para actuar como puente seguro.
            </p>
            <div className="flex gap-3 pt-2">
              {downloadInfo?.available ? (
                <a 
                  href={downloadInfo.downloadUrl || '#'}
                  download
                  className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors shadow-lg shadow-blue-900/50"
                >
                  <Download size={18} /> Descargar Agente v{downloadInfo.version} ({downloadInfo.sizeFormatted})
                </a>
              ) : (
                <button 
                  disabled
                  className="bg-slate-600 text-slate-400 px-5 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 cursor-not-allowed"
                >
                  <Download size={18} /> Agente no disponible
                </button>
              )}
              <button 
                onClick={() => setShowDocs(!showDocs)}
                className="bg-slate-700 hover:bg-slate-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                <ExternalLink size={16} />
                {showDocs ? 'Ocultar documentación' : 'Ver documentación técnica'}
              </button>
            </div>
          </div>
          
          <div className="flex items-center gap-4 text-xs font-mono opacity-90 hidden md:flex">
            <div className="flex flex-col items-center gap-2">
              <div className="w-20 h-20 bg-slate-700 rounded-xl flex items-center justify-center border border-slate-600 shadow-xl">
                <Laptop size={32} className="text-blue-400" />
              </div>
              <span className="text-slate-400">Tu PC (Agente)</span>
            </div>
            
            <div className="flex flex-col items-center gap-1">
              <div className="w-24 h-1 bg-gradient-to-r from-blue-500 to-green-500 rounded-full animate-pulse"></div>
              <span className="text-[10px] text-slate-500">Túnel Seguro (TLS)</span>
            </div>

            <div className="flex flex-col items-center gap-2">
              <div className="w-20 h-20 bg-white/10 rounded-xl flex items-center justify-center border border-white/10 backdrop-blur-sm">
                <div className="text-2xl font-serif font-black italic">V</div>
              </div>
              <span className="text-slate-400">Vento Cloud</span>
            </div>
          </div>
        </div>
        
        <div className="absolute -right-20 -top-40 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl"></div>
      </div>

      {showDocs && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Documentación Técnica del Agente</h3>
          
          <div className="space-y-4 text-sm text-gray-600">
            <div>
              <h4 className="font-semibold text-gray-800 mb-2">Requisitos del Sistema</h4>
              <ul className="list-disc list-inside space-y-1">
                <li>Windows 10/11 (64-bit)</li>
                <li>Microsoft Edge o Google Chrome instalado</li>
                <li>Certificado digital instalado (FNMT, ACA, DNIe)</li>
                <li>Conexión a internet</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold text-gray-800 mb-2">Instalación</h4>
              <ol className="list-decimal list-inside space-y-1">
                <li>Descarga el archivo VentoLexOps.exe</li>
                <li>Ejecuta el archivo (Windows puede mostrar una advertencia de SmartScreen - haz clic en "Más información" → "Ejecutar de todos modos")</li>
                <li>El agente aparecerá como icono en la bandeja del sistema (junto al reloj)</li>
                <li>Haz clic derecho en el icono → "Configuración" para ajustar las opciones</li>
              </ol>
            </div>
            
            <div>
              <h4 className="font-semibold text-gray-800 mb-2">Primera Ejecución</h4>
              <p>Cuando inicies el agente por primera vez, Windows mostrará un diálogo para seleccionar el certificado digital. Después de autenticarte una vez, la sesión se mantiene guardada.</p>
            </div>
            
            <div>
              <h4 className="font-semibold text-gray-800 mb-2">Carpeta de Descargas</h4>
              <p>Por defecto, las notificaciones se guardan en: <code className="bg-gray-100 px-2 py-1 rounded">%USERPROFILE%\VentoLexNet</code></p>
              <p>Puedes cambiar esta ubicación en la configuración del agente.</p>
            </div>
          </div>
        </div>
      )}

      {showPairing ? (
        <div className="bg-white border border-blue-200 rounded-xl p-6 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="max-w-md mx-auto text-center space-y-4">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto text-blue-600">
              <Smartphone size={24} />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Vincular Nuevo Agente</h3>
            <p className="text-sm text-gray-500">
              El agente se vinculará automáticamente cuando lo ejecutes en el PC.<br/>
              Solo necesitas descargar e iniciar el agente.
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
              <AlertTriangle className="inline mr-2" size={16} />
              Los agentes aparecen aquí automáticamente cuando envían su primer heartbeat.
            </div>
            <div className="flex gap-3 justify-center pt-2">
              <button 
                onClick={() => setShowPairing(false)}
                className="text-gray-500 hover:text-gray-700 font-medium text-sm px-4 py-2"
              >
                Cancelar
              </button>
              <button 
                onClick={handlePair}
                disabled={isPairing}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {isPairing ? <RefreshCw className="animate-spin" size={16} /> : <CheckCircle size={16} />}
                Entendido
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <Monitor size={20} className="text-gray-400" />
              Agentes Vinculados ({agents.length})
            </h3>
            <button 
              onClick={() => setShowPairing(true)}
              className="text-sm text-blue-600 font-bold hover:underline flex items-center gap-1"
            >
              + Vincular nuevo equipo
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : agents.length === 0 ? (
            <div className="bg-gray-50 rounded-xl p-8 text-center">
              <Monitor className="mx-auto text-gray-300 mb-4" size={48} />
              <h4 className="font-medium text-gray-600 mb-2">No hay agentes vinculados</h4>
              <p className="text-sm text-gray-500 mb-4">
                Descarga e instala el agente en un PC con Windows para empezar a sincronizar notificaciones de LexNET.
              </p>
              {downloadInfo?.available && (
                <a 
                  href={downloadInfo.downloadUrl || '#'}
                  download
                  className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700"
                >
                  <Download size={18} /> Descargar Agente
                </a>
              )}
            </div>
          ) : (
            <div className="grid gap-4">
              {agents.map(agent => {
                const statusInfo = getAgentStatus(agent);
                const statusColors: Record<string, string> = {
                  green: 'bg-green-100 text-green-600',
                  yellow: 'bg-yellow-100 text-yellow-600',
                  orange: 'bg-orange-100 text-orange-600',
                  red: 'bg-red-100 text-red-600',
                  gray: 'bg-gray-100 text-gray-500'
                };
                const dotColors: Record<string, string> = {
                  green: 'bg-green-500',
                  yellow: 'bg-yellow-500',
                  orange: 'bg-orange-500',
                  red: 'bg-red-500',
                  gray: 'bg-gray-400'
                };
                
                return (
                  <div key={agent.id} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between group hover:border-blue-300 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${statusColors[statusInfo.color]}`}>
                          <Key size={24} />
                        </div>
                        <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5">
                          <div className={`w-3 h-3 rounded-full border-2 border-white ${dotColors[statusInfo.color]}`}></div>
                        </div>
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900">{agent.name}</h3>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <span className="font-mono bg-gray-100 px-1.5 rounded text-xs">{agent.agentId}</span>
                          {agent.hostInfo?.hostname && (
                            <>
                              <span className="text-gray-300">•</span>
                              <span className="flex items-center gap-1 text-xs">
                                <Monitor size={12} /> {agent.hostInfo.hostname}
                              </span>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                          <RefreshCw size={12} /> Última conexión: {formatDate(agent.lastHeartbeat)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className={`flex items-center gap-2 text-sm font-medium px-3 py-1 rounded-full ${
                        statusInfo.color === 'green' ? 'bg-green-50 text-green-600' :
                        statusInfo.color === 'yellow' ? 'bg-yellow-50 text-yellow-600' :
                        statusInfo.color === 'orange' ? 'bg-orange-50 text-orange-600' :
                        statusInfo.color === 'red' ? 'bg-red-50 text-red-600' :
                        'bg-gray-50 text-gray-500'
                      }`}>
                        {statusInfo.color !== 'green' && <AlertTriangle size={14} />}
                        {statusInfo.label}
                      </div>
                      <div className="h-8 w-px bg-gray-200"></div>
                      <button 
                        onClick={() => handleUnlink(agent.id)}
                        disabled={deletingId === agent.id}
                        className="text-red-600 hover:text-red-700 font-medium text-sm hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50"
                      >
                        {deletingId === agent.id ? (
                          <RefreshCw className="animate-spin" size={14} />
                        ) : (
                          <Trash2 size={14} />
                        )}
                        Desvincular
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LexNetSetup;
