import { db } from './db';
import { integrationTokens, offices } from '../shared/schema';
import { eq, and } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

const VENTO_API_BASE = 'https://ventoapi.vento.es';

interface VentoAuthResponse {
  token: string;
  expiration?: string;
  user?: {
    id: number;
    nombre: string;
    email: string;
  };
}

interface VentoExpediente {
  idPresup: number;
  referencia: string;
  cliente: string;
  tipo: string;
  estado: string;
  fechaAlta: string;
  responsable: string;
  juzgado?: string;
  numProcedimiento?: string;
  instancia?: string;
  carpeta?: string;
}

interface VentoTercero {
  idTercero: number;
  nombre: string;
  tipo: string;
  cif?: string;
  email?: string;
  telefono?: string;
}

interface VentoFileOperation {
  command: 'upload' | 'download' | 'list' | 'create' | 'delete' | 'rename';
  arguments: {
    pathInfo?: string;
    path?: string;
    name?: string;
    newName?: string;
    data?: string;
    content?: string;
  };
}

interface InventoConfig {
  apiUrl: string;
  username?: string;
  password?: string;
  token?: string;
}

async function getInventoConfig(officeId?: number): Promise<InventoConfig> {
  if (officeId) {
    const [office] = await db
      .select()
      .from(offices)
      .where(eq(offices.id, officeId))
      .limit(1);

    if (office?.inventoApiUrl) {
      const secretKeyName = office.inventoSecretKeyName;
      const token = secretKeyName ? process.env[secretKeyName] : undefined;
      
      return {
        apiUrl: office.inventoApiUrl,
        token
      };
    }
  }

  return {
    apiUrl: process.env.INVENTO_API_URL || VENTO_API_BASE,
    token: process.env.INVENTO_API_KEY
  };
}

async function getAuthToken(config: InventoConfig): Promise<string> {
  if (config.token) {
    return config.token;
  }

  if (config.username && config.password) {
    const response = await fetch(`${config.apiUrl}/api/Users/authenticate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: config.username,
        password: config.password
      })
    });

    if (!response.ok) {
      throw new Error('Error de autenticación con Vento API');
    }

    const data: VentoAuthResponse = await response.json();
    return data.token;
  }

  throw new Error('No hay credenciales de Invento configuradas');
}

async function makeVentoRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  officeId?: number
): Promise<T> {
  const config = await getInventoConfig(officeId);
  const token = await getAuthToken(config);

  const response = await fetch(`${config.apiUrl}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error Vento API (${response.status}): ${errorText}`);
  }

  const text = await response.text();
  if (!text) return {} as T;
  
  try {
    return JSON.parse(text);
  } catch {
    return text as unknown as T;
  }
}

export async function searchExpedientes(
  query: string,
  officeId?: number
): Promise<VentoExpediente[]> {
  try {
    const result = await makeVentoRequest<VentoExpediente[]>(
      `/api/Presupuesto/Buscar?texto=${encodeURIComponent(query)}`,
      { method: 'GET' },
      officeId
    );
    return Array.isArray(result) ? result : [];
  } catch (error) {
    console.error('Error buscando expedientes:', error);
    return [];
  }
}

export async function getExpediente(
  idPresup: number,
  officeId?: number
): Promise<VentoExpediente | null> {
  try {
    const result = await makeVentoRequest<VentoExpediente>(
      `/api/Presupuesto?idPresup=${idPresup}`,
      { method: 'GET' },
      officeId
    );
    return result;
  } catch (error) {
    console.error('Error obteniendo expediente:', error);
    return null;
  }
}

export async function getExpedientePresup(
  idPresup: number,
  officeId?: number
): Promise<any> {
  try {
    const result = await makeVentoRequest<any>(
      `/api/Presupuesto/presup?idPresup=${idPresup}`,
      { method: 'GET' },
      officeId
    );
    return result;
  } catch (error) {
    console.error('Error obteniendo presupuesto:', error);
    return null;
  }
}

export async function uploadFileToExpediente(
  idPresup: number,
  filePath: string,
  fileName: string,
  targetFolder: string,
  officeId?: number
): Promise<{ success: boolean; message: string }> {
  try {
    const fileContent = fs.readFileSync(filePath);
    const base64Content = fileContent.toString('base64');
    
    const targetPath = `expedientes/${idPresup}/${targetFolder}`;
    
    const operation: VentoFileOperation = {
      command: 'upload',
      arguments: {
        pathInfo: targetPath,
        name: fileName,
        data: base64Content
      }
    };

    const config = await getInventoConfig(officeId);
    const token = await getAuthToken(config);

    const response = await fetch(`${config.apiUrl}/api/FileManager/file-manager-file-system-scripts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(operation)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error subiendo archivo: ${errorText}`);
    }

    return { success: true, message: `Archivo ${fileName} subido correctamente` };
  } catch (error) {
    console.error('Error subiendo archivo a expediente:', error);
    return { 
      success: false, 
      message: error instanceof Error ? error.message : 'Error desconocido' 
    };
  }
}

export async function listExpedienteFiles(
  idPresup: number,
  folder?: string,
  officeId?: number
): Promise<string[]> {
  try {
    const targetPath = folder 
      ? `expedientes/${idPresup}/${folder}`
      : `expedientes/${idPresup}`;
    
    const operation: VentoFileOperation = {
      command: 'list',
      arguments: {
        path: targetPath
      }
    };

    const config = await getInventoConfig(officeId);
    const token = await getAuthToken(config);

    const response = await fetch(`${config.apiUrl}/api/FileManager/file-manager-file-system-scripts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(operation)
    });

    if (!response.ok) {
      return [];
    }

    const result = await response.json();
    return result.files || [];
  } catch (error) {
    console.error('Error listando archivos:', error);
    return [];
  }
}

