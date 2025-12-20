import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { db, pool } from './server/db';
import { setupAuth, requireAuth, requireRole } from './server/auth';
import { analyzeDocument, updateOfficeAISettings, getOfficeAISettings, updateUserAIPreference, isAIEnabled } from './server/ai-service';
import * as msGraph from './server/microsoft-graph';
import * as inventoApi from './server/invento-api';
import configApi from './server/config-api';
import packagesApi from './server/packages-api';
import { notifications, agents, agentLogs, users, userAiSettings, auditLogs, lexnetPackages, documents, executionPlans, executionActions } from './shared/schema';
import { eq, desc, sql, and } from 'drizzle-orm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const PORT = isProduction ? 5000 : 3001;
const HOST = '0.0.0.0';

app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

app.use((req, res, next) => {
  if (req.path.includes('/packages/upload')) {
    console.log('[Server] Upload request received:', req.method, req.path);
  }
  next();
});

setupAuth(app);

app.use('/api/config', requireAuth, requireRole('ADMIN'), configApi);
app.use('/api', requireAuth, packagesApi);

if (isProduction) {
  app.use(express.static(path.join(__dirname, 'dist')));
}

async function logAudit(userId: number | null, action: string, targetType: string, targetId: string | number, metadata: any, ipAddress: string | undefined) {
  try {
    await db.insert(auditLogs).values({
      actorUserId: userId,
      action,
      targetType,
      targetId: String(targetId),
      metadata,
      ipAddress
    });
  } catch (error) {
    console.error('Error logging audit:', error);
  }
}

app.get('/api/dashboard', async (req, res) => {
  try {
    const [allNotifications, allAgents, allPackages, recentLogs] = await Promise.all([
      db.select().from(notifications),
      db.select().from(agents),
      db.select().from(lexnetPackages),
      db.select().from(agentLogs).orderBy(desc(agentLogs.createdAt)).limit(10)
    ]);
    
    const onlineAgents = allAgents.filter(a => 
      a.status === 'ONLINE' && 
      a.lastHeartbeat && 
      (Date.now() - new Date(a.lastHeartbeat).getTime() < 30000)
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayPackages = allPackages.filter(p => new Date(p.downloadDate) >= today);

    res.json({
      stats: {
        incoming: allNotifications.length,
        triage: allNotifications.filter(n => n.status === 'TRIAGE_REQUIRED').length,
        executed: allNotifications.filter(n => n.status === 'EXECUTED').length,
        reviewed: allNotifications.filter(n => n.status === 'TRIAGED' || n.status === 'PLAN_APPROVED').length,
        packagesTotal: allPackages.length,
        packagesToday: todayPackages.length,
        packagesIncomplete: allPackages.filter(p => p.status === 'INCOMPLETE').length,
        packagesAnalyzed: allPackages.filter(p => p.status === 'ANALYZED').length
      },
      agentStatus: onlineAgents.length > 0 ? 'ONLINE' : 'OFFLINE',
      agentCount: allAgents.length,
      onlineAgentCount: onlineAgents.length,
      recentLogs: recentLogs.map(log => ({
        id: log.id,
        timestamp: log.createdAt,
        level: log.level,
        message: log.message
      }))
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Error obteniendo datos del dashboard' });
  }
});

app.get('/api/notifications', async (req, res) => {
  try {
    const allNotifications = await db
      .select()
      .from(notifications)
      .orderBy(desc(notifications.createdAt));
    res.json(allNotifications);
  } catch (error) {
    console.error('Notifications error:', error);
    res.status(500).json({ error: 'Error obteniendo notificaciones' });
  }
});

app.get('/api/notifications/:id', async (req, res) => {
  try {
    const [notification] = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, parseInt(req.params.id)))
      .limit(1);
    
    if (!notification) {
      return res.status(404).json({ error: 'Notificación no encontrada' });
    }
    res.json(notification);
  } catch (error) {
    console.error('Notification detail error:', error);
    res.status(500).json({ error: 'Error obteniendo notificación' });
  }
});

app.patch('/api/notifications/:id/status', requireAuth, async (req, res) => {
  try {
    const { status, assignedLawyerId } = req.body;
    const [updated] = await db
      .update(notifications)
      .set({ 
        status, 
        assignedLawyerId,
        updatedAt: new Date() 
      })
      .where(eq(notifications.id, parseInt(req.params.id)))
      .returning();

    await logAudit(
      req.user.id,
      'UPDATE_NOTIFICATION_STATUS',
      'notification',
      req.params.id,
      { status, assignedLawyerId },
      req.ip
    );

    res.json(updated);
  } catch (error) {
    console.error('Update notification error:', error);
    res.status(500).json({ error: 'Error actualizando notificación' });
  }
});

app.post('/api/notifications/:id/analyze', requireAuth, async (req, res) => {
  try {
    const [notification] = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, parseInt(req.params.id)))
      .limit(1);

    if (!notification) {
      return res.status(404).json({ error: 'Notificación no encontrada' });
    }

    const documentText = JSON.stringify(notification.rawPayload || notification);
    const analysis = await analyzeDocument(documentText, req.user.id);

    const [updated] = await db
      .update(notifications)
      .set({
        aiConfidence: analysis.confidence,
        aiReasoning: analysis.reasoning,
        extractedDeadlines: analysis.extractedDeadlines,
        priority: analysis.priority,
        docType: analysis.docType,
        suggestedCaseId: analysis.suggestedCaseId,
        updatedAt: new Date()
      })
      .where(eq(notifications.id, parseInt(req.params.id)))
      .returning();

    await logAudit(
      req.user.id,
      'AI_ANALYSIS',
      'notification',
      req.params.id,
      { confidence: analysis.confidence },
      req.ip
    );

    res.json({ notification: updated, analysis });
  } catch (error) {
    console.error('AI analysis error:', error);
    res.status(500).json({ error: 'Error en análisis AI: ' + error.message });
  }
});

