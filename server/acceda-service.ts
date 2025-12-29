import { db } from './db';
import { documents, notifications, lexnetPackages } from '../shared/schema';
import { eq, and, gt } from 'drizzle-orm';

const LEXNET_MAX_SIZE_MB = 10;
const LEXNET_MAX_SIZE_BYTES = LEXNET_MAX_SIZE_MB * 1024 * 1024;

export interface AccedaCandidate {
  documentId: number;
  fileName: string;
  originalName: string;
  fileSize: number;
  fileSizeMB: number;
  notificationId: number | null;
  packageId: number | null;
  procedureNumber: string | null;
  court: string | null;
  requiresAcceda: boolean;
  accedaInstructions: string[];
}

export interface AccedaAnalysis {
  totalDocuments: number;
  documentsExceedingLimit: number;
  totalExcessSizeMB: number;
  candidates: AccedaCandidate[];
  recommendation: 'LEXNET' | 'ACCEDA' | 'SPLIT';
  instructions: string[];
}

export async function analyzeForAcceda(packageId: number): Promise<AccedaAnalysis> {
  const docs = await db
    .select({
      document: documents,
      notification: notifications
    })
    .from(documents)
    .leftJoin(notifications, eq(documents.notificationId, notifications.id))
    .where(eq(documents.packageId, packageId));

  const candidates: AccedaCandidate[] = [];
  let totalSize = 0;
  let exceedingCount = 0;
  let totalExcessSize = 0;

  for (const { document, notification } of docs) {
    const fileSize = document.fileSize || 0;
    const fileSizeMB = fileSize / (1024 * 1024);
    totalSize += fileSize;
    
    const requiresAcceda = fileSize > LEXNET_MAX_SIZE_BYTES;
    
    if (requiresAcceda) {
      exceedingCount++;
      totalExcessSize += fileSize - LEXNET_MAX_SIZE_BYTES;
    }

    const instructions: string[] = [];
    if (requiresAcceda) {
      instructions.push(`El archivo "${document.originalName}" supera el límite de ${LEXNET_MAX_SIZE_MB} MB de LexNET.`);
      instructions.push('Este documento debe presentarse a través de ACCEDA-Justicia.');
      instructions.push('Pasos a seguir:');
      instructions.push('1. Presente el escrito principal en LexNET sin este adjunto.');
      instructions.push('2. Obtenga el IdLexNET del envío.');
      instructions.push('3. Inicie solicitud en ACCEDA-Justicia vinculando el IdLexNET.');
      instructions.push('4. Suba el documento voluminoso a ACCEDA.');
      if (fileSizeMB > 50) {
        instructions.push('5. Considere comprimir el documento en formato ZIP si es posible.');
      }
    }

    candidates.push({
      documentId: document.id,
      fileName: document.fileName,
      originalName: document.originalName,
      fileSize,
      fileSizeMB: Math.round(fileSizeMB * 100) / 100,
      notificationId: document.notificationId,
      packageId: document.packageId,
      procedureNumber: notification?.procedureNumber || null,
      court: notification?.court || null,
      requiresAcceda,
      accedaInstructions: instructions
    });
  }

  const totalSizeMB = totalSize / (1024 * 1024);
  let recommendation: 'LEXNET' | 'ACCEDA' | 'SPLIT';
  const instructions: string[] = [];

  if (exceedingCount === 0 && totalSizeMB <= LEXNET_MAX_SIZE_MB) {
    recommendation = 'LEXNET';
    instructions.push('Todos los documentos pueden enviarse por LexNET.');
  } else if (exceedingCount === docs.length) {
    recommendation = 'ACCEDA';
    instructions.push('Todos los documentos superan el límite de LexNET.');
    instructions.push('Debe usar exclusivamente ACCEDA-Justicia para esta presentación.');
    instructions.push('Recuerde que necesita el IdLexNET del escrito principal.');
  } else {
    recommendation = 'SPLIT';
    instructions.push(`${docs.length - exceedingCount} documento(s) pueden enviarse por LexNET.`);
    instructions.push(`${exceedingCount} documento(s) requieren ACCEDA-Justicia.`);
    instructions.push('Procedimiento recomendado:');
    instructions.push('1. Presente el escrito principal con los documentos pequeños en LexNET.');
    instructions.push('2. Obtenga el IdLexNET del envío.');
    instructions.push('3. Para cada documento que excede el límite:');
    instructions.push('   a. Inicie solicitud en ACCEDA-Justicia');
    instructions.push('   b. Vincule el IdLexNET obtenido');
    instructions.push('   c. Suba el documento voluminoso');
  }

  return {
    totalDocuments: docs.length,
    documentsExceedingLimit: exceedingCount,
    totalExcessSizeMB: Math.round((totalExcessSize / (1024 * 1024)) * 100) / 100,
    candidates,
    recommendation,
    instructions
  };
}

