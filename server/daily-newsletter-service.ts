import { db } from './db';
import { users, notifications, proceduralTasks, lexnetPackages } from '../shared/schema';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import AdmZip from 'adm-zip';

interface LawyerSummary {
  id: number;
  fullName: string;
  email: string;
  color: string;
  pendingNotifications: number;
  urgentDeadlines: number;
  tasksToday: number;
  criticalAlerts: string[];
}

interface DailyNewsletter {
  date: Date;
  officeId: number | null;
  totalNotifications: number;
  totalUrgentDeadlines: number;
  totalCriticalAlerts: number;
  lawyerSummaries: LawyerSummary[];
  htmlBody: string;
  zipAttachment?: Buffer;
}

const LAWYER_COLORS = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
  '#14B8A6', '#A855F7', '#22C55E', '#E11D48', '#0EA5E9'
];

export async function generateDailyNewsletter(officeId: number | null = null): Promise<DailyNewsletter> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const weekFromNow = new Date(today);
  weekFromNow.setDate(weekFromNow.getDate() + 7);

  const lawyerConditions = [
    eq(users.role, 'LAWYER'),
    eq(users.isActive, true)
  ];
  if (officeId) {
    lawyerConditions.push(eq(users.officeId, officeId));
  }

  const lawyers = await db.select({
    id: users.id,
    fullName: users.fullName,
    email: users.email,
    color: users.color,
  }).from(users).where(and(...lawyerConditions));

  const lawyerSummaries: LawyerSummary[] = await Promise.all(
    lawyers.map(async (lawyer) => {
      const pendingNotifs = await db.select({ count: sql<number>`count(*)` })
        .from(notifications)
        .where(eq(notifications.assignedLawyerId, lawyer.id));

      const urgentTasks = await db.select({ count: sql<number>`count(*)` })
        .from(proceduralTasks)
        .where(and(
          eq(proceduralTasks.lawyerId, lawyer.id),
          eq(proceduralTasks.status, 'PENDING'),
          lte(proceduralTasks.dueDate, weekFromNow)
        ));

      const todayTasks = await db.select({ count: sql<number>`count(*)` })
        .from(proceduralTasks)
        .where(and(
          eq(proceduralTasks.lawyerId, lawyer.id),
          eq(proceduralTasks.status, 'PENDING'),
          gte(proceduralTasks.dueDate, today),
          lte(proceduralTasks.dueDate, tomorrow)
        ));

      const criticalAlerts: string[] = [];
      const pendingCount = Number(pendingNotifs[0]?.count || 0);
      
      if (pendingCount > 15) {
        criticalAlerts.push(`${pendingCount} notificaciones pendientes`);
      }

      return {
        id: lawyer.id,
        fullName: lawyer.fullName || 'Sin nombre',
        email: lawyer.email || '',
        color: lawyer.color || LAWYER_COLORS[lawyer.id % LAWYER_COLORS.length],
        pendingNotifications: pendingCount,
        urgentDeadlines: Number(urgentTasks[0]?.count || 0),
        tasksToday: Number(todayTasks[0]?.count || 0),
        criticalAlerts
      };
    })
  );

  const totalNotifications = lawyerSummaries.reduce((sum, l) => sum + l.pendingNotifications, 0);
  const totalUrgentDeadlines = lawyerSummaries.reduce((sum, l) => sum + l.urgentDeadlines, 0);
  const totalCriticalAlerts = lawyerSummaries.reduce((sum, l) => sum + l.criticalAlerts.length, 0);

  const htmlBody = generateNewsletterHTML(today, lawyerSummaries, totalNotifications, totalUrgentDeadlines, totalCriticalAlerts);

  return {
    date: today,
    officeId,
    totalNotifications,
    totalUrgentDeadlines,
    totalCriticalAlerts,
    lawyerSummaries,
    htmlBody
  };
}

