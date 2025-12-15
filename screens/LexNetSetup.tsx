import React, { useState } from 'react';
import { MOCK_ACCOUNTS } from '../constants';
import { Shield, Key, RefreshCw, AlertTriangle, Download, Monitor, CheckCircle, Smartphone, ArrowRight, Laptop } from 'lucide-react';

const LexNetSetup: React.FC = () => {
  const [showPairing, setShowPairing] = useState(false);
  const [pairingCode, setPairingCode] = useState('');
  const [isPairing, setIsPairing] = useState(false);

  const handlePair = () => {
    setIsPairing(true);
    // Simulate API call to pair agent
    setTimeout(() => {
        setIsPairing(false);
        setShowPairing(false);
        alert("Agente vinculado correctamente. Ahora puede añadir las cuentas detectadas en el equipo.");
    }, 1500);
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-10">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Configuración de Acceso LexNET</h2>
          <p className="text-gray-500">Gestión de Agentes de Escritorio y credenciales criptográficas.</p>
        </div>

        {/* Educational Architecture Banner */}
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
                        <button className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors shadow-lg shadow-blue-900/50">
                            <Download size={18} /> Descargar Agente Vento v2.4 (Windows)
                        </button>
                        <button className="bg-slate-700 hover:bg-slate-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors">
                            Leer documentación técnica
                        </button>
                    </div>
                </div>
                
                {/* Visual Diagram */}
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
            
            {/* Background decoration */}
            <div className="absolute -right-20 -top-40 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl"></div>
        </div>

        {/* Pairing Section */}
        {showPairing ? (
            <div className="bg-white border border-blue-200 rounded-xl p-6 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="max-w-md mx-auto text-center space-y-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto text-blue-600">
                        <Smartphone size={24} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">Vincular Nuevo Agente</h3>
                    <p className="text-sm text-gray-500">
                        1. Abre el Agente Vento en tu escritorio.<br/>
                        2. Ve a "Configuración" > "Vincular Web".<br/>
                        3. Introduce el código de 6 dígitos que aparece en pantalla.
                    </p>
                    <div className="flex gap-2 justify-center pt-2">
                        <input 
                            type="text" 
                            maxLength={6}
                            placeholder="Ej: 884-219"
                            value={pairingCode}
                            onChange={(e) => setPairingCode(e.target.value)}
                            className="text-center text-2xl tracking-widest font-mono uppercase w-48 border border-gray-300 rounded-lg py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
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
                            disabled={pairingCode.length < 3 || isPairing}
                            className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                        >
                            {isPairing ? <RefreshCw className="animate-spin" size={16} /> : <CheckCircle size={16} />}
                            Vincular Agente
                        </button>
                    </div>
                </div>
            </div>
        ) : (
            /* Active Agents & Accounts List */
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <Monitor size={20} className="text-gray-400" />
                        Cuentas Vinculadas
                    </h3>
                    <button 
                        onClick={() => setShowPairing(true)}
                        className="text-sm text-blue-600 font-bold hover:underline flex items-center gap-1"
                    >
                        + Vincular nuevo equipo
                    </button>
                </div>

                <div className="grid gap-4">
                    {MOCK_ACCOUNTS.map(account => (
                        <div key={account.id} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between group hover:border-blue-300 transition-colors">
                            <div className="flex items-center gap-4">
                                <div className="relative">
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${account.status === 'ACTIVE' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}>
                                        <Key size={24} />
                                    </div>
                                    <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5">
                                         <div className={`w-3 h-3 rounded-full border-2 border-white ${account.status === 'ACTIVE' ? 'bg-green-500' : 'bg-orange-500'}`}></div>
                                    </div>
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-900">{account.lawyerName}</h3>
                                    <div className="flex items-center gap-2 text-sm text-gray-500">
                                        <span className="font-mono bg-gray-100 px-1.5 rounded text-xs">{account.barAssociationNumber}</span>
                                        <span className="text-gray-300">•</span>
                                        <span className="flex items-center gap-1 text-xs">
                                            <Monitor size={12} /> PC-DESPACHO-01
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                                        <RefreshCw size={12} /> Última sincro: {account.lastSync}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                {account.status === 'NEEDS_AUTH' && (
                                    <div className="flex items-center gap-2 text-orange-600 text-sm font-bold bg-orange-50 px-3 py-1 rounded-full animate-pulse">
                                        <AlertTriangle size={16} /> Agente desconectado
                                    </div>
                                )}
                                <div className="h-8 w-px bg-gray-200"></div>
                                <button className="text-gray-600 hover:text-blue-600 font-medium text-sm transition-colors">
                                    Configurar
                                </button>
                                <button className="text-red-600 hover:text-red-700 font-medium text-sm hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors">
                                    Desvincular
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}
    </div>
  );
};

export default LexNetSetup;