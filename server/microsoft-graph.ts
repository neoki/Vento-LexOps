import { db } from './db';
import { integrationTokens } from '../shared/schema';
import { eq, and } from 'drizzle-orm';

const MICROSOFT_GRAPH_API = 'https://graph.microsoft.com/v1.0';
const MICROSOFT_AUTH_URL = 'https://login.microsoftonline.com';

interface GraphTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

interface CalendarEvent {
  id: string;
  subject: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  location?: { displayName: string };
  attendees?: Array<{ emailAddress: { address: string; name: string } }>;
}

interface Email {
  id: string;
  subject: string;
  from: { emailAddress: { address: string; name: string } };
  receivedDateTime: string;
  bodyPreview: string;
  isRead: boolean;
}

export function getAuthUrl(redirectUri: string, state: string): string {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  if (!clientId) {
    throw new Error('MICROSOFT_CLIENT_ID no está configurado');
  }

  const scopes = [
    'offline_access',
    'User.Read',
    'Calendars.ReadWrite',
    'Mail.Read',
    'Mail.Send'
  ].join(' ');

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    response_mode: 'query',
    scope: scopes,
    state: state
  });

  return `${MICROSOFT_AUTH_URL}/common/oauth2/v2.0/authorize?${params.toString()}`;
}

export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<GraphTokens> {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Credenciales de Microsoft no configuradas');
  }

  const response = await fetch(`${MICROSOFT_AUTH_URL}/common/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Error al obtener tokens: ${error}`);
  }

  return response.json();
}

export async function refreshAccessToken(refreshToken: string): Promise<GraphTokens> {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Credenciales de Microsoft no configuradas');
  }

  const response = await fetch(`${MICROSOFT_AUTH_URL}/common/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    })
  });

  if (!response.ok) {
    throw new Error('Error al refrescar token');
  }

  return response.json();
}

export async function saveTokens(userId: number, tokens: GraphTokens): Promise<void> {
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  const [existing] = await db
    .select()
    .from(integrationTokens)
    .where(and(
      eq(integrationTokens.userId, userId),
      eq(integrationTokens.provider, 'MICROSOFT_GRAPH')
    ))
    .limit(1);

  if (existing) {
    await db
      .update(integrationTokens)
      .set({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt,
        updatedAt: new Date()
      })
      .where(eq(integrationTokens.id, existing.id));
  } else {
    await db.insert(integrationTokens).values({
      userId,
      provider: 'MICROSOFT_GRAPH',
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt,
      scopes: 'Calendars.ReadWrite,Mail.Read,Mail.Send'
    });
  }
}

async function getValidAccessToken(userId: number): Promise<string> {
  const [tokenRecord] = await db
    .select()
    .from(integrationTokens)
    .where(and(
      eq(integrationTokens.userId, userId),
      eq(integrationTokens.provider, 'MICROSOFT_GRAPH')
    ))
    .limit(1);

  if (!tokenRecord) {
    throw new Error('No hay integración de Microsoft Graph configurada');
  }

  if (tokenRecord.expiresAt && tokenRecord.expiresAt < new Date()) {
    if (!tokenRecord.refreshToken) {
      throw new Error('Token expirado y sin refresh token');
    }
    const newTokens = await refreshAccessToken(tokenRecord.refreshToken);
    await saveTokens(userId, newTokens);
    return newTokens.access_token;
  }

  return tokenRecord.accessToken!;
}

export async function getCalendarEvents(
  userId: number,
  startDate: Date,
  endDate: Date
): Promise<CalendarEvent[]> {
  const accessToken = await getValidAccessToken(userId);

  const response = await fetch(
    `${MICROSOFT_GRAPH_API}/me/calendarView?startDateTime=${startDate.toISOString()}&endDateTime=${endDate.toISOString()}&$orderby=start/dateTime`,
    {
      headers: { Authorization: `Bearer ${accessToken}` }
    }
  );

  if (!response.ok) {
    throw new Error('Error al obtener eventos del calendario');
  }

  const data = await response.json();
  return data.value;
}

export async function createCalendarEvent(
  userId: number,
  event: {
    subject: string;
    start: Date;
    end: Date;
    location?: string;
    attendees?: string[];
  }
): Promise<CalendarEvent> {
  const accessToken = await getValidAccessToken(userId);

  const eventData = {
    subject: event.subject,
    start: {
      dateTime: event.start.toISOString(),
      timeZone: 'Europe/Madrid'
    },
    end: {
      dateTime: event.end.toISOString(),
      timeZone: 'Europe/Madrid'
    },
    location: event.location ? { displayName: event.location } : undefined,
    attendees: event.attendees?.map(email => ({
      emailAddress: { address: email },
      type: 'required'
    }))
  };

  const response = await fetch(`${MICROSOFT_GRAPH_API}/me/events`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(eventData)
  });

  if (!response.ok) {
    throw new Error('Error al crear evento en el calendario');
  }

  return response.json();
}

export async function getRecentEmails(userId: number, count: number = 10): Promise<Email[]> {
  const accessToken = await getValidAccessToken(userId);

  const response = await fetch(
    `${MICROSOFT_GRAPH_API}/me/messages?$top=${count}&$orderby=receivedDateTime desc`,
    {
      headers: { Authorization: `Bearer ${accessToken}` }
    }
  );

  if (!response.ok) {
    throw new Error('Error al obtener emails');
  }

  const data = await response.json();
  return data.value;
}

export async function sendEmail(
  userId: number,
  email: {
    to: string[];
    subject: string;
    body: string;
    isHtml?: boolean;
  }
): Promise<void> {
  const accessToken = await getValidAccessToken(userId);

  const message = {
    message: {
      subject: email.subject,
      body: {
        contentType: email.isHtml ? 'HTML' : 'Text',
        content: email.body
      },
      toRecipients: email.to.map(address => ({
        emailAddress: { address }
      }))
    },
    saveToSentItems: true
  };

  const response = await fetch(`${MICROSOFT_GRAPH_API}/me/sendMail`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(message)
  });

  if (!response.ok) {
    throw new Error('Error al enviar email');
  }
}

export async function hasGraphIntegration(userId: number): Promise<boolean> {
  const [token] = await db
    .select()
    .from(integrationTokens)
    .where(and(
      eq(integrationTokens.userId, userId),
      eq(integrationTokens.provider, 'MICROSOFT_GRAPH')
    ))
    .limit(1);

  return !!token;
}