app.get('/api/users', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const allUsers = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        fullName: users.fullName,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt
      })
      .from(users)
      .orderBy(desc(users.createdAt));
    res.json(allUsers);
  } catch (error) {
    console.error('Users error:', error);
    res.status(500).json({ error: 'Error obteniendo usuarios' });
  }
});

app.patch('/api/users/:id/role', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const { role } = req.body;
    const [updated] = await db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, parseInt(req.params.id)))
      .returning({
        id: users.id,
        username: users.username,
        email: users.email,
        fullName: users.fullName,
        role: users.role
      });

    await logAudit(
      req.user.id,
      'UPDATE_USER_ROLE',
      'user',
      req.params.id,
      { newRole: role },
      req.ip
    );

    res.json(updated);
  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({ error: 'Error actualizando rol' });
  }
});

app.get('/api/users/:id/ai-settings', requireAuth, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    if (req.user.id !== userId && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'No autorizado' });
    }
    
    const [user] = await db.select({
      useAi: users.useAi,
      officeId: users.officeId
    }).from(users).where(eq(users.id, userId)).limit(1);
    
    let officeSettings = null;
    if (user?.officeId) {
      officeSettings = await getOfficeAISettings(user.officeId);
    }
    
    const aiEnabled = await isAIEnabled(userId);
    
    res.json({
      userUseAi: user?.useAi ?? true,
      officeProvider: officeSettings?.aiProvider || 'NONE',
      isAIEnabled: aiEnabled
    });
  } catch (error) {
    console.error('Get AI settings error:', error);
    res.status(500).json({ error: 'Error obteniendo configuración AI' });
  }
});

app.put('/api/users/:id/ai-settings', requireAuth, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    if (req.user.id !== userId && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'No autorizado' });
    }
    const { useAi } = req.body;
    await updateUserAIPreference(userId, useAi);
    
    await logAudit(
      req.user.id,
      'UPDATE_AI_PREFERENCE',
      'user',
      req.params.id,
      { useAi },
      req.ip
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Update AI settings error:', error);
    res.status(500).json({ error: 'Error actualizando configuración AI' });
  }
});

