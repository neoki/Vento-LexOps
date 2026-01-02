import { db } from './db';
import { documents } from '../shared/schema';
import { eq, and, sql, asc, isNull } from 'drizzle-orm';

export type OCRPriority = 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW';
export type OCRStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';

interface OCRQueueItem {
  id: number;
  documentId: number;
  filename: string;
  fileSizeBytes: number;
  priority: OCRPriority;
  status: OCRStatus;
  reason: string;
  notificationId: number | null;
  createdAt: Date;
  estimatedProcessingTime: number;
}

interface OCRQueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  totalPages: number;
  estimatedTimeMinutes: number;
}

const PAGES_PER_MINUTE = 5;
const AVERAGE_PAGES_PER_MB = 100;

export async function detectImageOnlyPDFs(packageId: number): Promise<number[]> {
  const docs = await db.select()
    .from(documents)
    .where(eq(documents.packageId, packageId));
  
  const imageOnlyDocs: number[] = [];
  
  for (const doc of docs) {
    if (doc.mimeType === 'application/pdf') {
      const needsOCR = checkIfNeedsOCR(doc);
      if (needsOCR) {
        imageOnlyDocs.push(doc.id);
        
        await db.update(documents)
          .set({ requiresOcr: true })
          .where(eq(documents.id, doc.id));
      }
    }
  }
  
  return imageOnlyDocs;
}

function checkIfNeedsOCR(doc: any): boolean {
  if (doc.extractedText && doc.extractedText.length > 100) {
    return false;
  }
  
  if (doc.fileSize && doc.fileSize > 500000) {
    const textRatio = (doc.extractedText?.length || 0) / doc.fileSize;
    if (textRatio < 0.001) {
      return true;
    }
  }
  
  return doc.requiresOcr === true;
}

export async function getOCRQueue(): Promise<OCRQueueItem[]> {
  const docs = await db.select()
    .from(documents)
    .where(and(
      eq(documents.requiresOcr, true),
      isNull(documents.extractedText)
    ))
    .orderBy(asc(documents.createdAt));
  
  return docs.map(doc => ({
    id: doc.id,
    documentId: doc.id,
    filename: doc.originalName || doc.fileName,
    fileSizeBytes: doc.fileSize || 0,
    priority: 'NORMAL' as OCRPriority,
    status: 'PENDING' as OCRStatus,
    reason: 'Documento sin texto extraible',
    notificationId: doc.notificationId,
    createdAt: doc.createdAt,
    estimatedProcessingTime: estimateProcessingTime(doc.fileSize || 0)
  }));
}

export async function getOCRQueueStats(): Promise<OCRQueueStats> {
  const [pending] = await db.select({ count: sql<number>`count(*)` })
    .from(documents)
    .where(and(
      eq(documents.requiresOcr, true),
      isNull(documents.extractedText)
    ));

  const [completed] = await db.select({ count: sql<number>`count(*)` })
    .from(documents)
    .where(and(
      eq(documents.requiresOcr, true),
      sql`${documents.extractedText} IS NOT NULL`
    ));

  const pendingDocs = await db.select({ size: documents.fileSize })
    .from(documents)
    .where(and(
      eq(documents.requiresOcr, true),
      isNull(documents.extractedText)
    ));

  const totalBytes = pendingDocs.reduce((sum, d) => sum + (d.size || 0), 0);
  const estimatedPages = Math.ceil(totalBytes / 1024 / 1024 * AVERAGE_PAGES_PER_MB);
  const estimatedMinutes = Math.ceil(estimatedPages / PAGES_PER_MINUTE);

  return {
    pending: Number(pending?.count || 0),
    processing: 0,
    completed: Number(completed?.count || 0),
    failed: 0,
    totalPages: estimatedPages,
    estimatedTimeMinutes: estimatedMinutes
  };
}

function estimateProcessingTime(fileSizeBytes: number): number {
  const sizeMB = fileSizeBytes / 1024 / 1024;
  const estimatedPages = Math.ceil(sizeMB * AVERAGE_PAGES_PER_MB);
  return Math.ceil(estimatedPages / PAGES_PER_MINUTE);
}

export async function markOCRCompleted(documentId: number, extractedText: string): Promise<void> {
  await db.update(documents)
    .set({ extractedText })
    .where(eq(documents.id, documentId));
}

export async function getNextOCRDocument(): Promise<OCRQueueItem | null> {
  const [doc] = await db.select()
    .from(documents)
    .where(and(
      eq(documents.requiresOcr, true),
      isNull(documents.extractedText)
    ))
    .orderBy(asc(documents.createdAt))
    .limit(1);
  
  if (!doc) return null;

  return {
    id: doc.id,
    documentId: doc.id,
    filename: doc.originalName || doc.fileName,
    fileSizeBytes: doc.fileSize || 0,
    priority: 'NORMAL',
    status: 'PENDING',
    reason: 'Documento sin texto extraible',
    notificationId: doc.notificationId,
    createdAt: doc.createdAt,
    estimatedProcessingTime: estimateProcessingTime(doc.fileSize || 0)
  };
}

export async function addToOCRQueue(documentId: number): Promise<void> {
  await db.update(documents)
    .set({ requiresOcr: true })
    .where(eq(documents.id, documentId));
}

export async function skipOCR(documentId: number): Promise<void> {
  await db.update(documents)
    .set({ requiresOcr: false })
    .where(eq(documents.id, documentId));
}