function generateNewsletterHTML(
  date: Date,
  lawyers: LawyerSummary[],
  totalNotifications: number,
  totalUrgentDeadlines: number,
  totalCriticalAlerts: number
): string {
  const dateStr = date.toLocaleDateString('es-ES', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  const lawyerRows = lawyers.map(lawyer => `
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 12px 16px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background-color: ${lawyer.color};"></span>
          <strong style="color: ${lawyer.color};">${lawyer.fullName}</strong>
        </div>
      </td>
      <td style="padding: 12px 16px; text-align: center;">
        <span style="background-color: ${lawyer.pendingNotifications > 10 ? '#FEE2E2' : '#DBEAFE'}; color: ${lawyer.pendingNotifications > 10 ? '#DC2626' : '#1D4ED8'}; padding: 4px 8px; border-radius: 9999px; font-weight: 600;">${lawyer.pendingNotifications}</span>
      </td>
      <td style="padding: 12px 16px; text-align: center;">
        <span style="background-color: ${lawyer.urgentDeadlines > 5 ? '#FEF3C7' : '#D1FAE5'}; color: ${lawyer.urgentDeadlines > 5 ? '#D97706' : '#059669'}; padding: 4px 8px; border-radius: 9999px; font-weight: 600;">${lawyer.urgentDeadlines}</span>
      </td>
      <td style="padding: 12px 16px; text-align: center;">${lawyer.tasksToday}</td>
      <td style="padding: 12px 16px;">
        ${lawyer.criticalAlerts.length > 0 
          ? `<span style="color: #DC2626; font-weight: 600;">${lawyer.criticalAlerts.join(', ')}</span>`
          : '<span style="color: #10B981;">OK</span>'
        }
      </td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Vento LexOps - Resumen Diario</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6; margin: 0; padding: 20px;">
  <div style="max-width: 800px; margin: 0 auto; background-color: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    <div style="background: linear-gradient(135deg, #1E40AF 0%, #3B82F6 100%); color: white; padding: 24px 32px;">
      <h1 style="margin: 0 0 8px 0; font-size: 24px;">Vento LexOps</h1>
      <p style="margin: 0; opacity: 0.9;">Resumen Diario - ${dateStr}</p>
    </div>
    <div style="padding: 24px 32px;">
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px;">
        <div style="background-color: #EFF6FF; padding: 16px; border-radius: 8px; text-align: center;">
          <p style="margin: 0 0 4px 0; color: #6B7280; font-size: 14px;">Notificaciones Pendientes</p>
          <p style="margin: 0; font-size: 32px; font-weight: 700; color: #1D4ED8;">${totalNotifications}</p>
        </div>
        <div style="background-color: #FEF3C7; padding: 16px; border-radius: 8px; text-align: center;">
          <p style="margin: 0 0 4px 0; color: #6B7280; font-size: 14px;">Plazos Urgentes (7d)</p>
          <p style="margin: 0; font-size: 32px; font-weight: 700; color: #D97706;">${totalUrgentDeadlines}</p>
        </div>
        <div style="background-color: ${totalCriticalAlerts > 0 ? '#FEE2E2' : '#D1FAE5'}; padding: 16px; border-radius: 8px; text-align: center;">
          <p style="margin: 0 0 4px 0; color: #6B7280; font-size: 14px;">Alertas Criticas</p>
          <p style="margin: 0; font-size: 32px; font-weight: 700; color: ${totalCriticalAlerts > 0 ? '#DC2626' : '#059669'};">${totalCriticalAlerts}</p>
        </div>
      </div>
      <h2 style="margin: 0 0 16px 0; font-size: 18px; color: #374151;">Estado por Letrado</h2>
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
        <thead>
          <tr style="background-color: #F9FAFB;">
            <th style="padding: 12px 16px; text-align: left; font-weight: 600; color: #374151;">Letrado</th>
            <th style="padding: 12px 16px; text-align: center; font-weight: 600; color: #374151;">Pendientes</th>
            <th style="padding: 12px 16px; text-align: center; font-weight: 600; color: #374151;">Urgentes</th>
            <th style="padding: 12px 16px; text-align: center; font-weight: 600; color: #374151;">Hoy</th>
            <th style="padding: 12px 16px; text-align: left; font-weight: 600; color: #374151;">Alertas</th>
          </tr>
        </thead>
        <tbody>${lawyerRows}</tbody>
      </table>
      <p style="margin: 24px 0 0 0; font-size: 12px; color: #9CA3AF; text-align: center;">
        Este correo ha sido generado automaticamente por Vento LexOps.
      </p>
    </div>
  </div>
</body>
</html>`;
}

export async function generateNewsletterWithZip(officeId: number | null = null): Promise<DailyNewsletter> {
  const newsletter = await generateDailyNewsletter(officeId);
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayPackages = await db.select()
    .from(lexnetPackages)
    .where(and(
      gte(lexnetPackages.downloadDate, today),
      lte(lexnetPackages.downloadDate, tomorrow)
    ));

  if (todayPackages.length > 0) {
    const zip = new AdmZip();
    
    const summaryContent = `RESUMEN PAQUETES LEXNET - ${today.toLocaleDateString('es-ES')}
${'='.repeat(50)}

Total paquetes: ${todayPackages.length}

${todayPackages.map((pkg, i) => `
${i + 1}. Paquete ${pkg.packageId}
   - Estado: ${pkg.status}
   - Fecha: ${pkg.downloadDate.toLocaleDateString('es-ES')}
`).join('\n')}
`;
    
    zip.addFile('resumen.txt', Buffer.from(summaryContent, 'utf8'));
    newsletter.zipAttachment = zip.toBuffer();
  }
  
  return newsletter;
}

export async function getNewsletterPreview(officeId: number | null = null): Promise<{ html: string; stats: any }> {
  const newsletter = await generateDailyNewsletter(officeId);
  return {
    html: newsletter.htmlBody,
    stats: {
      totalNotifications: newsletter.totalNotifications,
      totalUrgentDeadlines: newsletter.totalUrgentDeadlines,
      totalCriticalAlerts: newsletter.totalCriticalAlerts,
      lawyerCount: newsletter.lawyerSummaries.length
    }
  };
}
