import { db } from './db';
import { holidays, notifications, users, offices } from '../shared/schema';
import { eq, and, gte, lte, isNotNull } from 'drizzle-orm';

export interface DeadlineInfo {
  deadlineDate: Date;
  gracePeriodEnd: Date;
  gracePeriodEndFormatted: string;
  businessDaysRemaining: number;
  isUrgent: boolean;
  alerts: AlertConfig[];
}

export interface AlertConfig {
  type: 'email' | 'sms' | 'notification';
  triggerDate: Date;
  hoursBeforeDeadline: number;
  message: string;
}

export interface UpcomingDeadline {
  notificationId: number;
  lexnetId: string;
  court: string;
  procedureNumber: string;
  deadlineDate: Date;
  gracePeriodEnd: Date;
  deadlineDescription: string;
  businessDaysRemaining: number;
  isUrgent: boolean;
  assignedLawyerId: number | null;
  assignedLawyerName: string | null;
  assignedLawyerEmail: string | null;
}

async function getHolidaysForOffice(officeId: number | null, year: number): Promise<Set<string>> {
  const startDateStr = `${year}-01-01`;
  const endDateStr = `${year}-12-31`;
  
  let conditions = [
    gte(holidays.date, startDateStr),
    lte(holidays.date, endDateStr)
  ];
  
  if (officeId) {
    conditions.push(eq(holidays.officeId, officeId));
  }
  
  const holidayRecords = await db
    .select()
    .from(holidays)
    .where(and(...conditions));
  
  const holidaySet = new Set<string>();
  for (const h of holidayRecords) {
    holidaySet.add(h.date);
  }
  
  return holidaySet;
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function isAugust(date: Date): boolean {
  return date.getMonth() === 7;
}

function isBusinessDay(date: Date, holidaySet: Set<string>): boolean {
  if (isWeekend(date)) return false;
  if (isAugust(date)) return false;
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;
  if (holidaySet.has(dateStr)) return false;
  
  return true;
}

export async function calculateBusinessDeadline(
  startDate: Date,
  businessDays: number,
  officeId: number | null = null
): Promise<DeadlineInfo> {
  const holidaySet = await getHolidaysForOffice(officeId, startDate.getFullYear());
  const nextYearHolidays = await getHolidaysForOffice(officeId, startDate.getFullYear() + 1);
  nextYearHolidays.forEach(h => holidaySet.add(h));
  
  const result = new Date(startDate);
  
  let countedDays = 0;
  let maxIterations = businessDays * 3 + 60;
  let iterations = 0;
  
  while (countedDays < businessDays && iterations < maxIterations) {
    result.setDate(result.getDate() + 1);
    iterations++;
    
    if (isBusinessDay(result, holidaySet)) {
      countedDays++;
    }
  }
  
  const gracePeriodEnd = calculateGracePeriod(result, holidaySet);
  
  const today = new Date();
  const businessDaysRemaining = countBusinessDaysBetween(today, result, holidaySet);
  
  const isUrgent = businessDaysRemaining <= 3;
  
  const alerts = generateAlerts(result, gracePeriodEnd, businessDaysRemaining);
  
  return {
    deadlineDate: result,
    gracePeriodEnd,
    gracePeriodEndFormatted: formatGracePeriod(gracePeriodEnd),
    businessDaysRemaining,
    isUrgent,
    alerts
  };
}

function calculateGracePeriod(deadlineDate: Date, holidaySet: Set<string>): Date {
  const graceDate = new Date(deadlineDate);
  graceDate.setDate(graceDate.getDate() + 1);
  
  let maxIterations = 60;
  let iterations = 0;
  while (!isBusinessDay(graceDate, holidaySet) && iterations < maxIterations) {
    graceDate.setDate(graceDate.getDate() + 1);
    iterations++;
  }
  
  graceDate.setHours(15, 0, 59, 0);
  
  return graceDate;
}

function countBusinessDaysBetween(
  startDate: Date,
  endDate: Date,
  holidaySet: Set<string>
): number {
  let count = 0;
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);
  
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  
  let maxIterations = 400;
  let iterations = 0;
  while (current < end && iterations < maxIterations) {
    current.setDate(current.getDate() + 1);
    iterations++;
    if (isBusinessDay(current, holidaySet)) {
      count++;
    }
  }
  
  return count;
}

function formatGracePeriod(gracePeriodEnd: Date): string {
  return gracePeriodEnd.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }) + ' hasta las 15:00:59h';
}

