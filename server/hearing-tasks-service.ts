import { db } from "./db";
import { proceduralTasks, taskTemplates, notifications, users } from "../shared/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { calculateBusinessDeadline } from "./deadline-calculator";

interface HearingInfo {
  notificationId: number;
  lawyerId: number;
  hearingDate: Date;
  court: string;
  procedureNumber: string;
  clientName?: string;
  opposingParty?: string;
}

interface TaskConfig {
  code: string;
  name: string;
  taskType: 'PREPARATION' | 'CLIENT_MEETING' | 'EVIDENCE_DEADLINE' | 'HEARING';
  offsetDays: number;
  offsetDirection: 'before' | 'after';
  titleTemplate: string;
  descriptionTemplate?: string;
}

const DEFAULT_HEARING_TASKS: TaskConfig[] = [
  {
    code: 'HEARING_PREP_45D',
    name: 'Preparación interna (T-1.5 meses)',
    taskType: 'PREPARATION',
    offsetDays: 45,
    offsetDirection: 'before',
    titleTemplate: 'Preparación juicio: {clientName} vs {opposingParty}',
    descriptionTemplate: 'Revisar documentación y preparar estrategia para juicio. Autos: {procedureNumber}'
  },
  {
    code: 'CLIENT_MEETING_30D',
    name: 'Reunión con cliente (T-1 mes)',
    taskType: 'CLIENT_MEETING',
    offsetDays: 30,
    offsetDirection: 'before',
    titleTemplate: 'Cita cliente: {clientName} - Prep. juicio',
    descriptionTemplate: 'Reunión preparatoria con cliente antes del juicio. Autos: {procedureNumber}'
  },
  {
    code: 'EVIDENCE_DEADLINE_15D',
    name: 'Límite proposición prueba (T-15 días)',
    taskType: 'EVIDENCE_DEADLINE',
    offsetDays: 15,
    offsetDirection: 'before',
    titleTemplate: 'LÍMITE PRUEBA: {procedureNumber}',
    descriptionTemplate: 'Último día para solicitar/aportar prueba. Juicio: {clientName} vs {opposingParty}'
  },
  {
    code: 'HEARING_DAY',
    name: 'Día del juicio',
    taskType: 'HEARING',
    offsetDays: 0,
    offsetDirection: 'before',
    titleTemplate: 'Juicio {clientName} vs {opposingParty} | {procedureNumber} | {court}',
    descriptionTemplate: 'Señalamiento de juicio oral'
  }
];

function interpolateTemplate(template: string, data: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => data[key] || match);
}

function calculateTaskDate(hearingDate: Date, offsetDays: number, direction: 'before' | 'after'): Date {
  const result = new Date(hearingDate);
  const multiplier = direction === 'before' ? -1 : 1;
  result.setDate(result.getDate() + (offsetDays * multiplier));
  return result;
}