app.get('/api/offices/:id/ai-settings', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const officeId = parseInt(req.params.id);
    const settings = await getOfficeAISettings(officeId);
    res.json(settings);
  } catch (error) {
    console.error('Get office AI settings error:', error);
    res.status(500).json({ error: 'Error obteniendo configuración AI de oficina' });
  }
});

app.put('/api/offices/:id/ai-settings', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const officeId = parseInt(req.params.id);
    const { provider, secretKeyName, temperature } = req.body;
    await updateOfficeAISettings(officeId, provider, secretKeyName, temperature);
    
    await logAudit(
      req.user!.id,
      'UPDATE_OFFICE_AI_SETTINGS',
      'office',
      req.params.id,
      { provider },
      req.ip
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Update office AI settings error:', error);
    res.status(500).json({ error: 'Error actualizando configuración AI de oficina' });
  }
});

app.get('/api/agents', async (req, res) => {
  try {
    const allAgents = await db
      .select()
      .from(agents)
      .orderBy(desc(agents.lastHeartbeat));
    res.json(allAgents);
  } catch (error) {
    console.error('Agents error:', error);
    res.status(500).json({ error: 'Error obteniendo agentes' });
  }
});

app.post('/api/agent/heartbeat', async (req, res) => {
  try {
    const { agentId, hostInfo } = req.body;
    
    const [existingAgent] = await db
      .select()
      .from(agents)
      .where(eq(agents.agentId, agentId))
      .limit(1);

    if (existingAgent) {
      await db
        .update(agents)
        .set({
          status: 'ONLINE',
          lastHeartbeat: new Date(),
          hostInfo: hostInfo || existingAgent.hostInfo,
          updatedAt: new Date()
        })
        .where(eq(agents.agentId, agentId));
    } else {
      await db.insert(agents).values({
        agentId,
        name: agentId,
        status: 'ONLINE',
        lastHeartbeat: new Date(),
        hostInfo
      });
    }

    res.json({ command: 'IDLE' });
  } catch (error) {
    console.error('Heartbeat error:', error);
    res.status(500).json({ error: 'Error procesando heartbeat' });
  }
});

