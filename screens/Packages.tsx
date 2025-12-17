import React, { useEffect, useState } from 'react';
import { Package, Upload, FileText, CheckCircle, AlertCircle, Clock, Eye, Play } from 'lucide-react';

interface LexnetPackage {
  id: number;
  packageId: string;
  lawyerId: number;
  downloadDate: string;
  status: string;
  hasReceipt: boolean;
  zipPath: string;
  errorMessage?: string;
}

const Packages: React.FC = () => {
  const [packages, setPackages] = useState<LexnetPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<LexnetPackage | null>(null);
  const [processing, setProcessing] = useState<number | null>(null);

  useEffect(() => {
    fetchPackages();
  }, []);

  const fetchPackages = async () => {
    try {
      const response = await fetch('/api/packages', { credentials: 'include' });
      const data = await response.json();
      setPackages(data);
    } catch (error) {
      console.error('Error fetching packages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    setUploading(true);
    const formData = new FormData();
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.name.endsWith('.zip')) {
        formData.append('zip', file);
      } else if (file.name.toLowerCase().includes('justificante') || file.name.toLowerCase().endsWith('.pdf')) {
        formData.append('receipt', file);
      }
    }

    try {
      const response = await fetch('/api/packages/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });
      
      if (response.ok) {
        const result = await response.json();
        fetchPackages();
        
        if (result.packageId) {
          await processPackage(result.packageId);
        }
      } else {
        const error = await response.json();
        console.error('Upload failed:', error);
        alert('Error al subir: ' + (error.error || 'Error desconocido'));
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Error de conexión al subir el archivo');
    } finally {
      setUploading(false);
    }
  };

  const processPackage = async (packageId: number) => {
    setProcessing(packageId);
    try {
      const response = await fetch(`/api/packages/${packageId}/process`, {
        method: 'POST',
        credentials: 'include'
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('Process result:', result);
        fetchPackages();
      } else {
        const error = await response.json();
        console.error('Process failed:', error);
        alert('Error al procesar: ' + (error.error || 'Error desconocido'));
      }
    } catch (error) {
      console.error('Process error:', error);
      alert('Error de conexión al procesar');
    } finally {
      setProcessing(null);
    }
  };

  const getStatusBadge = (status: string, hasReceipt: boolean) => {
    const badges: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
      DOWNLOADING: { color: 'bg-blue-100 text-blue-800', icon: <Clock size={14} />, label: 'Descargando' },
      INCOMPLETE: { color: 'bg-yellow-100 text-yellow-800', icon: <AlertCircle size={14} />, label: 'Sin justificante' },
      READY_FOR_ANALYSIS: { color: 'bg-purple-100 text-purple-800', icon: <FileText size={14} />, label: 'Listo para análisis' },
      ANALYZED: { color: 'bg-green-100 text-green-800', icon: <CheckCircle size={14} />, label: 'Analizado' },
      ERROR: { color: 'bg-red-100 text-red-800', icon: <AlertCircle size={14} />, label: 'Error' }
    };

    const badge = badges[status] || badges.DOWNLOADING;
    
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
        {badge.icon}
        {badge.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Paquetes LexNET</h1>
          <p className="text-gray-500 mt-1">Gestiona los paquetes descargados de LexNET</p>
        </div>
        
        <label className="cursor-pointer">
          <input
            type="file"
            multiple
            accept=".zip,.pdf"
            onChange={handleUpload}
            className="hidden"
          />
          <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium ${
            uploading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'
          }`}>
            <Upload size={18} />
            {uploading ? 'Subiendo...' : 'Subir paquete'}
          </span>
        </label>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span className="font-medium">{packages.length}</span> paquetes
            </div>
            <div className="flex items-center gap-2 text-sm text-yellow-600">
              <AlertCircle size={16} />
              <span>{packages.filter(p => p.status === 'INCOMPLETE').length} sin justificante</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle size={16} />
              <span>{packages.filter(p => p.status === 'ANALYZED').length} analizados</span>
            </div>
          </div>
        </div>

        <div className="divide-y divide-gray-200">
          {packages.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Package size={48} className="mx-auto mb-4 opacity-50" />
              <p>No hay paquetes todavía</p>
              <p className="text-sm mt-1">Sube un archivo ZIP de LexNET para comenzar</p>
            </div>
          ) : (
            packages.map(pkg => (
              <div key={pkg.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Package size={20} className="text-blue-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{pkg.packageId}</span>
                        {getStatusBadge(pkg.status, pkg.hasReceipt)}
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        {new Date(pkg.downloadDate).toLocaleString('es-ES')}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setSelectedPackage(pkg)}
                      className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Ver detalles"
                    >
                      <Eye size={18} />
                    </button>
                    {processing === pkg.id ? (
                      <div className="p-2">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                      </div>
                    ) : (pkg.status === 'READY_FOR_ANALYSIS' || pkg.status === 'INCOMPLETE') && (
                      <button 
                        onClick={() => processPackage(pkg.id)}
                        className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Procesar paquete"
                      >
                        <Play size={18} />
                      </button>
                    )}
                  </div>
                </div>
                
                {pkg.errorMessage && (
                  <div className="mt-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                    {pkg.errorMessage}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {selectedPackage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSelectedPackage(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold">Detalles del paquete</h2>
              <p className="text-gray-500">{selectedPackage.packageId}</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-500">Estado</label>
                  <div className="mt-1">{getStatusBadge(selectedPackage.status, selectedPackage.hasReceipt)}</div>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Justificante</label>
                  <div className="mt-1">
                    {selectedPackage.hasReceipt ? (
                      <span className="text-green-600 flex items-center gap-1">
                        <CheckCircle size={16} /> Incluido
                      </span>
                    ) : (
                      <span className="text-yellow-600 flex items-center gap-1">
                        <AlertCircle size={16} /> No incluido
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Fecha descarga</label>
                  <div className="mt-1 font-medium">
                    {new Date(selectedPackage.downloadDate).toLocaleString('es-ES')}
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-2">
              <button 
                onClick={() => setSelectedPackage(null)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cerrar
              </button>
              {selectedPackage.status === 'READY_FOR_ANALYSIS' && (
                <button 
                  onClick={() => {
                    processPackage(selectedPackage.id);
                    setSelectedPackage(null);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Procesar paquete
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Packages;
