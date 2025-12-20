import { db } from './db';
import { 
  executionPlans, 
  executionActions, 
  notifications,
  users,
  holidays,
  deadlineRules,
  emailTemplates,
  eventTemplates,
  categories
} from '../shared/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import { AIAnalysisResult } from './ai-service';

export type ActionType = 
  | 'UPLOAD_INVENTO' 
  | 'CREATE_NOTE' 
  | 'CREATE_EVENT' 
  | 'SEND_EMAIL_LAWYER' 
  | 'SEND_EMAIL_CLIENT' 
  | 'REQUEST_POWER' 
  | 'DOWNLOAD_LINK' 
  | 'DETECT_COLLISION';

export interface ActionConfig {
  type: ActionType;
  title: string;
  description: string;
  config: Record<string, any>;
  previewData: Record<string, any>;
}

export interface ExecutionPlanProposal {
  notificationId: number;
  inventoConfig: {
    caseId?: string;
    instance?: string;
    folder?: string;
    documents: Array<{
      originalName: string;
      renamedName: string;
      include: boolean;
    }>;
    notes?: string;
  };
  outlookConfig: {
    events: Array<{
      type: 'deadline' | 'hearing' | 'derived';
      title: string;
      date: Date;
      isAllDay: boolean;
      location?: string;
      categoryName?: string;
      derivedFrom?: string;
    }>;
  };
  emailConfig: {
    lawyerEmail?: {
      to: string[];
      cc: string[];
      subject: string;
      body: string;
      attachments: string[];
    };
    clientEmail?: {
      to: string[];
      cc: string[];
      subject: string;
      body: string;
      attachments: string[];
    };
  };
  actions: ActionConfig[];
}

export async function generateExecutionPlan(
  notificationId: number,
  aiAnalysis: AIAnalysisResult,
  documentsInfo: Array<{ fileName: string; originalName: string; filePath: string }>
): Promise<ExecutionPlanProposal> {
  const [notification] = await db
    .select()
    .from(notifications)
    .where(eq(notifications.id, notificationId))
    .limit(1);

  if (!notification) {
    throw new Error('Notification not found');
  }

  const actions: ActionConfig[] = [];
  let actionOrder = 1;

  const documentRenames = documentsInfo.map((doc, index) => ({
    originalName: doc.originalName,
    renamedName: generateDocumentName(index + 1, aiAnalysis.docType || 'DOCUMENTO', doc.originalName),
    include: true
  }));

  actions.push({
    type: 'UPLOAD_INVENTO',
    title: 'Subir documentos a Invento',
    description: `Subir ${documentsInfo.length} documento(s) al expediente`,
    config: {
      caseId: aiAnalysis.suggestedCaseId,
      documents: documentRenames
    },
    previewData: {
      documentCount: documentsInfo.length,
      suggestedCase: aiAnalysis.suggestedCaseId
    }
  });

  if (aiAnalysis.actType === 'SEÑALAMIENTO' || aiAnalysis.dates?.hearing) {
    const noteText = aiAnalysis.dates?.hearing 
      ? `JUICIO: ${formatDate(aiAnalysis.dates.hearing)}`
      : 'SEÑALAMIENTO pendiente de fecha';
    
    actions.push({
      type: 'CREATE_NOTE',
      title: 'Crear nota en Invento',
      description: noteText,
      config: { noteText },
      previewData: { noteText }
    });
  }

  const events = await generateCalendarEvents(aiAnalysis, notification);
  
  for (const event of events) {
    actions.push({
      type: 'CREATE_EVENT',
      title: `Crear evento: ${event.title}`,
      description: `${event.isAllDay ? 'Todo el día' : formatDate(event.date)} - ${event.type}`,
      config: event,
      previewData: event
    });
  }

  if (notification.assignedLawyerId) {
    const [lawyer] = await db
      .select()
      .from(users)
      .where(eq(users.id, notification.assignedLawyerId))
      .limit(1);

    if (lawyer) {
      actions.push({
        type: 'SEND_EMAIL_LAWYER',
        title: 'Enviar email al letrado',
        description: `Resumen de notificación a ${lawyer.email}`,
        config: {
          to: [lawyer.email],
          subject: `Nueva notificación: ${aiAnalysis.court} - ${aiAnalysis.procedureNumber}`,
          attachZip: true
        },
        previewData: {
          recipient: lawyer.fullName,
          email: lawyer.email
        }
      });
    }
  }

  if (aiAnalysis.actType === 'SEÑALAMIENTO' || aiAnalysis.actType === 'CITACION') {
    actions.push({
      type: 'SEND_EMAIL_CLIENT',
      title: 'Enviar citación al cliente',
      description: 'Email con citación y fecha del juicio',
      config: {
        subject: `Citación para juicio - ${aiAnalysis.procedureNumber}`,
        attachCitation: true
      },
      previewData: {
        actType: aiAnalysis.actType
      }
    });
  }

  const plan: ExecutionPlanProposal = {
    notificationId,
    inventoConfig: {
      caseId: aiAnalysis.suggestedCaseId,
      documents: documentRenames
    },
    outlookConfig: {
      events
    },
    emailConfig: {},
    actions
  };

  return plan;
}

