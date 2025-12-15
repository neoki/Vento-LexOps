import AdmZip from 'adm-zip';
import path from 'path';
import fs from 'fs';
import { db } from './db';
import { lexnetPackages, documents, users } from '../shared/schema';
import { eq } from 'drizzle-orm';
import * as storage from './storage-service';
import { analyzeDocument, AIAnalysisResult } from './ai-service';

export interface ExtractedDocument {
  fileName: string;
  originalName: string;
  filePath: string;
  fileHash: string;
  fileSize: number;
  mimeType: string;
  isPrimary: boolean;
  isReceipt: boolean;
  extractedText?: string;
  requiresOcr: boolean;
}

export interface PackageAnalysisResult {
  packageId: string;
  documents: ExtractedDocument[];
  notifications: Array<{
    lexnetId: string;
    court: string;
    procedureNumber: string;
    procedureType?: string;
    actType?: string;
    parties?: { client?: string; opponent?: string };
    dates?: { hearing?: Date; deadline?: Date };
    deadlines?: Array<{ days: number; type: string; description: string }>;
    confidence: number;
    evidences: string[];
  }>;
}

export async function processPackage(
  packageId: number,
  userId: number
): Promise<PackageAnalysisResult | null> {
  const [pkg] = await db
    .select()
    .from(lexnetPackages)
    .where(eq(lexnetPackages.id, packageId))
    .limit(1);

  if (!pkg || !pkg.zipPath) {
    throw new Error('Package not found or has no ZIP file');
  }

  await db
    .update(lexnetPackages)
    .set({ status: 'READY_FOR_ANALYSIS', updatedAt: new Date() })
    .where(eq(lexnetPackages.id, packageId));

  try {
    const extractedPath = storage.getExtractedPath(pkg.packageId);
    const extractedDocs = await extractZipContents(pkg.zipPath, extractedPath, packageId);
    
    const analysisResults: PackageAnalysisResult = {
      packageId: pkg.packageId,
      documents: extractedDocs,
      notifications: []
    };

    const primaryDoc = extractedDocs.find(d => d.isPrimary);
    if (primaryDoc && primaryDoc.extractedText) {
      try {
        const aiAnalysis: AIAnalysisResult = await analyzeDocument(primaryDoc.extractedText, userId);
        
        if (aiAnalysis) {
          analysisResults.notifications.push({
            lexnetId: pkg.packageId,
            court: aiAnalysis.court || 'Sin determinar',
            procedureNumber: aiAnalysis.procedureNumber || 'Sin número',
            procedureType: aiAnalysis.procedureType,
            actType: aiAnalysis.actType,
            parties: aiAnalysis.parties,
            dates: aiAnalysis.dates,
            deadlines: aiAnalysis.deadlines,
            confidence: aiAnalysis.confidence || 50,
            evidences: aiAnalysis.evidences || []
          });
        }
      } catch (error) {
        console.error('AI analysis error:', error);
      }
    }

    await db
      .update(lexnetPackages)
      .set({ 
        status: 'ANALYZED',
        extractedPath,
        updatedAt: new Date() 
      })
      .where(eq(lexnetPackages.id, packageId));

    return analysisResults;
  } catch (error) {
    await db
      .update(lexnetPackages)
      .set({ 
        status: 'ERROR',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        updatedAt: new Date() 
      })
      .where(eq(lexnetPackages.id, packageId));

    throw error;
  }
}