export async function checkDocumentForAcceda(documentId: number): Promise<AccedaCandidate | null> {
  const [result] = await db
    .select({
      document: documents,
      notification: notifications
    })
    .from(documents)
    .leftJoin(notifications, eq(documents.notificationId, notifications.id))
    .where(eq(documents.id, documentId))
    .limit(1);

  if (!result) return null;

  const { document, notification } = result;
  const fileSize = document.fileSize || 0;
  const fileSizeMB = fileSize / (1024 * 1024);
  const requiresAcceda = fileSize > LEXNET_MAX_SIZE_BYTES;

  const instructions: string[] = [];
  if (requiresAcceda) {
    instructions.push(`El archivo "${document.originalName}" tiene ${Math.round(fileSizeMB * 10) / 10} MB.`);
    instructions.push(`Supera el límite de ${LEXNET_MAX_SIZE_MB} MB de LexNET.`);
    instructions.push('Debe presentarse a través de ACCEDA-Justicia.');
  }

  return {
    documentId: document.id,
    fileName: document.fileName,
    originalName: document.originalName,
    fileSize,
    fileSizeMB: Math.round(fileSizeMB * 100) / 100,
    notificationId: document.notificationId,
    packageId: document.packageId,
    procedureNumber: notification?.procedureNumber || null,
    court: notification?.court || null,
    requiresAcceda,
    accedaInstructions: instructions
  };
}

export async function getAccedaPendingDocuments(): Promise<AccedaCandidate[]> {
  const largeDocs = await db
    .select({
      document: documents,
      notification: notifications
    })
    .from(documents)
    .leftJoin(notifications, eq(documents.notificationId, notifications.id))
    .where(gt(documents.fileSize, LEXNET_MAX_SIZE_BYTES));

  return largeDocs.map(({ document, notification }) => {
    const fileSize = document.fileSize || 0;
    const fileSizeMB = fileSize / (1024 * 1024);

    return {
      documentId: document.id,
      fileName: document.fileName,
      originalName: document.originalName,
      fileSize,
      fileSizeMB: Math.round(fileSizeMB * 100) / 100,
      notificationId: document.notificationId,
      packageId: document.packageId,
      procedureNumber: notification?.procedureNumber || null,
      court: notification?.court || null,
      requiresAcceda: true,
      accedaInstructions: [
        `Documento de ${Math.round(fileSizeMB * 10) / 10} MB requiere ACCEDA-Justicia.`
      ]
    };
  });
}

export function generateAccedaReport(analysis: AccedaAnalysis): string {
  let report = '═══════════════════════════════════════════════════════════════\n';
  report += '                    INFORME ACCEDA-JUSTICIA\n';
  report += '═══════════════════════════════════════════════════════════════\n\n';

  report += `Documentos analizados: ${analysis.totalDocuments}\n`;
  report += `Documentos que exceden límite: ${analysis.documentsExceedingLimit}\n`;
  report += `Exceso total: ${analysis.totalExcessSizeMB} MB\n`;
  report += `Recomendación: ${analysis.recommendation}\n\n`;

  report += '───────────────────────────────────────────────────────────────\n';
  report += 'INSTRUCCIONES\n';
  report += '───────────────────────────────────────────────────────────────\n';
  
  analysis.instructions.forEach(inst => {
    report += `  ${inst}\n`;
  });

  if (analysis.documentsExceedingLimit > 0) {
    report += '\n───────────────────────────────────────────────────────────────\n';
    report += 'DOCUMENTOS QUE REQUIEREN ACCEDA\n';
    report += '───────────────────────────────────────────────────────────────\n';
    
    analysis.candidates
      .filter(c => c.requiresAcceda)
      .forEach(doc => {
        report += `\n  • ${doc.originalName}\n`;
        report += `    Tamaño: ${doc.fileSizeMB} MB\n`;
        if (doc.procedureNumber) {
          report += `    Procedimiento: ${doc.procedureNumber}\n`;
        }
      });
  }

  report += '\n═══════════════════════════════════════════════════════════════\n';
  report += `Generado: ${new Date().toLocaleString('es-ES')}\n`;

  return report;
}
