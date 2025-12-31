import React, { useState, useEffect } from 'react';
import { 
  Users, Plus, Edit2, Trash2, Check, X, 
  Mail, Phone, Shield, Palette, Save,
  UserPlus, Key, Award
} from 'lucide-react';
import { api } from '../services/api';

interface Lawyer {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: string;
  color: string;
  certificateType?: string;
  certificateThumbprint?: string;
  isActive: boolean;
  teamId?: number;
  teamName?: string;
  pendingNotifications?: number;
}

interface Team {
  id: number;
  name: string;
  code: string;
}

const PRESET_COLORS = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
  '#14B8A6', '#A855F7', '#0EA5E9', '#22C55E', '#EAB308'
];

export default function LawyerManagement() {
  const [lawyers, setLawyers] = useState<Lawyer[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingLawyer, setEditingLawyer] = useState<Lawyer | null>(null);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    fullName: '',
    password: '',
    color: '#3B82F6',
    teamId: '',
    certificateType: '',
    certificateThumbprint: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [lawyersRes, teamsRes] = await Promise.all([
        api.get('/api/manager/lawyers'),
        api.get('/api/teams')
      ]);
      setLawyers(lawyersRes.lawyers || []);
      setTeams(teamsRes.teams || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      if (editingLawyer) {
        await api.put(`/api/manager/lawyers/${editingLawyer.id}`, formData);
      } else {
        await api.post('/api/manager/lawyers', {
          ...formData,
          role: 'LAWYER'
        });
      }
      await loadData();
      closeModal();
    } catch (error) {
      console.error('Error saving lawyer:', error);
      alert('Error al guardar el letrado');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Está seguro de desactivar este letrado?')) return;
    
    try {
      await api.delete(`/api/manager/lawyers/${id}`);
      await loadData();
    } catch (error) {
      console.error('Error deleting lawyer:', error);
    }
  };

  const openEditModal = (lawyer: Lawyer) => {
    setEditingLawyer(lawyer);
    setFormData({
      username: lawyer.username,
      email: lawyer.email,
      fullName: lawyer.fullName,
      password: '',
      color: lawyer.color || '#3B82F6',
      teamId: lawyer.teamId?.toString() || '',
      certificateType: lawyer.certificateType || '',
      certificateThumbprint: lawyer.certificateThumbprint || ''
    });
    setShowAddModal(true);
  };

  const openAddModal = () => {
    setEditingLawyer(null);
    setFormData({
      username: '',
      email: '',
      fullName: '',
      password: '',
      color: PRESET_COLORS[lawyers.length % PRESET_COLORS.length],
      teamId: '',
      certificateType: '',
      certificateThumbprint: ''
    });
    setShowAddModal(true);
  };

  const closeModal = () => {
    setShowAddModal(false);
    setEditingLawyer(null);
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-7 h-7 text-blue-600" />
            Gestión de Letrados
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Administrar abogados, colores y certificados
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <UserPlus className="w-4 h-4" />
          Nuevo Letrado
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Letrado</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Email</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Equipo</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Certificado</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Color</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Estado</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {lawyers.map(lawyer => (
              <tr key={lawyer.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                      style={{ backgroundColor: lawyer.color }}
                    >
                      {lawyer.fullName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{lawyer.fullName}</p>
                      <p className="text-sm text-gray-500">@{lawyer.username}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-600">{lawyer.email}</td>
                <td className="px-4 py-3 text-gray-600">{lawyer.teamName || '-'}</td>
                <td className="px-4 py-3">
                  {lawyer.certificateType ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full">
                      <Key className="w-3 h-3" />
                      {lawyer.certificateType}
                    </span>
                  ) : (
                    <span className="text-gray-400 text-sm">Sin certificado</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div 
                    className="w-8 h-8 rounded-full border-2 border-white shadow-sm"
                    style={{ backgroundColor: lawyer.color }}
                  />
                </td>
                <td className="px-4 py-3">
                  {lawyer.isActive ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 text-xs rounded-full">
                      <Check className="w-3 h-3" />
                      Activo
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 text-red-700 text-xs rounded-full">
                      <X className="w-3 h-3" />
                      Inactivo
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => openEditModal(lawyer)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(lawyer.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {lawyers.length === 0 && !loading && (
          <div className="p-8 text-center text-gray-500">
            No hay letrados registrados
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="font-semibold text-lg">
                {editingLawyer ? 'Editar Letrado' : 'Nuevo Letrado'}
              </h2>
              <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre completo
                </label>
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Juan García López"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Usuario
                  </label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={e => setFormData({ ...formData, username: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="jgarcia"
                    disabled={!!editingLawyer}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="jgarcia@despacho.es"
                  />
                </div>
              </div>
              
              {!editingLawyer && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contraseña
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="••••••••"
                  />
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Equipo
                </label>
                <select
                  value={formData.teamId}
                  onChange={e => setFormData({ ...formData, teamId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Sin equipo</option>
                  {teams.map(team => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Color corporativo
                </label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormData({ ...formData, color })}
                      className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${
                        formData.color === color ? 'border-gray-900 scale-110' : 'border-white shadow-sm'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <input
                    type="color"
                    value={formData.color}
                    onChange={e => setFormData({ ...formData, color: e.target.value })}
                    className="w-8 h-8 rounded-full border-0 cursor-pointer"
                  />
                </div>
              </div>
              
              <div className="border-t pt-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                  <Key className="w-4 h-4" />
                  Certificado Digital
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Tipo</label>
                    <select
                      value={formData.certificateType}
                      onChange={e => setFormData({ ...formData, certificateType: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Sin certificado</option>
                      <option value="ACA">ACA</option>
                      <option value="FNMT">FNMT</option>
                      <option value="OTHER">Otro</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Thumbprint</label>
                    <input
                      type="text"
                      value={formData.certificateThumbprint}
                      onChange={e => setFormData({ ...formData, certificateThumbprint: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="ABC123..."
                    />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
