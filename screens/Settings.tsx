import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Key, Brain, Calendar, Database, Save, Check, AlertCircle, ExternalLink } from 'lucide-react';

interface User {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: string;
}

interface SettingsProps {
  user: User;
}

export default function Settings({ user }: SettingsProps) {
  const [activeTab, setActiveTab] = useState('ai');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [aiSettings, setAiSettings] = useState({
    provider: 'GEMINI',
    apiKey: '',
    hasApiKey: false
  });

  useEffect(() => {
    loadAISettings();
  }, [user.id]);

  const loadAISettings = async () => {
    try {
      const response = await fetch(`/api/users/${user.id}/ai-settings`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setAiSettings({
          provider: data.provider || 'GEMINI',
          apiKey: '',
          hasApiKey: data.hasApiKey || false
        });
      }
    } catch (error) {
      console.error('Error loading AI settings:', error);
    }
  };

  const saveAISettings = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/users/${user.id}/ai-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          provider: aiSettings.provider,
          apiKey: aiSettings.apiKey || undefined
        })
      });

      if (!response.ok) {
        throw new Error('Error al guardar configuración');
      }

      setMessage({ type: 'success', text: 'Configuración guardada correctamente' });
      setAiSettings({ ...aiSettings, apiKey: '', hasApiKey: !!aiSettings.apiKey || aiSettings.hasApiKey });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'ai', label: 'Inteligencia Artificial', icon: Brain },
    { id: 'integrations', label: 'Integraciones', icon: Calendar },
    { id: 'account', label: 'Mi Cuenta', icon: SettingsIcon }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
        <p className="text-gray-500">Gestiona tus preferencias y conexiones</p>
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon size={18} />
            {tab.label}
          </button>
        ))}
      </div>

      {message && (
        <div className={`p-4 rounded-lg flex items-center gap-2 ${
          message.type === 'success' 
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
          {message.text}
        </div>
      )}

      {activeTab === 'ai' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Proveedor de IA</h3>
            <p className="text-sm text-gray-500 mb-4">
              Elige el servicio de IA que prefieras para el análisis de documentos legales.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => setAiSettings({ ...aiSettings, provider: 'GEMINI' })}
                className={`p-4 border-2 rounded-xl text-left transition-all ${
                  aiSettings.provider === 'GEMINI'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold">
                    G
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">Google Gemini</div>
                    <div className="text-sm text-gray-500">gemini-2.0-flash</div>
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  Modelo multimodal avanzado con excelente comprensión de documentos legales.
                </p>
              </button>

              <button
                onClick={() => setAiSettings({ ...aiSettings, provider: 'OPENAI' })}
                className={`p-4 border-2 rounded-xl text-left transition-all ${
                  aiSettings.provider === 'OPENAI'
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center text-white font-bold">
                    O
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">OpenAI / Copilot</div>
                    <div className="text-sm text-gray-500">gpt-4o</div>
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  Modelo GPT-4 optimizado para análisis y extracción de información.
                </p>
              </button>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">API Key Personal</h3>
            <p className="text-sm text-gray-500 mb-4">
              Puedes usar tu propia API key para mayor privacidad y control de costes.
              {aiSettings.hasApiKey && (
                <span className="text-green-600 font-medium"> (API key configurada)</span>
              )}
            </p>

            <div className="flex gap-3">
              <div className="flex-1">
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="password"
                    value={aiSettings.apiKey}
                    onChange={(e) => setAiSettings({ ...aiSettings, apiKey: e.target.value })}
                    placeholder={aiSettings.hasApiKey ? '••••••••••••••••' : `Tu ${aiSettings.provider === 'GEMINI' ? 'GEMINI' : 'OPENAI'}_API_KEY`}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <button
                onClick={saveAISettings}
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                <Save size={18} />
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'integrations' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Calendar className="text-blue-600" size={24} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Microsoft 365</h3>
                  <p className="text-sm text-gray-500">Calendario y correo de Outlook</p>
                </div>
              </div>
              <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2">
                <ExternalLink size={16} />
                Conectar
              </button>
            </div>
            <p className="mt-4 text-sm text-gray-500">
              Sincroniza plazos y vencimientos con tu calendario de Outlook. 
              Recibe notificaciones por email automáticamente.
            </p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                  <Database className="text-purple-600" size={24} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Invento</h3>
                  <p className="text-sm text-gray-500">Gestión de expedientes</p>
                </div>
              </div>
              <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2">
                <Key size={16} />
                Configurar API
              </button>
            </div>
            <p className="mt-4 text-sm text-gray-500">
              Vincula notificaciones de LexNET directamente con expedientes en Invento.
              Sincronización automática de documentos.
            </p>
          </div>
        </div>
      )}

      {activeTab === 'account' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Información de la Cuenta</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Usuario</label>
                <input
                  type="text"
                  value={user.username}
                  disabled
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={user.email}
                  disabled
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input
                  type="text"
                  value={user.fullName}
                  disabled
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
                <input
                  type="text"
                  value={user.role === 'ADMIN' ? 'Administrador' : user.role === 'LAWYER' ? 'Abogado' : 'Asistente'}
                  disabled
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