async function extractZipContents(
  zipPath: string,
  extractPath: string,
  packageId: number
): Promise<ExtractedDocument[]> {
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();
  const extractedDocs: ExtractedDocument[] = [];

  let sequenceNumber = 1;
  let primaryDocIndex = -1;
  let primaryDocSize = 0;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (entry.isDirectory) continue;

    const originalName = entry.entryName;
    const buffer = entry.getData();
    const fileName = path.basename(originalName);
    const ext = path.extname(fileName).toLowerCase();

    const { filePath, fileHash, fileSize } = await storage.saveFile(
      buffer,
      fileName,
      extractPath
    );

    const mimeType = storage.getMimeType(fileName);
    const isPdf = ext === '.pdf';
    const isReceipt = fileName.toLowerCase().includes('justificante') || 
                      fileName.toLowerCase().includes('acuse') ||
                      fileName.toLowerCase().includes('receipt');

    let extractedText: string | undefined;
    let requiresOcr = false;

    if (isPdf) {
      try {
        extractedText = await extractTextFromPdf(filePath);
        if (!extractedText || extractedText.trim().length < 50) {
          requiresOcr = true;
          extractedText = '[Documento requiere OCR para extracción de texto]';
        }
      } catch (error) {
        requiresOcr = true;
        extractedText = '[Error extrayendo texto del PDF]';
      }
    }

    if (isPdf && !isReceipt && fileSize > primaryDocSize) {
      primaryDocIndex = extractedDocs.length;
      primaryDocSize = fileSize;
    }

    const doc: ExtractedDocument = {
      fileName,
      originalName,
      filePath,
      fileHash,
      fileSize,
      mimeType,
      isPrimary: false,
      isReceipt,
      extractedText,
      requiresOcr
    };

    extractedDocs.push(doc);

    await db.insert(documents).values({
      packageId,
      fileName,
      originalName,
      filePath,
      fileHash,
      fileSize,
      mimeType,
      isPrimary: false,
      isReceipt,
      extractedText,
      requiresOcr,
      sequenceNumber: sequenceNumber++
    });
  }

  if (primaryDocIndex >= 0) {
    extractedDocs[primaryDocIndex].isPrimary = true;
    
    await db
      .update(documents)
      .set({ isPrimary: true })
      .where(eq(documents.filePath, extractedDocs[primaryDocIndex].filePath));
  }

  return extractedDocs;
}

async function extractTextFromPdf(filePath: string): Promise<string> {
  return `[Texto del PDF extraído de: ${path.basename(filePath)}]`;
}

export async function createPackageFromUpload(
  lawyerId: number,
  zipBuffer: Buffer,
  receiptBuffer?: Buffer,
  lexnetIds?: string[]
): Promise<number> {
  const [lawyer] = await db
    .select()
    .from(users)
    .where(eq(users.id, lawyerId))
    .limit(1);

  if (!lawyer) {
    throw new Error('Lawyer not found');
  }

  const packageId = `PKG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const { zipPath, zipHash } = await storage.savePackageZip(
    zipBuffer,
    lawyer.username,
    packageId
  );

  let receiptPath: string | undefined;
  let receiptHash: string | undefined;
  let hasReceipt = false;

  if (receiptBuffer) {
    const receipt = await storage.saveReceipt(
      receiptBuffer,
      lawyer.username,
      packageId
    );
    receiptPath = receipt.receiptPath;
    receiptHash = receipt.receiptHash;
    hasReceipt = true;
  }

  const [newPackage] = await db.insert(lexnetPackages).values({
    packageId,
    lawyerId,
    lexnetIds: lexnetIds || [],
    downloadDate: new Date(),
    status: hasReceipt ? 'READY_FOR_ANALYSIS' : 'INCOMPLETE',
    zipPath,
    zipHash,
    receiptPath,
    receiptHash,
    hasReceipt
  }).returning();

  return newPackage.id;
}

export async function createPackageFromUploadPath(
  lawyerId: number,
  zipFilePath: string,
  receiptFilePath?: string,
  lexnetIds?: string[]
): Promise<number> {
  const [lawyer] = await db
    .select()
    .from(users)
    .where(eq(users.id, lawyerId))
    .limit(1);

  if (!lawyer) {
    throw new Error('Lawyer not found');
  }

  const zipBuffer = fs.readFileSync(zipFilePath);
  const receiptBuffer = receiptFilePath ? fs.readFileSync(receiptFilePath) : undefined;

  const packageId = `PKG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const { zipPath, zipHash } = await storage.savePackageZip(
    zipBuffer,
    lawyer.username,
    packageId
  );

  let receiptPath: string | undefined;
  let receiptHash: string | undefined;
  let hasReceipt = false;

  if (receiptBuffer) {
    const receipt = await storage.saveReceipt(
      receiptBuffer,
      lawyer.username,
      packageId
    );
    receiptPath = receipt.receiptPath;
    receiptHash = receipt.receiptHash;
    hasReceipt = true;
  }

  const [newPackage] = await db.insert(lexnetPackages).values({
    packageId,
    lawyerId,
    lexnetIds: lexnetIds || [],
    downloadDate: new Date(),
    status: hasReceipt ? 'READY_FOR_ANALYSIS' : 'INCOMPLETE',
    zipPath,
    zipHash,
    receiptPath,
    receiptHash,
    hasReceipt
  }).returning();

  fs.unlinkSync(zipFilePath);
  if (receiptFilePath) {
    fs.unlinkSync(receiptFilePath);
  }

  return newPackage.id;
}
