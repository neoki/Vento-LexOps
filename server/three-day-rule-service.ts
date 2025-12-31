import { db } from "./db";
import { notifications, users, auditLogs } from "../shared/schema";
import { eq, and, lte, sql, isNull } from "drizzle-orm";

interface UnacceptedNotification {
  id: number;
  lexnetId: string;
  receivedDate: Date;
  hoursRemaining: number;
  alertLevel: 'WARNING' | 'URGENT' | 'CRITICAL';
  assignedLawyerId: number | null;
  assignedLawyerName?: string;
  assignedLawyerColor?: string;
  court: string;
  procedureNumber: string;
}

interface ThreeDayRuleSummary {
  critical: UnacceptedNotification[];
  urgent: UnacceptedNotification[];
  warning: UnacceptedNotification[];
  totalPending: number;
  nextExpiration: Date | null;
}

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
const WARNING_THRESHOLD_HOURS = 48;
const URGENT_THRESHOLD_HOURS = 24;
const CRITICAL_THRESHOLD_HOURS = 6;

function calculateHoursRemaining(receivedDate: Date): number {
  const now = new Date();
  const expirationTime = new Date(receivedDate.getTime() + THREE_DAYS_MS);
  const remainingMs = expirationTime.getTime() - now.getTime();
  return Math.max(0, remainingMs / (60 * 60 * 1000));
}

function getAlertLevel(hoursRemaining: number): 'WARNING' | 'URGENT' | 'CRITICAL' {
  if (hoursRemaining <= CRITICAL_THRESHOLD_HOURS) return 'CRITICAL';
  if (hoursRemaining <= URGENT_THRESHOLD_HOURS) return 'URGENT';
  return 'WARNING';
}

export async function checkThreeDayRule(officeId?: number): Promise<ThreeDayRuleSummary> {
  const now = new Date();
  const warningThreshold = new Date(now.getTime() - (THREE_DAYS_MS - (WARNING_THRESHOLD_HOURS * 60 * 60 * 1000)));
  
  const pendingNotifications = await db.select({
    id: notifications.id,
    lexnetId: notifications.lexnetId,
    receivedDate: notifications.receivedDate,
    downloadedDate: notifications.downloadedDate,
    assignedLawyerId: notifications.assignedLawyerId,
    court: notifications.court,
    procedureNumber: notifications.procedureNumber,
    lawyerName: users.fullName,
    lawyerColor: users.color,
  })
  .from(notifications)
  .leftJoin(users, eq(notifications.assignedLawyerId, users.id))
  .where(and(
    isNull(notifications.downloadedDate),
    lte(notifications.receivedDate, warningThreshold)
  ));
  
  const critical: UnacceptedNotification[] = [];
  const urgent: UnacceptedNotification[] = [];
  const warning: UnacceptedNotification[] = [];
  let nextExpiration: Date | null = null;
  
  for (const notif of pendingNotifications) {
    const hoursRemaining = calculateHoursRemaining(notif.receivedDate);
    const alertLevel = getAlertLevel(hoursRemaining);
    const expirationDate = new Date(notif.receivedDate.getTime() + THREE_DAYS_MS);
    
    if (!nextExpiration || expirationDate < nextExpiration) {
      nextExpiration = expirationDate;
    }
    
    const alertNotif: UnacceptedNotification = {
      id: notif.id,
      lexnetId: notif.lexnetId,
      receivedDate: notif.receivedDate,
      hoursRemaining: Math.round(hoursRemaining * 10) / 10,
      alertLevel,
      assignedLawyerId: notif.assignedLawyerId,
      assignedLawyerName: notif.lawyerName || undefined,
      assignedLawyerColor: notif.lawyerColor || undefined,
      court: notif.court,
      procedureNumber: notif.procedureNumber,
    };
    
    if (alertLevel === 'CRITICAL') {
      critical.push(alertNotif);
    } else if (alertLevel === 'URGENT') {
      urgent.push(alertNotif);
    } else {
      warning.push(alertNotif);
    }
  }
  
  return {
    critical: critical.sort((a, b) => a.hoursRemaining - b.hoursRemaining),
    urgent: urgent.sort((a, b) => a.hoursRemaining - b.hoursRemaining),
    warning: warning.sort((a, b) => a.hoursRemaining - b.hoursRemaining),
    totalPending: pendingNotifications.length,
    nextExpiration
  };
}