export async function saveExecutionPlan(
  proposal: ExecutionPlanProposal,
  proposedBy: string = 'AI'
): Promise<number> {
  const [plan] = await db.insert(executionPlans).values({
    notificationId: proposal.notificationId,
    status: 'PROPOSED',
    proposedBy,
    proposedAt: new Date(),
    inventoConfig: proposal.inventoConfig,
    outlookConfig: proposal.outlookConfig,
    emailConfig: proposal.emailConfig
  }).returning();

  for (let i = 0; i < proposal.actions.length; i++) {
    const action = proposal.actions[i];
    await db.insert(executionActions).values({
      planId: plan.id,
      actionType: action.type,
      actionOrder: i + 1,
      status: 'PROPOSED',
      title: action.title,
      description: action.description,
      config: action.config,
      previewData: action.previewData
    });
  }

  return plan.id;
}

export async function getPlanWithActions(planId: number) {
  const [plan] = await db
    .select()
    .from(executionPlans)
    .where(eq(executionPlans.id, planId))
    .limit(1);

  if (!plan) return null;

  const actions = await db
    .select()
    .from(executionActions)
    .where(eq(executionActions.planId, planId))
    .orderBy(executionActions.actionOrder);

  return { ...plan, actions };
}

export async function approvePlan(
  planId: number,
  userId: number
): Promise<void> {
  await db
    .update(executionPlans)
    .set({
      status: 'APPROVED',
      approvedBy: userId,
      approvedAt: new Date(),
      updatedAt: new Date()
    })
    .where(eq(executionPlans.id, planId));
}

export async function approveAction(
  actionId: number,
  userId: number
): Promise<void> {
  await db
    .update(executionActions)
    .set({
      status: 'APPROVED',
      approvedBy: userId,
      approvedAt: new Date()
    })
    .where(eq(executionActions.id, actionId));
}

export async function cancelPlan(
  planId: number,
  userId: number,
  reason: string
): Promise<void> {
  await db
    .update(executionPlans)
    .set({
      status: 'CANCELLED',
      cancelledBy: userId,
      cancelledAt: new Date(),
      cancellationReason: reason,
      updatedAt: new Date()
    })
    .where(eq(executionPlans.id, planId));
}

