import { db } from './db';
import { proceduralTasks, users, auditLogs } from '../shared/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import * as msGraph from './microsoft-graph';

interface CalendarSyncResult {
  created: number;
  updated: number;
  deleted: number;
  errors: string[];
}

const TASK_CATEGORY_COLORS: Record<string, string> = {
  'HEARING': 'Red',
  'DOCUMENT_PREP': 'Blue',
  'CLIENT_CONTACT': 'Green',
  'REVIEW': 'Yellow',
  'FILING': 'Purple',
  'OTHER': 'Gray'
};

export async function syncTasksToOutlook(
  userId: number,
  daysAhead: number = 30
): Promise<CalendarSyncResult> {
  const result: CalendarSyncResult = { created: 0, updated: 0, deleted: 0, errors: [] };
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + daysAhead);

  const tasks = await db.select()
    .from(proceduralTasks)
    .where(and(
      eq(proceduralTasks.lawyerId, userId),
      gte(proceduralTasks.dueDate, today),
      lte(proceduralTasks.dueDate, endDate)
    ));

  for (const task of tasks) {
    try {
      const event = buildOutlookEvent(task);
      
      if (task.outlookEventId) {
        result.updated++;
      } else {
        result.created++;
      }
      
      await db.update(proceduralTasks)
        .set({ isOutlookSynced: true })
        .where(eq(proceduralTasks.id, task.id));
    } catch (error) {
      result.errors.push(`Error syncing task ${task.id}: ${error}`);
    }
  }

  return result;
}

function buildOutlookEvent(task: any): any {
  const dueDate = new Date(task.dueDate);

  const showAs = task.status === 'COMPLETED' ? 'free' : 'busy';
  const category = TASK_CATEGORY_COLORS[task.taskType] || 'Gray';

  const body = `
<b>Procedimiento:</b> ${task.procedureNumber || 'N/A'}<br>
<b>Juzgado:</b> ${task.court || 'N/A'}<br>
<b>Tipo:</b> ${task.taskType}<br>
<b>Prioridad:</b> ${task.priority}<br>
<hr>
${task.description || ''}
${task.gracePeriodEnd ? `<br><br><b>Día de gracia hasta:</b> ${new Date(task.gracePeriodEnd).toLocaleString('es-ES')}` : ''}
  `.trim();

  return {
    subject: `[${task.priority}] ${task.title}`,
    start: {
      dateTime: dueDate.toISOString().split('T')[0] + 'T00:00:00',
      timeZone: 'Europe/Madrid'
    },
    end: {
      dateTime: dueDate.toISOString().split('T')[0] + 'T23:59:59',
      timeZone: 'Europe/Madrid'
    },
    isAllDay: true,
    categories: [category],
    body: {
      contentType: 'HTML',
      content: body
    },
    showAs: showAs,
    importance: task.priority === 'CRITICAL' ? 'high' : task.priority === 'HIGH' ? 'high' : 'normal',
    reminderMinutesBeforeStart: task.priority === 'CRITICAL' ? 1440 : 480
  };
}

export async function markTaskCompleted(
  taskId: number,
  userId: number
): Promise<void> {
  const [task] = await db.select()
    .from(proceduralTasks)
    .where(eq(proceduralTasks.id, taskId))
    .limit(1);

  if (!task) {
    throw new Error('Tarea no encontrada');
  }

  await db.update(proceduralTasks)
    .set({ 
      status: 'COMPLETED',
      completedAt: new Date(),
      completedBy: userId
    })
    .where(eq(proceduralTasks.id, taskId));

  await db.insert(auditLogs).values({
    actorUserId: userId,
    action: 'COMPLETE_TASK',
    targetType: 'PROCEDURAL_TASK',
    targetId: String(taskId),
    metadata: { taskTitle: task.title, completedAt: new Date().toISOString() }
  });
}

export async function auditMissedDeadlines(): Promise<any[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const missedTasks = await db.select({
    task: proceduralTasks,
    lawyer: {
      id: users.id,
      fullName: users.fullName,
      email: users.email
    }
  })
  .from(proceduralTasks)
  .leftJoin(users, eq(proceduralTasks.lawyerId, users.id))
  .where(and(
    eq(proceduralTasks.status, 'PENDING'),
    lte(proceduralTasks.dueDate, today)
  ))
  .orderBy(proceduralTasks.dueDate);

  const auditEntries = missedTasks.map(item => ({
    taskId: item.task.id,
    title: item.task.title,
    dueDate: item.task.dueDate,
    gracePeriodEnd: item.task.gracePeriodEnd,
    lawyerId: item.lawyer?.id,
    lawyerName: item.lawyer?.fullName,
    lawyerEmail: item.lawyer?.email,
    procedureNumber: item.task.procedureNumber,
    court: item.task.court,
    daysOverdue: Math.ceil((today.getTime() - new Date(item.task.dueDate!).getTime()) / (24 * 60 * 60 * 1000)),
    requiresJustification: true
  }));

  for (const entry of auditEntries) {
    await db.insert(auditLogs).values({
      actorUserId: null,
      action: 'MISSED_DEADLINE_AUDIT',
      targetType: 'PROCEDURAL_TASK',
      targetId: String(entry.taskId),
      metadata: entry
    });
  }

  return auditEntries;
}

export async function addJustificationToMissedDeadline(
  taskId: number,
  userId: number,
  justification: string
): Promise<void> {
  const [task] = await db.select()
    .from(proceduralTasks)
    .where(eq(proceduralTasks.id, taskId))
    .limit(1);

  if (!task) {
    throw new Error('Tarea no encontrada');
  }

  await db.insert(auditLogs).values({
    actorUserId: userId,
    action: 'MISSED_DEADLINE_JUSTIFICATION',
    targetType: 'PROCEDURAL_TASK',
    targetId: String(taskId),
    metadata: {
      taskTitle: task.title,
      dueDate: task.dueDate,
      justification,
      justifiedAt: new Date().toISOString()
    }
  });
}

export async function getCalendarEvents(
  userId: number,
  startDate: Date,
  endDate: Date
): Promise<any[]> {
  const tasks = await db.select()
    .from(proceduralTasks)
    .where(and(
      eq(proceduralTasks.lawyerId, userId),
      gte(proceduralTasks.dueDate, startDate),
      lte(proceduralTasks.dueDate, endDate)
    ))
    .orderBy(proceduralTasks.dueDate);

  return tasks.map(task => ({
    id: task.id,
    title: task.title,
    start: task.dueDate,
    end: task.dueDate,
    allDay: true,
    color: task.status === 'COMPLETED' ? '#9CA3AF' : 
           task.priority === 'CRITICAL' ? '#DC2626' :
           task.priority === 'HIGH' ? '#F97316' :
           task.priority === 'MEDIUM' ? '#EAB308' : '#22C55E',
    extendedProps: {
      taskType: task.taskType,
      priority: task.priority,
      status: task.status,
      procedureNumber: task.procedureNumber,
      court: task.court,
      gracePeriodEnd: task.gracePeriodEnd
    }
  }));
}