export async function getExpiredNotifications(): Promise<UnacceptedNotification[]> {
  const now = new Date();
  const expiredThreshold = new Date(now.getTime() - THREE_DAYS_MS);
  
  const expired = await db.select({
    id: notifications.id,
    lexnetId: notifications.lexnetId,
    receivedDate: notifications.receivedDate,
    assignedLawyerId: notifications.assignedLawyerId,
    court: notifications.court,
    procedureNumber: notifications.procedureNumber,
    lawyerName: users.fullName,
    lawyerColor: users.color,
  })
  .from(notifications)
  .leftJoin(users, eq(notifications.assignedLawyerId, users.id))
  .where(and(
    isNull(notifications.downloadedDate),
    lte(notifications.receivedDate, expiredThreshold)
  ));
  
  return expired.map(notif => ({
    id: notif.id,
    lexnetId: notif.lexnetId,
    receivedDate: notif.receivedDate,
    hoursRemaining: 0,
    alertLevel: 'CRITICAL' as const,
    assignedLawyerId: notif.assignedLawyerId,
    assignedLawyerName: notif.lawyerName || undefined,
    assignedLawyerColor: notif.lawyerColor || undefined,
    court: notif.court,
    procedureNumber: notif.procedureNumber,
  }));
}

export function generateThreeDayAlertEmail(summary: ThreeDayRuleSummary): {
  subject: string;
  htmlBody: string;
} {
  const totalAlerts = summary.critical.length + summary.urgent.length;
  
  const subject = summary.critical.length > 0
    ? `⚠️ CRÍTICO: ${summary.critical.length} notificación(es) próximas a expirar`
    : `🔔 Alerta: ${totalAlerts} notificación(es) pendientes de aceptar`;
  
  let htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .alert-section { margin: 20px 0; padding: 15px; border-radius: 8px; }
    .critical { background-color: #FEE2E2; border-left: 4px solid #DC2626; }
    .urgent { background-color: #FEF3C7; border-left: 4px solid #F59E0B; }
    .warning { background-color: #E0F2FE; border-left: 4px solid #0284C7; }
    .notif-item { padding: 10px; margin: 5px 0; background: white; border-radius: 4px; }
    .lawyer-badge { display: inline-block; padding: 2px 8px; border-radius: 12px; color: white; font-size: 12px; }
    .hours { font-weight: bold; }
    h2 { margin: 0 0 10px 0; }
  </style>
</head>
<body>
  <h1>Alerta de Regla de 3 Días - LexNET</h1>
  <p>Las siguientes notificaciones requieren aceptación urgente:</p>
`;

  if (summary.critical.length > 0) {
    htmlBody += `
  <div class="alert-section critical">
    <h2>🚨 CRÍTICO - Menos de 6 horas (${summary.critical.length})</h2>
    ${summary.critical.map(n => `
      <div class="notif-item">
        <strong>${n.procedureNumber}</strong> - ${n.court}<br>
        <span class="hours" style="color: #DC2626;">⏰ ${n.hoursRemaining}h restantes</span>
        ${n.assignedLawyerName ? `<span class="lawyer-badge" style="background-color: ${n.assignedLawyerColor || '#666'}">${n.assignedLawyerName}</span>` : ''}
      </div>
    `).join('')}
  </div>`;
  }

  if (summary.urgent.length > 0) {
    htmlBody += `
  <div class="alert-section urgent">
    <h2>⚠️ URGENTE - Menos de 24 horas (${summary.urgent.length})</h2>
    ${summary.urgent.map(n => `
      <div class="notif-item">
        <strong>${n.procedureNumber}</strong> - ${n.court}<br>
        <span class="hours" style="color: #F59E0B;">⏰ ${n.hoursRemaining}h restantes</span>
        ${n.assignedLawyerName ? `<span class="lawyer-badge" style="background-color: ${n.assignedLawyerColor || '#666'}">${n.assignedLawyerName}</span>` : ''}
      </div>
    `).join('')}
  </div>`;
  }

  if (summary.warning.length > 0) {
    htmlBody += `
  <div class="alert-section warning">
    <h2>🔔 Atención - Menos de 48 horas (${summary.warning.length})</h2>
    ${summary.warning.map(n => `
      <div class="notif-item">
        <strong>${n.procedureNumber}</strong> - ${n.court}<br>
        <span class="hours" style="color: #0284C7;">⏰ ${n.hoursRemaining}h restantes</span>
        ${n.assignedLawyerName ? `<span class="lawyer-badge" style="background-color: ${n.assignedLawyerColor || '#666'}">${n.assignedLawyerName}</span>` : ''}
      </div>
    `).join('')}
  </div>`;
  }

  htmlBody += `
  <p style="margin-top: 30px; color: #666; font-size: 12px;">
    Este es un mensaje automático del sistema Vento LexOps.
  </p>
</body>
</html>`;

  return { subject, htmlBody };
}

export async function logThreeDayRuleCheck(
  userId: number | null,
  summary: ThreeDayRuleSummary
): Promise<void> {
  await db.insert(auditLogs).values({
    actorUserId: userId,
    action: 'THREE_DAY_RULE_CHECK',
    targetType: 'SYSTEM',
    metadata: {
      critical: summary.critical.length,
      urgent: summary.urgent.length,
      warning: summary.warning.length,
      totalPending: summary.totalPending,
      nextExpiration: summary.nextExpiration?.toISOString()
    }
  });
}
