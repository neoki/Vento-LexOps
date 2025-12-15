import React, { useEffect, useState } from 'react';
import { Building2, Users, Palette, Calendar, FileText, Plus, Edit, Trash2, Save, X } from 'lucide-react';

interface Office {
  id: number;
  name: string;
  code: string;
  timezone: string;
  isActive: boolean;
}

interface Team {
  id: number;
  name: string;
  code: string;
  officeId: number;
  description: string;
  isActive: boolean;
}

interface Category {
  id: number;
  name: string;
  code: string;
  outlookCategoryName: string;
  outlookColor: string;
  emailHighlightColor: string;
  isActive: boolean;
}

type Tab = 'offices' | 'teams' | 'categories' | 'holidays' | 'deadlines' | 'templates';

const Configuration: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('offices');
  const [offices, setOffices] = useState<Office[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      switch (activeTab) {
        case 'offices':
          const officesRes = await fetch('/api/config/offices', { credentials: 'include' });
          setOffices(await officesRes.json());
          break;
        case 'teams':
          const teamsRes = await fetch('/api/config/teams', { credentials: 'include' });
          setTeams(await teamsRes.json());
          break;
        case 'categories':
          const categoriesRes = await fetch('/api/config/categories', { credentials: 'include' });
          setCategories(await categoriesRes.json());
          break;
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveOffice = async (office: Partial<Office>) => {
    try {
      const method = office.id ? 'PUT' : 'POST';
      const url = office.id ? `/api/config/offices/${office.id}` : '/api/config/offices';
      
      await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(office)
      });
      
      fetchData();
      setShowForm(false);
      setEditingItem(null);
    } catch (error) {
      console.error('Error saving office:', error);
    }
  };

  const saveTeam = async (team: Partial<Team>) => {
    try {
      const method = team.id ? 'PUT' : 'POST';
      const url = team.id ? `/api/config/teams/${team.id}` : '/api/config/teams';
      
      await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(team)
      });
      
      fetchData();
      setShowForm(false);
      setEditingItem(null);
    } catch (error) {
      console.error('Error saving team:', error);
    }
  };

  const saveCategory = async (category: Partial<Category>) => {
    try {
      const method = category.id ? 'PUT' : 'POST';
      const url = category.id ? `/api/config/categories/${category.id}` : '/api/config/categories';
      
      await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(category)
      });
      
      fetchData();
      setShowForm(false);
      setEditingItem(null);
    } catch (error) {
      console.error('Error saving category:', error);
    }
  };

  const tabs = [
    { id: 'offices' as Tab, label: 'Oficinas', icon: <Building2 size={18} /> },
    { id: 'teams' as Tab, label: 'Equipos', icon: <Users size={18} /> },
    { id: 'categories' as Tab, label: 'Categorías/Colores', icon: <Palette size={18} /> },
    { id: 'holidays' as Tab, label: 'Festivos', icon: <Calendar size={18} /> },
    { id: 'deadlines' as Tab, label: 'Reglas de plazos', icon: <Calendar size={18} /> },
    { id: 'templates' as Tab, label: 'Plantillas', icon: <FileText size={18} /> }
  ];

  const renderOfficesTab = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-medium">Oficinas configuradas</h3>
        <button 
          onClick={() => { setEditingItem({}); setShowForm(true); }}
          className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus size={16} />
          Nueva oficina
        </button>
      </div>

      {offices.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No hay oficinas configuradas
        </div>
      ) : (
        <div className="grid gap-4">
          {offices.map(office => (
            <div key={office.id} className="p-4 bg-gray-50 rounded-lg flex items-center justify-between">
              <div>
                <div className="font-medium">{office.name}</div>
                <div className="text-sm text-gray-500">Código: {office.code} • {office.timezone}</div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => { setEditingItem(office); setShowForm(true); }}
                  className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                >
                  <Edit size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <OfficeForm 
          office={editingItem}
          onSave={saveOffice}
          onCancel={() => { setShowForm(false); setEditingItem(null); }}
        />
      )}
    </div>
  );

  const renderTeamsTab = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-medium">Equipos configurados</h3>
        <button 
          onClick={() => { setEditingItem({}); setShowForm(true); }}
          className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus size={16} />
          Nuevo equipo
        </button>
      </div>

      {teams.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No hay equipos configurados
        </div>
      ) : (
        <div className="grid gap-4">
          {teams.map(team => (
            <div key={team.id} className="p-4 bg-gray-50 rounded-lg flex items-center justify-between">
              <div>
                <div className="font-medium">{team.name}</div>
                <div className="text-sm text-gray-500">
                  Código: {team.code} • {team.description || 'Sin descripción'}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => { setEditingItem(team); setShowForm(true); }}
                  className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                >
                  <Edit size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <TeamForm 
          team={editingItem}
          offices={offices}
          onSave={saveTeam}
          onCancel={() => { setShowForm(false); setEditingItem(null); }}
        />
      )}
    </div>
  );

  const renderCategoriesTab = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-medium">Categorías y colores</h3>
        <button 
          onClick={() => { setEditingItem({}); setShowForm(true); }}
          className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus size={16} />
          Nueva categoría
        </button>
      </div>

      {categories.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No hay categorías configuradas
        </div>
      ) : (
        <div className="grid gap-4">
          {categories.map(category => (
            <div key={category.id} className="p-4 bg-gray-50 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div 
                  className="w-6 h-6 rounded-full border-2 border-white shadow"
                  style={{ backgroundColor: category.outlookColor || '#3b82f6' }}
                />
                <div>
                  <div className="font-medium">{category.name}</div>
                  <div className="text-sm text-gray-500">
                    Outlook: {category.outlookCategoryName || category.code}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => { setEditingItem(category); setShowForm(true); }}
                  className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                >
                  <Edit size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <CategoryForm 
          category={editingItem}
          onSave={saveCategory}
          onCancel={() => { setShowForm(false); setEditingItem(null); }}
        />
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configuración del sistema</h1>
        <p className="text-gray-500 mt-1">Gestiona oficinas, equipos, categorías y reglas</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <div className="flex overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setShowForm(false); }}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap ${
                  activeTab === tab.id 
                    ? 'border-blue-600 text-blue-600' 
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <>
              {activeTab === 'offices' && renderOfficesTab()}
              {activeTab === 'teams' && renderTeamsTab()}
              {activeTab === 'categories' && renderCategoriesTab()}
              {activeTab === 'holidays' && <div className="text-gray-500 text-center py-8">Configuración de festivos próximamente</div>}
              {activeTab === 'deadlines' && <div className="text-gray-500 text-center py-8">Configuración de reglas de plazos próximamente</div>}
              {activeTab === 'templates' && <div className="text-gray-500 text-center py-8">Configuración de plantillas próximamente</div>}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const OfficeForm: React.FC<{ office: any; onSave: (o: any) => void; onCancel: () => void }> = ({ office, onSave, onCancel }) => {
  const [form, setForm] = useState({
    name: office.name || '',
    code: office.code || '',
    timezone: office.timezone || 'Europe/Madrid'
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
        <h3 className="text-lg font-bold mb-4">{office.id ? 'Editar oficina' : 'Nueva oficina'}</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="Oficina A Coruña"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Código</label>
            <input
              type="text"
              value={form.code}
              onChange={e => setForm({ ...form, code: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="JLC"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Zona horaria</label>
            <select
              value={form.timezone}
              onChange={e => setForm({ ...form, timezone: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="Europe/Madrid">Europe/Madrid</option>
              <option value="Atlantic/Canary">Atlantic/Canary</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onCancel} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">
            Cancelar
          </button>
          <button 
            onClick={() => onSave({ ...office, ...form })} 
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
};

const TeamForm: React.FC<{ team: any; offices: Office[]; onSave: (t: any) => void; onCancel: () => void }> = ({ team, offices, onSave, onCancel }) => {
  const [form, setForm] = useState({
    name: team.name || '',
    code: team.code || '',
    officeId: team.officeId || '',
    description: team.description || ''
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
        <h3 className="text-lg font-bold mb-4">{team.id ? 'Editar equipo' : 'Nuevo equipo'}</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="Jurídico Laboral"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Código</label>
            <input
              type="text"
              value={form.code}
              onChange={e => setForm({ ...form, code: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="JL"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Oficina</label>
            <select
              value={form.officeId}
              onChange={e => setForm({ ...form, officeId: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">Seleccionar oficina</option>
              {offices.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <input
              type="text"
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="Descripción del equipo"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onCancel} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">
            Cancelar
          </button>
          <button 
            onClick={() => onSave({ ...team, ...form })} 
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
};

const CategoryForm: React.FC<{ category: any; onSave: (c: any) => void; onCancel: () => void }> = ({ category, onSave, onCancel }) => {
  const [form, setForm] = useState({
    name: category.name || '',
    code: category.code || '',
    outlookCategoryName: category.outlookCategoryName || '',
    outlookColor: category.outlookColor || '#3b82f6',
    emailHighlightColor: category.emailHighlightColor || '#fef3c7'
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
        <h3 className="text-lg font-bold mb-4">{category.id ? 'Editar categoría' : 'Nueva categoría'}</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="Pablo García"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Código</label>
            <input
              type="text"
              value={form.code}
              onChange={e => setForm({ ...form, code: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="JL-PABLO"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categoría Outlook</label>
            <input
              type="text"
              value={form.outlookCategoryName}
              onChange={e => setForm({ ...form, outlookCategoryName: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="JL-PABLO"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Color Outlook</label>
              <input
                type="color"
                value={form.outlookColor}
                onChange={e => setForm({ ...form, outlookColor: e.target.value })}
                className="w-full h-10 rounded-lg cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Color Email</label>
              <input
                type="color"
                value={form.emailHighlightColor}
                onChange={e => setForm({ ...form, emailHighlightColor: e.target.value })}
                className="w-full h-10 rounded-lg cursor-pointer"
              />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onCancel} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">
            Cancelar
          </button>
          <button 
            onClick={() => onSave({ ...category, ...form })} 
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
};

export default Configuration;
