import { db } from './db';
import { integrationTokens } from '../shared/schema';
import { eq, and } from 'drizzle-orm';

const INVENTO_API_BASE = process.env.INVENTO_API_URL || 'https://api.invento.es/v1';

interface InventoCase {
  id: string;
  reference: string;
  client: string;
  type: string;
  status: string;
  openDate: string;
  lawyer: string;
  court?: string;
  procedureNumber?: string;
}

interface InventoDocument {
  id: string;
  name: string;
  type: string;
  uploadDate: string;
  caseId: string;
}

async function getInventoApiKey(userId: number): Promise<string> {
  const [token] = await db
    .select()
    .from(integrationTokens)
    .where(and(
      eq(integrationTokens.userId, userId),
      eq(integrationTokens.provider, 'INVENTO')
    ))
    .limit(1);

  if (!token || !token.accessToken) {
    const globalKey = process.env.INVENTO_API_KEY;
    if (!globalKey) {
      throw new Error('No hay API key de Invento configurada');
    }
    return globalKey;
  }

  return token.accessToken;
}

async function makeInventoRequest(
  userId: number,
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const apiKey = await getInventoApiKey(userId);

  return fetch(`${INVENTO_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
}

export async function searchCases(
  userId: number,
  query: {
    reference?: string;
    client?: string;
    court?: string;
    procedureNumber?: string;
  }
): Promise<InventoCase[]> {
  const params = new URLSearchParams();
  if (query.reference) params.append('reference', query.reference);
  if (query.client) params.append('client', query.client);
  if (query.court) params.append('court', query.court);
  if (query.procedureNumber) params.append('procedureNumber', query.procedureNumber);

  const response = await makeInventoRequest(
    userId,
    `/cases?${params.toString()}`
  );

  if (!response.ok) {
    throw new Error('Error al buscar expedientes en Invento');
  }

  const data = await response.json();
  return data.cases || [];
}

export async function getCase(userId: number, caseId: string): Promise<InventoCase | null> {
  const response = await makeInventoRequest(userId, `/cases/${caseId}`);

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error('Error al obtener expediente de Invento');
  }

  return response.json();
}

export async function getCaseDocuments(userId: number, caseId: string): Promise<InventoDocument[]> {
  const response = await makeInventoRequest(userId, `/cases/${caseId}/documents`);

  if (!response.ok) {
    throw new Error('Error al obtener documentos del expediente');
  }

  const data = await response.json();
  return data.documents || [];
}

export async function uploadDocumentToCase(
  userId: number,
  caseId: string,
  document: {
    name: string;
    type: string;
    content: Buffer;
  }
): Promise<InventoDocument> {
  const formData = new FormData();
  formData.append('name', document.name);
  formData.append('type', document.type);
  formData.append('file', new Blob([document.content]), document.name);

  const apiKey = await getInventoApiKey(userId);

  const response = await fetch(`${INVENTO_API_BASE}/cases/${caseId}/documents`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`
    },
    body: formData
  });

  if (!response.ok) {
    throw new Error('Error al subir documento a Invento');
  }

  return response.json();
}

export async function createCase(
  userId: number,
  caseData: {
    reference: string;
    client: string;
    type: string;
    court?: string;
    procedureNumber?: string;
    lawyerId?: string;
    notes?: string;
  }
): Promise<InventoCase> {
  const response = await makeInventoRequest(userId, '/cases', {
    method: 'POST',
    body: JSON.stringify(caseData)
  });

  if (!response.ok) {
    throw new Error('Error al crear expediente en Invento');
  }

  return response.json();
}

export async function linkNotificationToCase(
  userId: number,
  caseId: string,
  notificationData: {
    lexnetId: string;
    receivedDate: string;
    court: string;
    procedureNumber: string;
    docType: string;
    rawPayload?: any;
  }
): Promise<void> {
  const response = await makeInventoRequest(userId, `/cases/${caseId}/notifications`, {
    method: 'POST',
    body: JSON.stringify(notificationData)
  });

  if (!response.ok) {
    throw new Error('Error al vincular notificación al expediente');
  }
}

export async function syncNotificationWithInvento(
  userId: number,
  notification: {
    id: number;
    lexnetId: string;
    court: string;
    procedureNumber: string;
    docType: string | null;
    rawPayload: any;
    receivedDate: Date;
  }
): Promise<{ caseId: string; isNewCase: boolean }> {
  const cases = await searchCases(userId, {
    court: notification.court,
    procedureNumber: notification.procedureNumber
  });

  let caseId: string;
  let isNewCase = false;

  if (cases.length > 0) {
    caseId = cases[0].id;
  } else {
    const newCase = await createCase(userId, {
      reference: `LX-${notification.lexnetId}`,
      client: 'Pendiente asignar',
      type: 'JUDICIAL',
      court: notification.court,
      procedureNumber: notification.procedureNumber
    });
    caseId = newCase.id;
    isNewCase = true;
  }

  await linkNotificationToCase(userId, caseId, {
    lexnetId: notification.lexnetId,
    receivedDate: notification.receivedDate.toISOString(),
    court: notification.court,
    procedureNumber: notification.procedureNumber,
    docType: notification.docType || 'DESCONOCIDO',
    rawPayload: notification.rawPayload
  });

  return { caseId, isNewCase };
}

export async function hasInventoIntegration(userId: number): Promise<boolean> {
  const globalKey = process.env.INVENTO_API_KEY;
  if (globalKey) return true;

  const [token] = await db
    .select()
    .from(integrationTokens)
    .where(and(
      eq(integrationTokens.userId, userId),
      eq(integrationTokens.provider, 'INVENTO')
    ))
    .limit(1);

  return !!token;
}

export async function saveInventoApiKey(userId: number, apiKey: string): Promise<void> {
  const [existing] = await db
    .select()
    .from(integrationTokens)
    .where(and(
      eq(integrationTokens.userId, userId),
      eq(integrationTokens.provider, 'INVENTO')
    ))
    .limit(1);

  if (existing) {
    await db
      .update(integrationTokens)
      .set({
        accessToken: apiKey,
        updatedAt: new Date()
      })
      .where(eq(integrationTokens.id, existing.id));
  } else {
    await db.insert(integrationTokens).values({
      userId,
      provider: 'INVENTO',
      accessToken: apiKey
    });
  }
}