export async function executePlan(planId: number): Promise<void> {
  const plan = await getPlanWithActions(planId);
  
  if (!plan || plan.status !== 'APPROVED') {
    throw new Error('Plan not found or not approved');
  }

  await db
    .update(executionPlans)
    .set({ status: 'IN_REVIEW', updatedAt: new Date() })
    .where(eq(executionPlans.id, planId));

  try {
    for (const action of plan.actions) {
      if (action.status !== 'APPROVED' && action.status !== 'PENDING') {
        continue;
      }

      try {
        await executeAction(action);
        
        await db
          .update(executionActions)
          .set({
            status: 'EXECUTED',
            executedAt: new Date(),
            executionResult: { success: true }
          })
          .where(eq(executionActions.id, action.id));
      } catch (error) {
        await db
          .update(executionActions)
          .set({
            status: 'FAILED',
            errorMessage: error instanceof Error ? error.message : 'Unknown error'
          })
          .where(eq(executionActions.id, action.id));
      }
    }

    await db
      .update(executionPlans)
      .set({
        status: 'EXECUTED',
        executedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(executionPlans.id, planId));
  } catch (error) {
    await db
      .update(executionPlans)
      .set({
        status: 'ERROR',
        updatedAt: new Date()
      })
      .where(eq(executionPlans.id, planId));
    throw error;
  }
}

async function executeAction(action: any): Promise<void> {
  switch (action.actionType) {
    case 'UPLOAD_INVENTO':
      console.log('Ejecutando: Subir a Invento', action.config);
      break;
    case 'CREATE_NOTE':
      console.log('Ejecutando: Crear nota', action.config);
      break;
    case 'CREATE_EVENT':
      console.log('Ejecutando: Crear evento', action.config);
      break;
    case 'SEND_EMAIL_LAWYER':
      console.log('Ejecutando: Enviar email a letrado', action.config);
      break;
    case 'SEND_EMAIL_CLIENT':
      console.log('Ejecutando: Enviar email a cliente', action.config);
      break;
    default:
      console.log('Acción no implementada:', action.actionType);
  }
}

async function generateCalendarEvents(
  analysis: AIAnalysisResult,
  notification: any
): Promise<Array<{
  type: 'deadline' | 'hearing' | 'derived';
  title: string;
  date: Date;
  isAllDay: boolean;
  location?: string;
  derivedFrom?: string;
}>> {
  const events: Array<{
    type: 'deadline' | 'hearing' | 'derived';
    title: string;
    date: Date;
    isAllDay: boolean;
    location?: string;
    derivedFrom?: string;
  }> = [];

  if (analysis.dates?.hearing) {
    const hearingDate = new Date(analysis.dates.hearing);
    events.push({
      type: 'hearing',
      title: `Juicio ${analysis.parties?.client || ''} vs ${analysis.parties?.opponent || ''} ${analysis.procedureType || ''} ${analysis.procedureNumber || ''}`,
      date: hearingDate,
      isAllDay: false,
      location: analysis.court
    });

    const fifteenDaysBefore = new Date(hearingDate);
    fifteenDaysBefore.setDate(fifteenDaysBefore.getDate() - 15);
    events.push({
      type: 'derived',
      title: `Fin plazo 15D pedir y aportar prueba - ${analysis.procedureNumber}`,
      date: fifteenDaysBefore,
      isAllDay: true,
      derivedFrom: 'hearing'
    });

    const oneMonthBefore = new Date(hearingDate);
    oneMonthBefore.setMonth(oneMonthBefore.getMonth() - 1);
    events.push({
      type: 'derived',
      title: `Reunión cliente - ${analysis.procedureNumber}`,
      date: oneMonthBefore,
      isAllDay: true,
      derivedFrom: 'hearing'
    });

    const sixWeeksBefore = new Date(hearingDate);
    sixWeeksBefore.setDate(sixWeeksBefore.getDate() - 45);
    events.push({
      type: 'derived',
      title: `Preparación juicio + expediente físico - ${analysis.procedureNumber}`,
      date: sixWeeksBefore,
      isAllDay: true,
      derivedFrom: 'hearing'
    });
  }

  if (analysis.deadlines && analysis.deadlines.length > 0) {
    for (const deadline of analysis.deadlines) {
      const deadlineDate = await calculateDeadlineDate(
        new Date(),
        deadline.days,
        deadline.type === 'HABIL'
      );

      events.push({
        type: 'deadline',
        title: `TERMINA PLAZO ${deadline.days}D ${deadline.description} - ${analysis.procedureNumber}`,
        date: deadlineDate,
        isAllDay: true
      });
    }
  }

  return events;
}

async function calculateDeadlineDate(
  startDate: Date,
  days: number,
  businessDaysOnly: boolean
): Promise<Date> {
  const result = new Date(startDate);
  result.setDate(result.getDate() + 1);

  if (!businessDaysOnly) {
    result.setDate(result.getDate() + days);
    return result;
  }

  let countedDays = 0;
  while (countedDays < days) {
    result.setDate(result.getDate() + 1);
    
    const dayOfWeek = result.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;
    
    const month = result.getMonth();
    if (month === 7) continue;
    
    countedDays++;
  }

  return result;
}

function generateDocumentName(
  sequenceNumber: number,
  docType: string,
  originalName: string
): string {
  const seq = String(sequenceNumber).padStart(2, '0');
  const ext = originalName.split('.').pop() || 'pdf';
  const sanitizedType = docType.toUpperCase().replace(/[^A-Z0-9\s]/g, '');
  return `${seq} ${sanitizedType}.${ext}`;
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