export async function generateHearingTasks(hearingInfo: HearingInfo): Promise<number[]> {
  const createdTaskIds: number[] = [];
  
  const templateData = {
    clientName: hearingInfo.clientName || 'Cliente',
    opposingParty: hearingInfo.opposingParty || 'Contrario',
    procedureNumber: hearingInfo.procedureNumber,
    court: hearingInfo.court
  };
  
  let customTemplates = await db.select().from(taskTemplates).where(eq(taskTemplates.isActive, true));
  
  const tasksToCreate = customTemplates.length > 0 
    ? customTemplates.map(t => ({
        code: t.code,
        name: t.name,
        taskType: t.taskType as TaskConfig['taskType'],
        offsetDays: t.offsetDays,
        offsetDirection: t.offsetDirection as 'before' | 'after',
        titleTemplate: t.titleTemplate,
        descriptionTemplate: t.descriptionTemplate || undefined
      }))
    : DEFAULT_HEARING_TASKS;
  
  let parentTaskId: number | null = null;
  
  for (const taskConfig of tasksToCreate) {
    const dueDate = calculateTaskDate(
      hearingInfo.hearingDate,
      taskConfig.offsetDays,
      taskConfig.offsetDirection
    );
    
    const title = interpolateTemplate(taskConfig.titleTemplate, templateData);
    const description = taskConfig.descriptionTemplate 
      ? interpolateTemplate(taskConfig.descriptionTemplate, templateData)
      : undefined;
    
    const priority = taskConfig.taskType === 'HEARING' ? 'CRITICAL' 
      : taskConfig.taskType === 'EVIDENCE_DEADLINE' ? 'HIGH'
      : 'MEDIUM';
    
    const [newTask] = await db.insert(proceduralTasks).values({
      notificationId: hearingInfo.notificationId,
      lawyerId: hearingInfo.lawyerId,
      parentTaskId: taskConfig.taskType === 'HEARING' ? null : parentTaskId,
      taskType: taskConfig.taskType,
      title,
      description,
      dueDate,
      isAllDay: true,
      status: 'PENDING',
      priority: priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
      court: hearingInfo.court,
      procedureNumber: hearingInfo.procedureNumber,
      clientName: hearingInfo.clientName,
      opposingParty: hearingInfo.opposingParty,
    }).returning({ id: proceduralTasks.id });
    
    createdTaskIds.push(newTask.id);
    
    if (taskConfig.taskType === 'HEARING') {
      parentTaskId = newTask.id;
    }
  }
  
  return createdTaskIds;
}

export async function getTasksForLawyer(
  lawyerId: number,
  startDate?: Date,
  endDate?: Date
): Promise<any[]> {
  const conditions = [eq(proceduralTasks.lawyerId, lawyerId)];
  
  if (startDate) {
    conditions.push(gte(proceduralTasks.dueDate, startDate));
  }
  if (endDate) {
    conditions.push(lte(proceduralTasks.dueDate, endDate));
  }
  
  return db.select({
    id: proceduralTasks.id,
    taskType: proceduralTasks.taskType,
    title: proceduralTasks.title,
    description: proceduralTasks.description,
    dueDate: proceduralTasks.dueDate,
    gracePeriodEnd: proceduralTasks.gracePeriodEnd,
    status: proceduralTasks.status,
    priority: proceduralTasks.priority,
    court: proceduralTasks.court,
    procedureNumber: proceduralTasks.procedureNumber,
    clientName: proceduralTasks.clientName,
    opposingParty: proceduralTasks.opposingParty,
    isOutlookSynced: proceduralTasks.isOutlookSynced,
  })
  .from(proceduralTasks)
  .where(and(...conditions))
  .orderBy(proceduralTasks.dueDate);
}

export async function getTasksForManager(
  officeId: number,
  startDate?: Date,
  endDate?: Date
): Promise<any[]> {
  const lawyersInOffice = await db.select({ id: users.id, fullName: users.fullName, color: users.color })
    .from(users)
    .where(and(
      eq(users.officeId, officeId),
      eq(users.role, 'LAWYER'),
      eq(users.isActive, true)
    ));
  
  const lawyerIds = lawyersInOffice.map(l => l.id);
  if (lawyerIds.length === 0) return [];
  
  const conditions: any[] = [];
  if (startDate) {
    conditions.push(gte(proceduralTasks.dueDate, startDate));
  }
  if (endDate) {
    conditions.push(lte(proceduralTasks.dueDate, endDate));
  }
  
  const allTasks = await db.select({
    id: proceduralTasks.id,
    lawyerId: proceduralTasks.lawyerId,
    taskType: proceduralTasks.taskType,
    title: proceduralTasks.title,
    dueDate: proceduralTasks.dueDate,
    status: proceduralTasks.status,
    priority: proceduralTasks.priority,
    court: proceduralTasks.court,
    procedureNumber: proceduralTasks.procedureNumber,
  })
  .from(proceduralTasks)
  .where(conditions.length > 0 ? and(...conditions) : undefined)
  .orderBy(proceduralTasks.dueDate);
  
  const lawyerMap = new Map(lawyersInOffice.map(l => [l.id, l]));
  
  return allTasks
    .filter(t => lawyerIds.includes(t.lawyerId))
    .map(t => ({
      ...t,
      lawyer: lawyerMap.get(t.lawyerId)
    }));
}

