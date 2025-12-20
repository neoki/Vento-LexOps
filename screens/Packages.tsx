import React, { useEffect, useState } from 'react';
import { Package, Upload, FileText, CheckCircle, AlertCircle, Clock, Eye, Play, Trash2, X } from 'lucide-react';

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

interface Document {
  id: number;
  fileName: string;
  mimeType: string;
  isPrimary: boolean;
  isReceipt: boolean;
  fileSize: number;
}

interface Notification {
  id: number;
  court: string;
  procedureNumber: string;
  status: string;
  docType?: string;
}

const Packages: React.FC = () => {
  const [packages, setPackages] = useState<LexnetPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<LexnetPackage | null>(null);
  const [packageDocuments, setPackageDocuments] = useState<Document[]>([]);
  const [packageNotifications, setPackageNotifications] = useState<Notification[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [processing, setProcessing] = useState<number | null>(null);

  useEffect(() => {
    fetchPackages();
  }, []);

  const viewPackageDetails = async (pkg: LexnetPackage) => {
    setSelectedPackage(pkg);
    setLoadingDetails(true);
    setPackageDocuments([]);
    setPackageNotifications([]);
    
    try {
      const [docsRes, notifsRes] = await Promise.all([
        fetch(`/api/packages/${pkg.id}/documents`, { credentials: 'include' }),
        fetch('/api/notifications', { credentials: 'include' })
      ]);
      
      if (docsRes.ok) {
        const docs = await docsRes.json();
        setPackageDocuments(docs.filter((d: Document) => d.mimeType === 'application/pdf'));
      }
      
      if (notifsRes.ok) {
        const allNotifs = await notifsRes.json();
        const pkgNotifs = allNotifs.filter((n: any) => n.packageId === pkg.id);
        setPackageNotifications(pkgNotifs);
      }
    } catch (error) {
      console.error('Error loading package details:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

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
    if (!files || files.length === 0) {
      alert('No se seleccionaron archivos');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    let hasZip = false;
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      console.log('File:', file.name, 'Size:', file.size, 'Type:', file.type);
      if (file.name.endsWith('.zip')) {
        formData.append('zip', file);
        hasZip = true;
      } else if (file.name.toLowerCase().includes('justificante') || file.name.toLowerCase().endsWith('.pdf')) {
        formData.append('receipt', file);
      }
    }

    if (!hasZip) {
      alert('Por favor selecciona un archivo ZIP');
      setUploading(false);
      return;
    }

    try {
      console.log('Uploading to /api/packages/upload...');
      
      const testResponse = await fetch('/api/packages', { credentials: 'include' });
      if (testResponse.status === 401) {
        alert('Tu sesión ha expirado. Por favor inicia sesión de nuevo.');
        window.location.href = '/';
        return;
      }
      
      const response = await fetch('/api/packages/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });
      
      console.log('Upload response status:', response.status);
      
      if (response.ok) {
        const result = await response.json();
        console.log('Upload result:', result);
        fetchPackages();
        
        if (result.packageId) {
          await processPackage(result.packageId);
        }
      } else {
        const errorText = await response.text();
        console.error('Upload failed:', response.status, errorText);
        try {
          const error = JSON.parse(errorText);
          alert('Error al subir: ' + (error.error || 'Error desconocido'));
        } catch {
          alert('Error al subir: ' + errorText);
        }
      }
    } catch (error: any) {
      console.error('Upload error:', error?.message || error);
      alert('Error de conexión: ' + (error?.message || 'Revisa que el servidor esté activo'));
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

  const deletePackage = async (packageId: number) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este paquete? También se eliminarán las notificaciones asociadas.')) {
      return;
    }
    try {
      const response = await fetch(`/api/packages/${packageId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (response.ok) {
        fetchPackages();
      } else {
        alert('Error al eliminar el paquete');
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('Error de conexión al eliminar');
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
                      onClick={() => viewPackageDetails(pkg)}
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
                    <button 
                      onClick={() => deletePackage(pkg.id)}
                      className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Eliminar paquete"
                    >
                      <Trash2 size={18} />
                    </button>
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
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200 flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold">Detalles del paquete</h2>
                <p className="text-gray-500">{selectedPackage.packageId}</p>
              </div>
              <button onClick={() => setSelectedPackage(null)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-3 gap-4">
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

              {loadingDetails ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <>
                  <div>
                    <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <FileText size={18} /> Documentos ({packageDocuments.length})
                    </h3>
                    {packageDocuments.length > 0 ? (
                      <div className="border border-gray-200 rounded-lg divide-y">
                        {packageDocuments.map(doc => (
                          <div key={doc.id} className="p-3 flex items-center justify-between hover:bg-gray-50">
                            <div className="flex items-center gap-3">
                              <FileText size={16} className="text-red-500" />
                              <span className="text-sm">{doc.fileName}</span>
                              {doc.isPrimary && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Principal</span>}
                              {doc.isReceipt && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Justificante</span>}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-400">{(doc.fileSize / 1024).toFixed(1)} KB</span>
                              <a 
                                href={`/api/documents/${doc.id}/pdf`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 text-sm"
                              >
                                Ver PDF
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-400 text-sm italic">No hay documentos extraídos</p>
                    )}
                  </div>

                  <div>
                    <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <AlertCircle size={18} /> Notificaciones generadas ({packageNotifications.length})
                    </h3>
                    {packageNotifications.length > 0 ? (
                      <div className="border border-gray-200 rounded-lg divide-y">
                        {packageNotifications.map(notif => (
                          <div key={notif.id} className="p-3 hover:bg-gray-50">
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="font-medium text-gray-800">{notif.court}</div>
                                <div className="text-sm text-gray-500">Autos: {notif.procedureNumber}</div>
                              </div>
                              <span className={`text-xs px-2 py-1 rounded ${
                                notif.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                                notif.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                                'bg-yellow-100 text-yellow-700'
                              }`}>
                                {notif.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-400 text-sm italic">No hay notificaciones. Procesa el paquete para generarlas.</p>
                    )}
                  </div>
                </>
              )}
            </div>
            
            <div className="p-6 border-t border-gray-200 flex justify-end gap-2">
              <button 
                onClick={() => setSelectedPackage(null)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cerrar
              </button>
              {(selectedPackage.status === 'READY_FOR_ANALYSIS' || selectedPackage.status === 'INCOMPLETE') && (
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