app.post('/api/agent/log', async (req, res) => {
  try {
    const { agentId, level, message, context } = req.body;
    
    const [agent] = await db
      .select()
      .from(agents)
      .where(eq(agents.agentId, agentId))
      .limit(1);

    if (!agent) {
      return res.status(404).json({ error: 'Agente no encontrado' });
    }

    await db.insert(agentLogs).values({
      agentId: agent.id,
      level,
      message,
      context
    });

    console.log(`[AGENT ${agentId}] ${level}: ${message}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Log error:', error);
    res.status(500).json({ error: 'Error guardando log' });
  }
});

app.post('/api/agent/notification', async (req, res) => {
  try {
    const { lexnetId, court, procedureNumber, procedureType, docType, rawPayload } = req.body;
    
    const [newNotif] = await db.insert(notifications).values({
      lexnetId,
      court,
      procedureNumber,
      procedureType,
      docType,
      receivedDate: new Date(),
      downloadedDate: new Date(),
      status: 'TRIAGE_REQUIRED',
      priority: 'MEDIUM',
      rawPayload
    }).returning();

    console.log("Nueva notificación recibida del Agente:", newNotif.id);
    res.json({ success: true, id: newNotif.id });
  } catch (error) {
    console.error('New notification error:', error);
    res.status(500).json({ error: 'Error guardando notificación' });
  }
});

app.get('/api/audit', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const logs = await db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(100);
    res.json(logs);
  } catch (error) {
    console.error('Audit logs error:', error);
    res.status(500).json({ error: 'Error obteniendo logs de auditoría' });
  }
});

const oauthStates = new Map<string, { userId: number; timestamp: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [state, data] of oauthStates) {
    if (now - data.timestamp > 10 * 60 * 1000) {
      oauthStates.delete(state);
    }
  }
}, 60000);

app.get('/api/integrations/microsoft/auth-url', requireAuth, (req, res) => {
  try {
    const redirectUri = `${req.protocol}://${req.get('host')}/api/integrations/microsoft/callback`;
    const state = crypto.randomBytes(32).toString('hex');
    
    oauthStates.set(state, { userId: req.user!.id, timestamp: Date.now() });
    
    const authUrl = msGraph.getAuthUrl(redirectUri, state);
    res.json({ authUrl });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/integrations/microsoft/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    
    if (!state || typeof state !== 'string') {
      return res.status(400).json({ error: 'Estado de OAuth inválido' });
    }
    
    const stateData = oauthStates.get(state);
    if (!stateData) {
      return res.status(400).json({ error: 'Estado de OAuth expirado o inválido' });
    }
    
    oauthStates.delete(state);
    
    const redirectUri = `${req.protocol}://${req.get('host')}/api/integrations/microsoft/callback`;
    const tokens = await msGraph.exchangeCodeForTokens(code as string, redirectUri);
    await msGraph.saveTokens(stateData.userId, tokens);
    
    await logAudit(
      stateData.userId,
      'MICROSOFT_GRAPH_LINKED',
      'integration',
      'microsoft',
      { linkedAt: new Date().toISOString() },
      req.ip
    );
    
    res.redirect('/#settings');
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/integrations/microsoft/status', requireAuth, async (req, res) => {
  try {
    const hasIntegration = await msGraph.hasGraphIntegration(req.user!.id);
    res.json({ connected: hasIntegration });
  } catch (error) {
    res.json({ connected: false });
  }
});

app.get('/api/integrations/microsoft/calendar', requireAuth, async (req, res) => {
  try {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1);
    
    const events = await msGraph.getCalendarEvents(req.user!.id, startDate, endDate);
    res.json(events);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/integrations/microsoft/calendar', requireAuth, async (req, res) => {
  try {
    const { subject, start, end, location, attendees } = req.body;
    const event = await msGraph.createCalendarEvent(req.user!.id, {
      subject,
      start: new Date(start),
      end: new Date(end),
      location,
      attendees
    });
    res.json(event);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/integrations/invento/status', requireAuth, async (req, res) => {
  try {
    const hasIntegration = await inventoApi.hasInventoIntegration(req.user!.id);
    res.json({ connected: hasIntegration });
  } catch (error) {
    res.json({ connected: false });
  }
});

app.post('/api/integrations/invento/api-key', requireAuth, async (req, res) => {
  try {
    const { apiKey } = req.body;
    await inventoApi.saveInventoApiKey(req.user!.id, apiKey);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/integrations/invento/cases', requireAuth, async (req, res) => {
  try {
    const { reference, client, court, procedureNumber } = req.query;
    const cases = await inventoApi.searchCases(req.user!.id, {
      reference: reference as string,
      client: client as string,
      court: court as string,
      procedureNumber: procedureNumber as string
    });
    res.json(cases);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/notifications/:id/sync-invento', requireAuth, async (req, res) => {
  try {
    const [notification] = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, parseInt(req.params.id)))
      .limit(1);

    if (!notification) {
      return res.status(404).json({ error: 'Notificación no encontrada' });
    }

    const result = await inventoApi.syncNotificationWithInvento(req.user!.id, notification);

    await db
      .update(notifications)
      .set({
        inventoCaseId: result.caseId,
        status: 'EXECUTED',
        updatedAt: new Date()
      })
      .where(eq(notifications.id, notification.id));

    await logAudit(
      req.user!.id,
      'SYNC_INVENTO',
      'notification',
      req.params.id,
      { caseId: result.caseId, isNewCase: result.isNewCase },
      req.ip
    );

    res.json({ success: true, caseId: result.caseId, isNewCase: result.isNewCase });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/notifications/:id/documents', requireAuth, async (req, res) => {
  try {
    const notificationId = parseInt(req.params.id);
    const docs = await db
      .select()
      .from(documents)
      .where(eq(documents.notificationId, notificationId));
    res.json(docs);
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ error: 'Error obteniendo documentos' });
  }
});

app.get('/api/documents/:id/pdf', requireAuth, async (req, res) => {
  try {
    const [doc] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, parseInt(req.params.id)))
      .limit(1);

    if (!doc) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }

    if (!doc.filePath || !fs.existsSync(doc.filePath)) {
      return res.status(404).json({ error: 'Archivo no encontrado en el sistema' });
    }

    const fileContent = fs.readFileSync(doc.filePath);
    res.setHeader('Content-Type', doc.mimeType || 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${doc.fileName}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(fileContent);
  } catch (error) {
    console.error('Error serving PDF:', error);
    res.status(500).json({ error: 'Error sirviendo PDF' });
  }
});

