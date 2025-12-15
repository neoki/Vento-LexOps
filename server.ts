import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { db, pool } from './server/db';
import { setupAuth, requireAuth, requireRole } from './server/auth';
import { analyzeDocument, updateUserAISettings, getAISettings } from './server/ai-service';
import { notifications, agents, agentLogs, users, userAiSettings, auditLogs } from './shared/schema';
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
app.use(express.json());

setupAuth(app);

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
    const allNotifications = await db.select().from(notifications);
    const allAgents = await db.select().from(agents);
    
    const onlineAgents = allAgents.filter(a => 
      a.status === 'ONLINE' && 
      a.lastHeartbeat && 
      (Date.now() - new Date(a.lastHeartbeat).getTime() < 30000)
    );

    const recentLogs = await db
      .select()
      .from(agentLogs)
      .orderBy(desc(agentLogs.createdAt))
      .limit(10);

    res.json({
      stats: {
        incoming: allNotifications.length,
        triage: allNotifications.filter(n => n.status === 'TRIAGE_REQUIRED').length,
        synced: allNotifications.filter(n => n.status === 'SYNCED').length,
        reviewed: allNotifications.filter(n => n.status === 'REVIEWED').length
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
    const analysis = await analyzeDocument(req.user.id, documentText);

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
    const settings = await getAISettings(userId);
    res.json({
      provider: settings.provider,
      hasApiKey: !!settings.apiKey
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
    const { provider, apiKey } = req.body;
    await updateUserAISettings(userId, provider, apiKey);
    
    await logAudit(
      req.user.id,
      'UPDATE_AI_SETTINGS',
      'user',
      req.params.id,
      { provider },
      req.ip
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Update AI settings error:', error);
    res.status(500).json({ error: 'Error actualizando configuración AI' });
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

if (isProduction) {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

app.listen(PORT, HOST, () => {
  console.log(`Vento LexOps Backend running at http://${HOST}:${PORT}`);
});
