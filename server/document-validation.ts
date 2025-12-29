import { db } from './db';
import { documents, notifications } from '../shared/schema';
import { eq, and, isNull, isNotNull, sql } from 'drizzle-orm';
import crypto from 'crypto';

export interface DocumentValidation {
  documentId: number;
  fileName: string;
  originalName: string;
  mimeType: string | null;
  fileSize: number;
  issues: ValidationIssue[];
  isValid: boolean;
  requiresAction: boolean;
}

export interface ValidationIssue {
  type: 'NO_OCR' | 'NOT_PDF_A' | 'EMPTY_FILE' | 'CORRUPT' | 'DUPLICATE' | 'MISSING_TEXT' | 'IMAGE_ONLY';
  severity: 'warning' | 'error' | 'info';
  message: string;
  recommendation: string;
}

export interface DuplicateGroup {
  hash: string;
  documents: Array<{
    id: number;
    fileName: string;
    originalName: string;
    packageId: number | null;
    notificationId: number | null;
    createdAt: Date;
  }>;
  recommendation: string;
}

export interface PackageValidationResult {
  packageId: number;
  totalDocuments: number;
  validDocuments: number;
  documentsWithIssues: number;
  documentsRequiringOcr: number;
  duplicatesFound: number;
  validations: DocumentValidation[];
  duplicateGroups: DuplicateGroup[];
  overallStatus: 'OK' | 'NEEDS_ATTENTION' | 'CRITICAL';
}

export async function validateDocument(documentId: number): Promise<DocumentValidation> {
  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1);

  if (!doc) {
    throw new Error('Documento no encontrado');
  }

  const issues: ValidationIssue[] = [];

  if (!doc.fileSize || doc.fileSize === 0) {
    issues.push({
      type: 'EMPTY_FILE',
      severity: 'error',
      message: 'El archivo está vacío o no tiene contenido.',
      recommendation: 'Vuelva a descargar el documento desde LexNET.'
    });
  }

  if (doc.requiresOcr === true) {
    issues.push({
      type: 'NO_OCR',
      severity: 'warning',
      message: 'El documento no tiene capa de texto OCR.',
      recommendation: 'Aplique reconocimiento OCR para extraer el NIG y nombres de las partes.'
    });
  }

  if (doc.mimeType === 'application/pdf' && !doc.extractedText) {
    issues.push({
      type: 'MISSING_TEXT',
      severity: 'warning',
      message: 'No se pudo extraer texto del PDF.',
      recommendation: 'El documento puede ser una imagen escaneada. Considere aplicar OCR.'
    });
  }

  if (doc.mimeType?.startsWith('image/')) {
    issues.push({
      type: 'IMAGE_ONLY',
      severity: 'info',
      message: 'El documento es una imagen, no un PDF.',
      recommendation: 'Las imágenes no son el formato estándar de LexNET. Verifique que es correcto.'
    });
  }

  const isPrimary = doc.isPrimary;
  if (isPrimary && doc.mimeType !== 'application/pdf') {
    issues.push({
      type: 'NOT_PDF_A',
      severity: 'warning',
      message: 'El documento principal no es un PDF.',
      recommendation: 'Los documentos principales de LexNET deben ser PDF/A con texto buscable.'
    });
  }

  if (doc.fileHash) {
    const duplicates = await db
      .select()
      .from(documents)
      .where(and(
        eq(documents.fileHash, doc.fileHash),
        sql`${documents.id} != ${documentId}`
      ));

    if (duplicates.length > 0) {
      issues.push({
        type: 'DUPLICATE',
        severity: 'warning',
        message: `Este documento es idéntico a ${duplicates.length} otro(s) documento(s).`,
        recommendation: 'Revise si es un duplicado accidental o intencional.'
      });
    }
  }

  const isValid = issues.filter(i => i.severity === 'error').length === 0;
  const requiresAction = issues.filter(i => i.severity !== 'info').length > 0;

  return {
    documentId: doc.id,
    fileName: doc.fileName,
    originalName: doc.originalName,
    mimeType: doc.mimeType,
    fileSize: doc.fileSize || 0,
    issues,
    isValid,
    requiresAction
  };
}

export async function validatePackage(packageId: number): Promise<PackageValidationResult> {
  const docs = await db
    .select()
    .from(documents)
    .where(eq(documents.packageId, packageId));

  const validations: DocumentValidation[] = [];
  let validCount = 0;
  let issueCount = 0;
  let ocrCount = 0;

  for (const doc of docs) {
    const validation = await validateDocument(doc.id);
    validations.push(validation);

    if (validation.isValid) {
      validCount++;
    }
    if (validation.requiresAction) {
      issueCount++;
    }
    if (validation.issues.some(i => i.type === 'NO_OCR' || i.type === 'MISSING_TEXT')) {
      ocrCount++;
    }
  }

  const duplicateGroups = await findDuplicatesInPackage(packageId);

  let overallStatus: 'OK' | 'NEEDS_ATTENTION' | 'CRITICAL';
  if (validCount === docs.length && duplicateGroups.length === 0) {
    overallStatus = 'OK';
  } else if (validations.some(v => v.issues.some(i => i.severity === 'error'))) {
    overallStatus = 'CRITICAL';
  } else {
    overallStatus = 'NEEDS_ATTENTION';
  }

  return {
    packageId,
    totalDocuments: docs.length,
    validDocuments: validCount,
    documentsWithIssues: issueCount,
    documentsRequiringOcr: ocrCount,
    duplicatesFound: duplicateGroups.reduce((sum, g) => sum + g.documents.length - 1, 0),
    validations,
    duplicateGroups,
    overallStatus
  };
}