export async function createExpedienteFolder(
  idPresup: number,
  folderName: string,
  officeId?: number
): Promise<{ success: boolean; message: string }> {
  try {
    const operation: VentoFileOperation = {
      command: 'create',
      arguments: {
        path: `expedientes/${idPresup}`,
        name: folderName
      }
    };

    const config = await getInventoConfig(officeId);
    const token = await getAuthToken(config);

    const response = await fetch(`${config.apiUrl}/api/FileManager/file-manager-file-system-scripts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(operation)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error creando carpeta: ${errorText}`);
    }

    return { success: true, message: `Carpeta ${folderName} creada` };
  } catch (error) {
    console.error('Error creando carpeta:', error);
    return { 
      success: false, 
      message: error instanceof Error ? error.message : 'Error desconocido' 
    };
  }
}

export async function searchTerceros(
  tipo: string,
  officeId?: number
): Promise<VentoTercero[]> {
  try {
    const result = await makeVentoRequest<VentoTercero[]>(
      `/api/Tercero/${tipo}`,
      { method: 'GET' },
      officeId
    );
    return Array.isArray(result) ? result : [];
  } catch (error) {
    console.error('Error buscando terceros:', error);
    return [];
  }
}

export async function getTercero(
  tipo: string,
  idTercero: number,
  officeId?: number
): Promise<VentoTercero | null> {
  try {
    const result = await makeVentoRequest<VentoTercero>(
      `/api/Tercero/ver/${tipo}/${idTercero}`,
      { method: 'GET' },
      officeId
    );
    return result;
  } catch (error) {
    console.error('Error obteniendo tercero:', error);
    return null;
  }
}

export async function reabrirExpediente(
  idExpediente: number,
  officeId?: number
): Promise<{ success: boolean; message: string }> {
  try {
    await makeVentoRequest<any>(
      `/api/Expediente/reabrir/${idExpediente}`,
      { method: 'POST' },
      officeId
    );
    return { success: true, message: 'Expediente reabierto' };
  } catch (error) {
    console.error('Error reabriendo expediente:', error);
    return { 
      success: false, 
      message: error instanceof Error ? error.message : 'Error desconocido' 
    };
  }
}

export async function getMaestro(
  idMaestro: number,
  idPadre?: number,
  officeId?: number
): Promise<any[]> {
  try {
    let url = `/api/Maestro/${idMaestro}`;
    if (idPadre !== undefined) {
      url += `?idPadre=${idPadre}`;
    }
    const result = await makeVentoRequest<any[]>(url, { method: 'GET' }, officeId);
    return Array.isArray(result) ? result : [];
  } catch (error) {
    console.error('Error obteniendo maestro:', error);
    return [];
  }
}

export async function getPresupuestoMaestro(officeId?: number): Promise<any> {
  try {
    return await makeVentoRequest<any>(
      '/api/Presupuesto/getMaestro',
      { method: 'GET' },
      officeId
    );
  } catch (error) {
    console.error('Error obteniendo maestro de presupuestos:', error);
    return null;
  }
}

export async function uploadDocumentsToCase(
  caseId: string | number,
  documents: Array<{
    originalPath: string;
    renamedName: string;
    folder?: string;
  }>,
  officeId?: number
): Promise<{
  success: boolean;
  uploaded: string[];
  failed: string[];
  errors: string[];
}> {
  const idPresup = typeof caseId === 'string' ? parseInt(caseId, 10) : caseId;
  const uploaded: string[] = [];
  const failed: string[] = [];
  const errors: string[] = [];

  for (const doc of documents) {
    try {
      if (!fs.existsSync(doc.originalPath)) {
        failed.push(doc.renamedName);
        errors.push(`Archivo no encontrado: ${doc.originalPath}`);
        continue;
      }

      const result = await uploadFileToExpediente(
        idPresup,
        doc.originalPath,
        doc.renamedName,
        doc.folder || 'NOTIFICACIONES',
        officeId
      );

      if (result.success) {
        uploaded.push(doc.renamedName);
      } else {
        failed.push(doc.renamedName);
        errors.push(result.message);
      }
    } catch (error) {
      failed.push(doc.renamedName);
      errors.push(error instanceof Error ? error.message : 'Error desconocido');
    }
  }

  return {
    success: failed.length === 0,
    uploaded,
    failed,
    errors
  };
}

export async function findExpedienteByProcedimiento(
  court: string,
  procedureNumber: string,
  officeId?: number
): Promise<VentoExpediente | null> {
  const searchQuery = `${procedureNumber} ${court}`.trim();
  const results = await searchExpedientes(searchQuery, officeId);
  
  if (results.length === 0) {
    const simpleSearch = await searchExpedientes(procedureNumber, officeId);
    if (simpleSearch.length > 0) {
      return simpleSearch[0];
    }
    return null;
  }
  
  const exactMatch = results.find(exp => 
    exp.numProcedimiento?.toLowerCase() === procedureNumber.toLowerCase()
  );
  
  return exactMatch || results[0];
}

export async function hasInventoIntegration(officeId?: number): Promise<boolean> {
  try {
    const config = await getInventoConfig(officeId);
    return !!(config.token || (config.username && config.password));
  } catch {
    return false;
  }
}

export async function testInventoConnection(officeId?: number): Promise<{
  connected: boolean;
  message: string;
}> {
  try {
    const config = await getInventoConfig(officeId);
    await getAuthToken(config);
    
    const maestro = await getPresupuestoMaestro(officeId);
    
    return {
      connected: true,
      message: 'Conexión exitosa con Vento API'
    };
  } catch (error) {
    return {
      connected: false,
      message: error instanceof Error ? error.message : 'Error de conexión'
    };
  }
}

export type { VentoExpediente, VentoTercero };
