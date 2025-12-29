import { db } from './db';
import { notifications, users, offices } from '../shared/schema';
import { eq, and, isNotNull, lte, gte } from 'drizzle-orm';
import { getUpcomingDeadlines, UpcomingDeadline } from './deadline-calculator';

export interface PendingAlert {
  id: string;
  notificationId: number;
  deadlineDate: Date;
  gracePeriodEnd: Date;
  description: string;
  recipientEmail: string;
  recipientName: string;
  alertType: 'email' | 'sms' | 'push';
  hoursBeforeDeadline: number;
  status: 'pending' | 'sent' | 'failed';
  court: string;
  procedureNumber: string;
  scheduledFor: Date;
}

export interface AlertResult {
  alertId: string;
  success: boolean;
  message: string;
  sentAt?: Date;
}

export async function generatePendingAlerts(): Promise<PendingAlert[]> {
  const upcomingDeadlines = await getUpcomingDeadlines(null, 7);
  const alerts: PendingAlert[] = [];
  const now = new Date();
  
  for (const deadline of upcomingDeadlines) {
    if (!deadline.assignedLawyerEmail) continue;
    
    if (deadline.businessDaysRemaining === 2) {
      const alertTime = new Date(deadline.deadlineDate);
      alertTime.setDate(alertTime.getDate() - 2);
      alertTime.setHours(9, 0, 0, 0);
      
      if (alertTime > now) {
        alerts.push({
          id: `${deadline.notificationId}-48h`,
          notificationId: deadline.notificationId,
          deadlineDate: deadline.deadlineDate,
          gracePeriodEnd: deadline.gracePeriodEnd,
          description: deadline.deadlineDescription,
          recipientEmail: deadline.assignedLawyerEmail,
          recipientName: deadline.assignedLawyerName || 'Letrado',
          alertType: 'email',
          hoursBeforeDeadline: 48,
          status: 'pending',
          court: deadline.court,
          procedureNumber: deadline.procedureNumber,
          scheduledFor: alertTime
        });
      }
    }
    
    if (deadline.businessDaysRemaining === 1) {
      const alertTime = new Date(deadline.deadlineDate);
      alertTime.setDate(alertTime.getDate() - 1);
      alertTime.setHours(9, 0, 0, 0);
      
      if (alertTime > now) {
        alerts.push({
          id: `${deadline.notificationId}-24h`,
          notificationId: deadline.notificationId,
          deadlineDate: deadline.deadlineDate,
          gracePeriodEnd: deadline.gracePeriodEnd,
          description: deadline.deadlineDescription,
          recipientEmail: deadline.assignedLawyerEmail,
          recipientName: deadline.assignedLawyerName || 'Letrado',
          alertType: 'email',
          hoursBeforeDeadline: 24,
          status: 'pending',
          court: deadline.court,
          procedureNumber: deadline.procedureNumber,
          scheduledFor: alertTime
        });
      }
    }
    
    if (deadline.businessDaysRemaining === 0) {
      const alertTime = new Date(deadline.gracePeriodEnd);
      alertTime.setHours(9, 0, 0, 0);
      
      if (alertTime > now) {
        alerts.push({
          id: `${deadline.notificationId}-grace`,
          notificationId: deadline.notificationId,
          deadlineDate: deadline.deadlineDate,
          gracePeriodEnd: deadline.gracePeriodEnd,
          description: deadline.deadlineDescription,
          recipientEmail: deadline.assignedLawyerEmail,
          recipientName: deadline.assignedLawyerName || 'Letrado',
          alertType: 'email',
          hoursBeforeDeadline: 6,
          status: 'pending',
          court: deadline.court,
          procedureNumber: deadline.procedureNumber,
          scheduledFor: alertTime
        });
      }
    }
  }
  
  return alerts;
}