function generateAlerts(
  deadlineDate: Date,
  gracePeriodEnd: Date,
  businessDaysRemaining: number
): AlertConfig[] {
  const alerts: AlertConfig[] = [];
  
  if (businessDaysRemaining >= 2) {
    const alert48h = new Date(deadlineDate);
    alert48h.setDate(alert48h.getDate() - 2);
    alert48h.setHours(9, 0, 0, 0);
    
    alerts.push({
      type: 'email',
      triggerDate: alert48h,
      hoursBeforeDeadline: 48,
      message: `Plazo procesal vence en 2 días hábiles`
    });
  }
  
  if (businessDaysRemaining >= 1) {
    const alert24h = new Date(deadlineDate);
    alert24h.setDate(alert24h.getDate() - 1);
    alert24h.setHours(9, 0, 0, 0);
    
    alerts.push({
      type: 'email',
      triggerDate: alert24h,
      hoursBeforeDeadline: 24,
      message: `URGENTE: Plazo procesal vence mañana`
    });
    
    alerts.push({
      type: 'sms',
      triggerDate: alert24h,
      hoursBeforeDeadline: 24,
      message: `URGENTE: Plazo vence mañana`
    });
  }
  
  const alertGrace = new Date(gracePeriodEnd);
  alertGrace.setHours(9, 0, 0, 0);
  
  alerts.push({
    type: 'email',
    triggerDate: alertGrace,
    hoursBeforeDeadline: 6,
    message: `DÍA DE GRACIA: Plazo extendido hasta las 15:00:59h de hoy`
  });
  
  return alerts;
}

export async function getUpcomingDeadlines(
  officeId: number | null = null,
  daysAhead: number = 7
): Promise<UpcomingDeadline[]> {
  const today = new Date();
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);
  
  const notificationsWithDeadlines = await db
    .select({
      notification: notifications,
      lawyer: users
    })
    .from(notifications)
    .leftJoin(users, eq(notifications.assignedLawyerId, users.id))
    .where(isNotNull(notifications.extractedDeadlines));
  
  const upcomingDeadlines: UpcomingDeadline[] = [];
  const holidaySet = await getHolidaysForOffice(officeId, today.getFullYear());
  
  for (const { notification, lawyer } of notificationsWithDeadlines) {
    if (!notification.extractedDeadlines) continue;
    
    let deadlines: any[] = [];
    try {
      deadlines = typeof notification.extractedDeadlines === 'string'
        ? JSON.parse(notification.extractedDeadlines)
        : notification.extractedDeadlines;
    } catch {
      continue;
    }
    
    if (!Array.isArray(deadlines)) continue;
    
    for (const deadline of deadlines) {
      let deadlineDate: Date;
      
      if (deadline.date) {
        deadlineDate = new Date(deadline.date);
      } else if (deadline.days) {
        const notificationDate = notification.receivedDate || notification.createdAt;
        const info = await calculateBusinessDeadline(
          new Date(notificationDate),
          deadline.days,
          officeId
        );
        deadlineDate = info.deadlineDate;
      } else {
        continue;
      }
      
      if (deadlineDate < today || deadlineDate > futureDate) continue;
      
      const gracePeriodEnd = await calculateGracePeriod(deadlineDate, holidaySet);
      const businessDaysRemaining = await countBusinessDaysBetween(today, deadlineDate, holidaySet);
      
      upcomingDeadlines.push({
        notificationId: notification.id,
        lexnetId: notification.lexnetId,
        court: notification.court || '',
        procedureNumber: notification.procedureNumber || '',
        deadlineDate,
        gracePeriodEnd,
        deadlineDescription: deadline.description || deadline.action || 'Plazo procesal',
        businessDaysRemaining,
        isUrgent: businessDaysRemaining <= 3,
        assignedLawyerId: notification.assignedLawyerId,
        assignedLawyerName: lawyer?.fullName || null,
        assignedLawyerEmail: lawyer?.email || null
      });
    }
  }
  
  upcomingDeadlines.sort((a, b) => a.deadlineDate.getTime() - b.deadlineDate.getTime());
  
  return upcomingDeadlines;
}

export async function getDeadlinesNeedingAlert(): Promise<UpcomingDeadline[]> {
  const deadlines = await getUpcomingDeadlines(null, 3);
  return deadlines.filter(d => d.isUrgent);
}

export function calculateNaturalDeadline(startDate: Date, days: number): DeadlineInfo {
  const result = new Date(startDate);
  result.setDate(result.getDate() + 1 + days);
  
  const gracePeriodEnd = new Date(result);
  gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 1);
  gracePeriodEnd.setHours(15, 0, 59, 0);
  
  const today = new Date();
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysRemaining = Math.ceil((result.getTime() - today.getTime()) / msPerDay);
  
  return {
    deadlineDate: result,
    gracePeriodEnd,
    gracePeriodEndFormatted: formatGracePeriod(gracePeriodEnd),
    businessDaysRemaining: daysRemaining,
    isUrgent: daysRemaining <= 3,
    alerts: generateAlerts(result, gracePeriodEnd, daysRemaining)
  };
}