app.get('/api/documents/:id/download', requireAuth, async (req, res) => {
  try {
    const [doc] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, parseInt(req.params.id)))
      .limit(1);

    if (!doc || !doc.filePath || !fs.existsSync(doc.filePath)) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }

    const fileContent = fs.readFileSync(doc.filePath);
    res.setHeader('Content-Type', doc.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${doc.fileName}"`);
    res.send(fileContent);
  } catch (error) {
    console.error('Error downloading document:', error);
    res.status(500).json({ error: 'Error descargando documento' });
  }
});

// Triage endpoints - Aprobar/Rechazar notificaciones
app.post('/api/notifications/:id/approve', requireAuth, async (req, res) => {
  try {
    const notificationId = parseInt(req.params.id);
    const [notification] = await db
      .update(notifications)
      .set({
        status: 'TRIAGED',
        triageResolvedBy: req.user!.id,
        triageResolvedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(notifications.id, notificationId))
      .returning();

    if (!notification) {
      return res.status(404).json({ error: 'Notificación no encontrada' });
    }

    await logAudit(req.user!.id, 'APPROVE_NOTIFICATION', 'notification', notificationId.toString(), {}, req.ip);
    res.json({ success: true, notification });
  } catch (error) {
    console.error('Error approving notification:', error);
    res.status(500).json({ error: 'Error aprobando notificación' });
  }
});

app.post('/api/notifications/:id/reject', requireAuth, async (req, res) => {
  try {
    const notificationId = parseInt(req.params.id);
    const [notification] = await db
      .update(notifications)
      .set({
        status: 'CANCELLED_MANUAL',
        triageResolvedBy: req.user!.id,
        triageResolvedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(notifications.id, notificationId))
      .returning();

    if (!notification) {
      return res.status(404).json({ error: 'Notificación no encontrada' });
    }

    await logAudit(req.user!.id, 'REJECT_NOTIFICATION', 'notification', notificationId.toString(), {}, req.ip);
    res.json({ success: true, notification });
  } catch (error) {
    console.error('Error rejecting notification:', error);
    res.status(500).json({ error: 'Error rechazando notificación' });
  }
});

app.patch('/api/notifications/:id', requireAuth, async (req: any, res) => {
  try {
    const notificationId = parseInt(req.params.id);
    const { court, location, procedureNumber, docType } = req.body;
    
    const updateData: any = { updatedAt: new Date() };
    if (court !== undefined && court !== '') updateData.court = court;
    if (location !== undefined) updateData.location = location || null;
    if (procedureNumber !== undefined && procedureNumber !== '') updateData.procedureNumber = procedureNumber;
    if (docType !== undefined) updateData.docType = docType || null;
    
    const [notification] = await db
      .update(notifications)
      .set(updateData)
      .where(eq(notifications.id, notificationId))
      .returning();

    if (!notification) {
      return res.status(404).json({ error: 'Notificación no encontrada' });
    }

    await logAudit(req.user!.id, 'UPDATE_NOTIFICATION', 'notification', notificationId.toString(), updateData, req.ip);
    res.json({ success: true, notification });
  } catch (error) {
    console.error('Error updating notification:', error);
    res.status(500).json({ error: 'Error actualizando notificación' });
  }
});

// Execution Plans endpoints
app.get('/api/execution-plans', requireAuth, async (req, res) => {
  try {
    const { status } = req.query;
    let query = db.select().from(executionPlans).orderBy(desc(executionPlans.proposedAt));
    
    const allPlans = await query;
    const filteredPlans = status 
      ? allPlans.filter(p => p.status === status)
      : allPlans;
    
    res.json(filteredPlans);
  } catch (error) {
    console.error('Error fetching execution plans:', error);
    res.status(500).json({ error: 'Error obteniendo planes de ejecución' });
  }
});

app.get('/api/execution-plans/:id', requireAuth, async (req, res) => {
  try {
    const planId = parseInt(req.params.id);
    const [plan] = await db
      .select()
      .from(executionPlans)
      .where(eq(executionPlans.id, planId))
      .limit(1);

    if (!plan) {
      return res.status(404).json({ error: 'Plan no encontrado' });
    }

    const actions = await db
      .select()
      .from(executionActions)
      .where(eq(executionActions.planId, planId))
      .orderBy(executionActions.actionOrder);

    res.json({ ...plan, actions });
  } catch (error) {
    console.error('Error fetching execution plan:', error);
    res.status(500).json({ error: 'Error obteniendo plan de ejecución' });
  }
});

app.post('/api/execution-plans/:id/approve', requireAuth, async (req, res) => {
  try {
    const planId = parseInt(req.params.id);
    const [plan] = await db
      .update(executionPlans)
      .set({
        status: 'APPROVED',
        approvedBy: req.user!.id,
        approvedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(executionPlans.id, planId))
      .returning();

    if (!plan) {
      return res.status(404).json({ error: 'Plan no encontrado' });
    }

    // Update associated notification status
    await db
      .update(notifications)
      .set({ status: 'PLAN_APPROVED', updatedAt: new Date() })
      .where(eq(notifications.id, plan.notificationId));

    await logAudit(req.user!.id, 'APPROVE_PLAN', 'execution_plan', planId.toString(), {}, req.ip);
    res.json({ success: true, plan });
  } catch (error) {
    console.error('Error approving plan:', error);
    res.status(500).json({ error: 'Error aprobando plan' });
  }
});

app.post('/api/execution-plans/:id/cancel', requireAuth, async (req, res) => {
  try {
    const planId = parseInt(req.params.id);
    const { reason } = req.body;
    
    const [plan] = await db
      .update(executionPlans)
      .set({
        status: 'CANCELLED',
        cancelledBy: req.user!.id,
        cancelledAt: new Date(),
        cancellationReason: reason || 'Cancelado por usuario',
        updatedAt: new Date()
      })
      .where(eq(executionPlans.id, planId))
      .returning();

    if (!plan) {
      return res.status(404).json({ error: 'Plan no encontrado' });
    }

    await logAudit(req.user!.id, 'CANCEL_PLAN', 'execution_plan', planId.toString(), { reason }, req.ip);
    res.json({ success: true, plan });
  } catch (error) {
    console.error('Error cancelling plan:', error);
    res.status(500).json({ error: 'Error cancelando plan' });
  }
});

app.post('/api/execution-plans/:id/execute', requireAuth, async (req, res) => {
  try {
    const planId = parseInt(req.params.id);
    
    // Get plan and verify it's approved
    const [plan] = await db
      .select()
      .from(executionPlans)
      .where(eq(executionPlans.id, planId))
      .limit(1);

    if (!plan) {
      return res.status(404).json({ error: 'Plan no encontrado' });
    }

    if (plan.status !== 'APPROVED') {
      return res.status(400).json({ error: 'El plan debe estar aprobado para ejecutarse' });
    }

    // Mark as executed (in a real system, this would trigger the actual actions)
    await db
      .update(executionPlans)
      .set({
        status: 'EXECUTED',
        executedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(executionPlans.id, planId));

    // Update notification status
    await db
      .update(notifications)
      .set({ status: 'EXECUTED', updatedAt: new Date() })
      .where(eq(notifications.id, plan.notificationId));

    await logAudit(req.user!.id, 'EXECUTE_PLAN', 'execution_plan', planId.toString(), {}, req.ip);
    res.json({ success: true });
  } catch (error) {
    console.error('Error executing plan:', error);
    res.status(500).json({ error: 'Error ejecutando plan' });
  }
});

if (isProduction) {
  app.get('/{*path}', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

app.listen(PORT, HOST, () => {
  console.log(`Vento LexOps Backend running at http://${HOST}:${PORT}`);
});