export function generateAlertEmailContent(alert: PendingAlert): { subject: string; html: string; text: string } {
  const formatDate = (date: Date) => date.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  
  const formatTime = (date: Date) => date.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit'
  });
  
  let subject: string;
  let urgencyLevel: string;
  let urgencyColor: string;
  
  if (alert.hoursBeforeDeadline <= 6) {
    subject = `DIA DE GRACIA - ${alert.procedureNumber}`;
    urgencyLevel = 'DIA DE GRACIA';
    urgencyColor = '#dc2626';
  } else if (alert.hoursBeforeDeadline <= 24) {
    subject = `URGENTE: Plazo vence MAÑANA - ${alert.procedureNumber}`;
    urgencyLevel = 'URGENTE - 24 HORAS';
    urgencyColor = '#ea580c';
  } else {
    subject = `Recordatorio: Plazo procesal en 2 días - ${alert.procedureNumber}`;
    urgencyLevel = 'AVISO - 48 HORAS';
    urgencyColor = '#ca8a04';
  }
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #1f2937; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: ${urgencyColor}; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
    .content { background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
    .info-box { background: white; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid ${urgencyColor}; }
    .label { color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
    .value { color: #1f2937; font-size: 16px; font-weight: 600; margin-top: 4px; }
    .grace-note { background: #fef3c7; padding: 12px; border-radius: 6px; margin-top: 16px; font-size: 14px; }
    .footer { text-align: center; color: #9ca3af; font-size: 12px; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 24px;">${urgencyLevel}</h1>
      <p style="margin: 8px 0 0 0; opacity: 0.9;">Sistema de Alertas LexOps</p>
    </div>
    <div class="content">
      <p>Estimado/a ${alert.recipientName},</p>
      <p>Le recordamos que tiene un plazo procesal próximo a vencer:</p>
      
      <div class="info-box">
        <div class="label">Descripción</div>
        <div class="value">${alert.description}</div>
      </div>
      
      <div class="info-box">
        <div class="label">Procedimiento</div>
        <div class="value">${alert.procedureNumber}</div>
      </div>
      
      <div class="info-box">
        <div class="label">Juzgado</div>
        <div class="value">${alert.court}</div>
      </div>
      
      <div class="info-box">
        <div class="label">Fecha de vencimiento</div>
        <div class="value">${formatDate(alert.deadlineDate)}</div>
      </div>
      
      <div class="grace-note">
        <strong>Día de gracia:</strong> ${formatDate(alert.gracePeriodEnd)} hasta las ${formatTime(alert.gracePeriodEnd)} (conforme LEC art. 135.1)
      </div>
      
      <p style="margin-top: 24px;">Por favor, tome las acciones necesarias para cumplir con este plazo procesal.</p>
      
      <div class="footer">
        <p>Este es un mensaje automático generado por Vento LexOps.</p>
        <p>No responda a este correo.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `;
  
  const text = `
${urgencyLevel}
==================

Estimado/a ${alert.recipientName},

Le recordamos que tiene un plazo procesal próximo a vencer:

Descripción: ${alert.description}
Procedimiento: ${alert.procedureNumber}
Juzgado: ${alert.court}
Fecha de vencimiento: ${formatDate(alert.deadlineDate)}

DÍA DE GRACIA: ${formatDate(alert.gracePeriodEnd)} hasta las ${formatTime(alert.gracePeriodEnd)}
(conforme LEC art. 135.1)

Por favor, tome las acciones necesarias para cumplir con este plazo procesal.

---
Este es un mensaje automático generado por Vento LexOps.
  `;
  
  return { subject, html, text };
}

export async function sendAlertViaMicrosoftGraph(
  alert: PendingAlert,
  accessToken: string
): Promise<AlertResult> {
  const { subject, html } = generateAlertEmailContent(alert);
  
  try {
    const response = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: {
          subject,
          body: {
            contentType: 'HTML',
            content: html
          },
          toRecipients: [{
            emailAddress: {
              address: alert.recipientEmail
            }
          }],
          importance: alert.hoursBeforeDeadline <= 24 ? 'high' : 'normal'
        },
        saveToSentItems: true
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      return {
        alertId: alert.id,
        success: false,
        message: `Microsoft Graph error: ${error}`
      };
    }
    
    return {
      alertId: alert.id,
      success: true,
      message: 'Email sent via Microsoft Graph',
      sentAt: new Date()
    };
  } catch (error) {
    return {
      alertId: alert.id,
      success: false,
      message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

export async function checkAndSendDueAlerts(): Promise<AlertResult[]> {
  const pendingAlerts = await generatePendingAlerts();
  const results: AlertResult[] = [];
  const now = new Date();
  
  for (const alert of pendingAlerts) {
    if (alert.scheduledFor <= now && alert.status === 'pending') {
      console.log(`[AlertService] Alert ${alert.id} is due, would send to ${alert.recipientEmail}`);
      results.push({
        alertId: alert.id,
        success: true,
        message: 'Alert logged (email sending requires Microsoft Graph integration)',
        sentAt: now
      });
    }
  }
  
  return results;
}

export async function getAlertsSummary(): Promise<{
  urgentDeadlines: number;
  alertsToday: number;
  alertsTomorrow: number;
  totalPending: number;
}> {
  const alerts = await generatePendingAlerts();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const dayAfter = new Date(tomorrow);
  dayAfter.setDate(dayAfter.getDate() + 1);
  
  return {
    urgentDeadlines: alerts.filter(a => a.hoursBeforeDeadline <= 24).length,
    alertsToday: alerts.filter(a => a.scheduledFor >= today && a.scheduledFor < tomorrow).length,
    alertsTomorrow: alerts.filter(a => a.scheduledFor >= tomorrow && a.scheduledFor < dayAfter).length,
    totalPending: alerts.length
  };
}