export async function markTaskCompleted(
  taskId: number,
  userId: number,
  justification?: string
): Promise<boolean> {
  const [updated] = await db.update(proceduralTasks)
    .set({
      status: 'COMPLETED',
      completedAt: new Date(),
      completedBy: userId,
      justification,
      updatedAt: new Date()
    })
    .where(eq(proceduralTasks.id, taskId))
    .returning({ id: proceduralTasks.id });
  
  return !!updated;
}

export async function getOverdueTasks(officeId?: number): Promise<any[]> {
  const now = new Date();
  
  let query = db.select({
    id: proceduralTasks.id,
    lawyerId: proceduralTasks.lawyerId,
    title: proceduralTasks.title,
    dueDate: proceduralTasks.dueDate,
    status: proceduralTasks.status,
    priority: proceduralTasks.priority,
    lawyerName: users.fullName,
    lawyerColor: users.color,
  })
  .from(proceduralTasks)
  .leftJoin(users, eq(proceduralTasks.lawyerId, users.id))
  .where(and(
    lte(proceduralTasks.dueDate, now),
    eq(proceduralTasks.status, 'PENDING')
  ))
  .orderBy(proceduralTasks.dueDate);
  
  return query;
}

export async function getUrgentTasksSummary(officeId: number): Promise<{
  overdue: number;
  dueToday: number;
  dueTomorrow: number;
  dueThisWeek: number;
  byLawyer: Array<{ lawyerId: number; lawyerName: string; color: string; count: number; }>;
}> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const endOfWeek = new Date(today);
  endOfWeek.setDate(endOfWeek.getDate() + 7);
  
  const lawyers = await db.select({ id: users.id, fullName: users.fullName, color: users.color })
    .from(users)
    .where(and(
      eq(users.officeId, officeId),
      eq(users.role, 'LAWYER'),
      eq(users.isActive, true)
    ));
  
  const lawyerIds = lawyers.map(l => l.id);
  if (lawyerIds.length === 0) {
    return { overdue: 0, dueToday: 0, dueTomorrow: 0, dueThisWeek: 0, byLawyer: [] };
  }
  
  const pendingTasks = await db.select({
    id: proceduralTasks.id,
    lawyerId: proceduralTasks.lawyerId,
    dueDate: proceduralTasks.dueDate,
  })
  .from(proceduralTasks)
  .where(and(
    eq(proceduralTasks.status, 'PENDING'),
    lte(proceduralTasks.dueDate, endOfWeek)
  ));
  
  const relevantTasks = pendingTasks.filter(t => lawyerIds.includes(t.lawyerId));
  
  let overdue = 0, dueToday = 0, dueTomorrow = 0, dueThisWeek = 0;
  const countByLawyer: Record<number, number> = {};
  
  for (const task of relevantTasks) {
    const due = new Date(task.dueDate);
    const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
    
    countByLawyer[task.lawyerId] = (countByLawyer[task.lawyerId] || 0) + 1;
    
    if (dueDay < today) {
      overdue++;
    } else if (dueDay.getTime() === today.getTime()) {
      dueToday++;
    } else if (dueDay.getTime() === tomorrow.getTime()) {
      dueTomorrow++;
    } else {
      dueThisWeek++;
    }
  }
  
  const byLawyer = lawyers.map(l => ({
    lawyerId: l.id,
    lawyerName: l.fullName,
    color: l.color || '#3B82F6',
    count: countByLawyer[l.id] || 0
  })).filter(l => l.count > 0);
  
  return { overdue, dueToday, dueTomorrow, dueThisWeek, byLawyer };
}