export async function findDuplicatesInPackage(packageId: number): Promise<DuplicateGroup[]> {
  const docs = await db
    .select()
    .from(documents)
    .where(and(
      eq(documents.packageId, packageId),
      isNotNull(documents.fileHash)
    ));

  const hashGroups = new Map<string, typeof docs>();

  for (const doc of docs) {
    if (!doc.fileHash) continue;
    
    const existing = hashGroups.get(doc.fileHash) || [];
    existing.push(doc);
    hashGroups.set(doc.fileHash, existing);
  }

  const duplicateGroups: DuplicateGroup[] = [];

  for (const [hash, groupDocs] of hashGroups) {
    if (groupDocs.length > 1) {
      duplicateGroups.push({
        hash,
        documents: groupDocs.map(d => ({
          id: d.id,
          fileName: d.fileName,
          originalName: d.originalName,
          packageId: d.packageId,
          notificationId: d.notificationId,
          createdAt: d.createdAt
        })),
        recommendation: `Se encontraron ${groupDocs.length} documentos idénticos. Considere eliminar los duplicados antes de la presentación.`
      });
    }
  }

  return duplicateGroups;
}

export async function findAllDuplicates(): Promise<DuplicateGroup[]> {
  const docsWithHash = await db
    .select()
    .from(documents)
    .where(isNotNull(documents.fileHash));

  const hashGroups = new Map<string, typeof docsWithHash>();

  for (const doc of docsWithHash) {
    if (!doc.fileHash) continue;
    
    const existing = hashGroups.get(doc.fileHash) || [];
    existing.push(doc);
    hashGroups.set(doc.fileHash, existing);
  }

  const duplicateGroups: DuplicateGroup[] = [];

  for (const [hash, groupDocs] of hashGroups) {
    if (groupDocs.length > 1) {
      duplicateGroups.push({
        hash,
        documents: groupDocs.map(d => ({
          id: d.id,
          fileName: d.fileName,
          originalName: d.originalName,
          packageId: d.packageId,
          notificationId: d.notificationId,
          createdAt: d.createdAt
        })),
        recommendation: `${groupDocs.length} documentos idénticos encontrados en diferentes paquetes/notificaciones.`
      });
    }
  }

  return duplicateGroups;
}

export async function getDocumentsNeedingOcr(): Promise<Array<{
  id: number;
  fileName: string;
  originalName: string;
  notificationId: number | null;
  procedureNumber: string | null;
}>> {
  const docs = await db
    .select({
      document: documents,
      notification: notifications
    })
    .from(documents)
    .leftJoin(notifications, eq(documents.notificationId, notifications.id))
    .where(eq(documents.requiresOcr, true));

  return docs.map(({ document, notification }) => ({
    id: document.id,
    fileName: document.fileName,
    originalName: document.originalName,
    notificationId: document.notificationId,
    procedureNumber: notification?.procedureNumber || null
  }));
}

export function generateValidationReport(result: PackageValidationResult): string {
  let report = '═══════════════════════════════════════════════════════════════\n';
  report += '              INFORME DE VALIDACIÓN DOCUMENTAL\n';
  report += '═══════════════════════════════════════════════════════════════\n\n';

  report += `Paquete ID: ${result.packageId}\n`;
  report += `Estado general: ${result.overallStatus}\n\n`;

  report += '───────────────────────────────────────────────────────────────\n';
  report += 'RESUMEN\n';
  report += '───────────────────────────────────────────────────────────────\n';
  report += `  Total documentos: ${result.totalDocuments}\n`;
  report += `  Documentos válidos: ${result.validDocuments}\n`;
  report += `  Documentos con incidencias: ${result.documentsWithIssues}\n`;
  report += `  Documentos que requieren OCR: ${result.documentsRequiringOcr}\n`;
  report += `  Duplicados encontrados: ${result.duplicatesFound}\n\n`;

  if (result.validations.some(v => v.issues.length > 0)) {
    report += '───────────────────────────────────────────────────────────────\n';
    report += 'INCIDENCIAS DETECTADAS\n';
    report += '───────────────────────────────────────────────────────────────\n';

    for (const validation of result.validations) {
      if (validation.issues.length > 0) {
        report += `\n  ${validation.originalName}\n`;
        for (const issue of validation.issues) {
          const icon = issue.severity === 'error' ? '!' : issue.severity === 'warning' ? '?' : 'i';
          report += `    [${icon}] ${issue.message}\n`;
          report += `        → ${issue.recommendation}\n`;
        }
      }
    }
  }

  if (result.duplicateGroups.length > 0) {
    report += '\n───────────────────────────────────────────────────────────────\n';
    report += 'DOCUMENTOS DUPLICADOS\n';
    report += '───────────────────────────────────────────────────────────────\n';

    for (const group of result.duplicateGroups) {
      report += `\n  Grupo (hash: ${group.hash.substring(0, 8)}...):\n`;
      for (const doc of group.documents) {
        report += `    • ${doc.originalName}\n`;
      }
      report += `  → ${group.recommendation}\n`;
    }
  }

  report += '\n═══════════════════════════════════════════════════════════════\n';
  report += `Generado: ${new Date().toLocaleString('es-ES')}\n`;

  return report;
}
