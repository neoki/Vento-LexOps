import AdmZip from 'adm-zip';
import path from 'path';
import fs from 'fs';
import { db } from './db';
import { lexnetPackages, documents, users, notifications } from '../shared/schema';
import { eq, and } from 'drizzle-orm';
import * as storage from './storage-service';
import { analyzeDocument, AIAnalysisResult } from './ai-service';
import { generateExecutionPlan, saveExecutionPlan } from './execution-plan-service';

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
  groupKey?: string;
}

function extractGroupKey(fileName: string): string {
  const baseName = path.basename(fileName);
  const parts = baseName.split('_');
  if (parts.length >= 4) {
    const lastPart = parts[parts.length - 1];
    const secondLastPart = parts[parts.length - 2];
    if (lastPart.match(/^\d{3}/) || lastPart.includes('DATOS ESTRUCTURADOS')) {
      parts.pop();
      if (secondLastPart.match(/^\d+$/)) {
        parts.pop();
      }
    }
  }
  return parts.join('_').replace(/\.\w+$/, '');
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
  console.log(`[Processor] Starting package ${packageId}`);
  
  const [pkg] = await db
    .select()
    .from(lexnetPackages)
    .where(eq(lexnetPackages.id, packageId))
    .limit(1);

  if (!pkg || !pkg.zipPath) {
    throw new Error('Package not found or has no ZIP file');
  }

  console.log(`[Processor] Found package ${pkg.packageId}, ZIP: ${pkg.zipPath}`);

  await db
    .update(lexnetPackages)
    .set({ status: 'READY_FOR_ANALYSIS', updatedAt: new Date() })
    .where(eq(lexnetPackages.id, packageId));

  try {
    const extractedPath = storage.getExtractedPath(pkg.packageId);
    console.log(`[Processor] Extracting to ${extractedPath}`);
    
    const { docs: extractedDocs, xmlData } = await extractZipContents(pkg.zipPath, extractedPath, packageId);
    console.log(`[Processor] Extracted ${extractedDocs.length} documents, ${xmlData.length} XML records`);
    
    const analysisResults: PackageAnalysisResult = {
      packageId: pkg.packageId,
      documents: extractedDocs,
      notifications: []
    };

    if (xmlData.length > 0) {
      console.log(`[Processor] Creating notifications from ${xmlData.length} XML records`);
      
      for (const xml of xmlData) {
        let detectedDocType = xml.docType;
        if (!detectedDocType) {
          const primaryDoc = extractedDocs.find(d => d.isPrimary && !d.isReceipt);
          if (primaryDoc) {
            detectedDocType = detectDocTypeFromFileName(primaryDoc.fileName);
          }
          if (!detectedDocType) {
            const anyPdf = extractedDocs.find(d => d.mimeType === 'application/pdf' && !d.isReceipt);
            if (anyPdf) {
              detectedDocType = detectDocTypeFromFileName(anyPdf.fileName);
            }
          }
        }
        
        const notificationData = {
          lexnetId: `${pkg.packageId}-${xml.nig || Date.now()}`,
          court: xml.court || 'Sin determinar',
          location: xml.location,
          procedureNumber: xml.procedureNumber || 'Sin número',
          procedureType: xml.procedureType,
          docType: detectedDocType,
          actType: xml.actType,
          confidence: 95,
          evidences: ['Datos extraídos del XML estructurado de LexNET']
        };
        
        analysisResults.notifications.push(notificationData);
        
        const [newNotification] = await db.insert(notifications).values({
          lexnetId: `${pkg.packageId}-${xml.nig || Date.now()}`,
          packageId: packageId,
          receivedDate: new Date(),
          downloadedDate: pkg.downloadDate,
          court: xml.court || 'Sin determinar',
          location: xml.location,
          procedureType: xml.procedureType,
          procedureNumber: xml.procedureNumber || 'Sin número',
          docType: detectedDocType,
          actType: xml.actType,
          status: 'EXTRACTED',
          priority: 'MEDIUM',
          aiConfidence: 95,
          aiReasoning: ['Datos extraídos automáticamente del XML estructurado de LexNET'],
          aiEvidences: [`NIG: ${xml.nig}`, `Localización: ${xml.location || 'No especificada'}`, `Jurisdicción: ${xml.jurisdiction}`, `Tipo: ${detectedDocType || 'No especificado'}`],
          hasZip: true,
          hasReceipt: pkg.hasReceipt,
        }).returning();
        
        console.log(`[Processor] Created notification ${newNotification.id} from XML for ${xml.court} (${xml.location}), docType: ${detectedDocType}, groupKey: ${xml.groupKey}`);
        
        // Asociar documentos del paquete a esta notificación usando groupKey
        if (xml.groupKey) {
          await db
            .update(documents)
            .set({ notificationId: newNotification.id })
            .where(and(
              eq(documents.packageId, packageId),
              eq(documents.groupKey, xml.groupKey)
            ));
          console.log(`[Processor] Linked documents with groupKey ${xml.groupKey} to notification ${newNotification.id}`);
        } else {
          // Fallback: asociar todos los documentos si no hay groupKey
          await db
            .update(documents)
            .set({ notificationId: newNotification.id })
            .where(eq(documents.packageId, packageId));
          console.log(`[Processor] Linked all documents from package ${packageId} to notification ${newNotification.id}`);
        }
        
        // Generar plan de ejecución básico para notificaciones XML
        try {
          // Filtrar documentos por groupKey para el plan
          const relevantDocs = xml.groupKey 
            ? extractedDocs.filter(d => d.groupKey === xml.groupKey)
            : extractedDocs;
          
          const docsForPlan = relevantDocs.map(d => ({
            fileName: d.fileName,
            originalName: d.originalName,
            filePath: d.filePath
          }));
          
          // Crear análisis básico a partir de datos XML
          const basicAnalysis: AIAnalysisResult = {
            court: xml.court || 'Sin determinar',
            procedureNumber: xml.procedureNumber || 'Sin número',
            procedureType: xml.procedureType,
            actType: xml.actType,
            docType: detectedDocType,
            priority: 'MEDIUM',
            confidence: 95,
            reasoning: ['Datos extraídos del XML estructurado de LexNET'],
            evidences: [`NIG: ${xml.nig}`],
            extractedDeadlines: []
          };
          
          const executionPlan = await generateExecutionPlan(
            newNotification.id,
            basicAnalysis,
            docsForPlan
          );
          
          const planId = await saveExecutionPlan(executionPlan, 'AI');
          console.log(`[Processor] Created execution plan ${planId} for XML notification ${newNotification.id}`);
          
          await db
            .update(notifications)
            .set({ status: 'PLAN_DRAFTED', updatedAt: new Date() })
            .where(eq(notifications.id, newNotification.id));
        } catch (planError) {
          console.error('[Processor] Error creating execution plan for XML notification:', planError);
        }
      }
    } else {
      const primaryDoc = extractedDocs.find(d => d.isPrimary);
      console.log(`[Processor] No XML data, using AI. Primary doc: ${primaryDoc?.fileName || 'none'}`);
      
      if (primaryDoc && primaryDoc.extractedText && !primaryDoc.requiresOcr) {
        try {
          console.log(`[Processor] Running AI analysis...`);
          const aiAnalysis: AIAnalysisResult = await analyzeDocument(primaryDoc.extractedText, userId);
          console.log(`[Processor] AI analysis result:`, aiAnalysis ? 'success' : 'empty');
          
          if (aiAnalysis) {
            const notificationData = {
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
            };
            
            analysisResults.notifications.push(notificationData);
            
            const [newNotification] = await db.insert(notifications).values({
              lexnetId: pkg.packageId,
              packageId: packageId,
              receivedDate: new Date(),
              downloadedDate: pkg.downloadDate,
              court: aiAnalysis.court || 'Sin determinar',
              procedureType: aiAnalysis.procedureType,
              procedureNumber: aiAnalysis.procedureNumber || 'Sin número',
              actType: aiAnalysis.actType,
              parties: aiAnalysis.parties,
              status: 'EXTRACTED',
              priority: aiAnalysis.priority || 'MEDIUM',
              docType: aiAnalysis.docType,
              aiConfidence: aiAnalysis.confidence,
              aiReasoning: aiAnalysis.reasoning,
              aiEvidences: aiAnalysis.evidences,
              extractedDeadlines: aiAnalysis.extractedDeadlines,
              extractedDates: aiAnalysis.dates,
              suggestedCaseId: aiAnalysis.suggestedCaseId,
              hasZip: true,
              hasReceipt: pkg.hasReceipt,
            }).returning();
            
            console.log(`[Processor] Created notification ${newNotification.id} for package ${packageId}`);
            
            // Asociar documentos del paquete a esta notificación
            await db
              .update(documents)
              .set({ notificationId: newNotification.id })
              .where(eq(documents.packageId, packageId));
            
            console.log(`[Processor] Linked documents to notification ${newNotification.id}`);
            
            // Generar plan de ejecución automáticamente
            try {
              const docsForPlan = extractedDocs.map(d => ({
                fileName: d.fileName,
                originalName: d.originalName,
                filePath: d.filePath
              }));
              
              const executionPlan = await generateExecutionPlan(
                newNotification.id,
                aiAnalysis,
                docsForPlan
              );
              
              const planId = await saveExecutionPlan(executionPlan, 'AI');
              console.log(`[Processor] Created execution plan ${planId} for notification ${newNotification.id}`);
              
              // Actualizar estado de la notificación a PLAN_DRAFTED
              await db
                .update(notifications)
                .set({ status: 'PLAN_DRAFTED', updatedAt: new Date() })
                .where(eq(notifications.id, newNotification.id));
            } catch (planError) {
              console.error('[Processor] Error creating execution plan:', planError);
            }
          }
        } catch (error) {
          console.error('[Processor] AI analysis error:', error);
        }
      } else {
        console.log(`[Processor] No extractable data, creating basic notification`);
        const [newNotification] = await db.insert(notifications).values({
          lexnetId: pkg.packageId,
          packageId: packageId,
          receivedDate: new Date(),
          downloadedDate: pkg.downloadDate,
          court: 'Pendiente de revisión manual',
          procedureNumber: 'Sin número - requiere OCR',
          status: 'EXTRACTED',
          priority: 'MEDIUM',
          aiConfidence: 5,
          aiReasoning: ['Los PDFs están escaneados y requieren OCR para extraer texto'],
          hasZip: true,
          hasReceipt: pkg.hasReceipt,
        }).returning();
        console.log(`[Processor] Created basic notification ${newNotification.id}`);
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

    console.log(`[Processor] Package ${packageId} marked as ANALYZED`);
    return analysisResults;
  } catch (error) {
    console.error('[Processor] Error:', error);
    await db
      .update(lexnetPackages)
      .set({ 
        status: 'FAILED',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        updatedAt: new Date() 
      })
      .where(eq(lexnetPackages.id, packageId));

    throw error;
  }
}

interface XmlExtractedData {
  court?: string;
  location?: string;
  procedureNumber?: string;
  procedureType?: string;
  docType?: string;
  actType?: string;
  nig?: string;
  jurisdiction?: string;
  codigoSGP?: string;
  groupKey?: string;
}

const PROVINCE_MAP: Record<string, string> = {
  '15': 'A Coruña', '27': 'Lugo', '32': 'Ourense', '36': 'Pontevedra',
  '01': 'Álava', '20': 'Guipúzcoa', '48': 'Vizcaya', '31': 'Navarra',
  '02': 'Albacete', '03': 'Alicante', '04': 'Almería', '05': 'Ávila',
  '06': 'Badajoz', '07': 'Baleares', '08': 'Barcelona', '09': 'Burgos',
  '10': 'Cáceres', '11': 'Cádiz', '12': 'Castellón', '13': 'Ciudad Real',
  '14': 'Córdoba', '16': 'Cuenca', '17': 'Girona', '18': 'Granada',
  '19': 'Guadalajara', '21': 'Huelva', '22': 'Huesca', '23': 'Jaén',
  '24': 'León', '25': 'Lérida', '26': 'La Rioja', '28': 'Madrid',
  '29': 'Málaga', '30': 'Murcia', '33': 'Asturias', '34': 'Palencia',
  '35': 'Las Palmas', '37': 'Salamanca', '38': 'S/C Tenerife',
  '39': 'Cantabria', '40': 'Segovia', '41': 'Sevilla', '42': 'Soria',
  '43': 'Tarragona', '44': 'Teruel', '45': 'Toledo', '46': 'Valencia',
  '47': 'Valladolid', '49': 'Zamora', '50': 'Zaragoza', '51': 'Ceuta', '52': 'Melilla'
};

function parseXmlData(xmlContent: string): XmlExtractedData {
  const data: XmlExtractedData = {};
  
  const courtMatch = xmlContent.match(/<tns:OrganoJudicial>[\s\S]*?<tns:Descripcion>([^<]+)<\/tns:Descripcion>/);
  if (courtMatch) {
    data.court = courtMatch[1].trim();
  }
  
  const codigoSGPMatch = xmlContent.match(/<tns:CodigoSGP>([^<]+)<\/tns:CodigoSGP>/);
  if (codigoSGPMatch) {
    data.codigoSGP = codigoSGPMatch[1].trim();
    const provinceCode = data.codigoSGP.substring(0, 2);
    data.location = PROVINCE_MAP[provinceCode] || `Provincia ${provinceCode}`;
  }
  
  const procDescMatch = xmlContent.match(/<tns:Procedimiento>[\s\S]*?<tns:Descripcion>([^<]+)<\/tns:Descripcion>/);
  if (procDescMatch) {
    const fullDesc = procDescMatch[1].trim();
    const procNumMatch = fullDesc.match(/(\d{7}\/\d{4})/);
    if (procNumMatch) {
      data.procedureNumber = procNumMatch[1];
    }
    const procTypeMatch = fullDesc.match(/^([^(]+)\s*\(/);
    if (procTypeMatch) {
      data.procedureType = procTypeMatch[1].trim();
    }
  }
  
  const nigMatch = xmlContent.match(/<tns:NIG>([^<]+)<\/tns:NIG>/);
  if (nigMatch) {
    data.nig = nigMatch[1].trim();
  }
  
  const jurisdictionMatch = xmlContent.match(/<tns:Jurisdiccion>([^<]+)<\/tns:Jurisdiccion>/);
  if (jurisdictionMatch) {
    data.jurisdiction = jurisdictionMatch[1].trim();
  }
  
  const tipoActMatch = xmlContent.match(/<tns:TipoActo>[\s\S]*?<tns:Descripcion>([^<]+)<\/tns:Descripcion>/);
  if (tipoActMatch) {
    data.actType = tipoActMatch[1].trim();
  }
  
  const tipoDocMatch = xmlContent.match(/<tns:TipoDocumento>([^<]+)<\/tns:TipoDocumento>/);
  if (tipoDocMatch) {
    data.docType = tipoDocMatch[1].trim();
  }
  
  if (!data.docType) {
    const descActo = xmlContent.match(/<tns:DescripcionActo>([^<]+)<\/tns:DescripcionActo>/);
    if (descActo) {
      const desc = descActo[1].toUpperCase();
      if (desc.includes('SENTENCIA')) data.docType = 'SENTENCIA';
      else if (desc.includes('AUTO')) data.docType = 'AUTO';
      else if (desc.includes('DECRETO')) data.docType = 'DECRETO';
      else if (desc.includes('PROVIDENCIA')) data.docType = 'PROVIDENCIA';
      else if (desc.includes('DILIGENCIA')) data.docType = 'DILIGENCIA';
      else if (desc.includes('CITACION') || desc.includes('CITACIÓN')) data.docType = 'CITACION';
    }
  }
  
  return data;
}

function detectDocTypeFromFileName(fileName: string): string | undefined {
  const upper = fileName.toUpperCase();
  if (upper.includes('SENTENCIA')) return 'SENTENCIA';
  if (upper.includes('AUTO ') || upper.includes('AUTO_') || upper.startsWith('AUTO')) return 'AUTO';
  if (upper.includes('DECRETO')) return 'DECRETO';
  if (upper.includes('PROVIDENCIA')) return 'PROVIDENCIA';
  if (upper.includes('DILIGENCIA') || upper.includes('DIL.') || upper.includes('DIOR')) return 'DILIGENCIA';
  if (upper.includes('CITACION') || upper.includes('CITACIÓN')) return 'CITACION';
  if (upper.includes('NOTIFICACION') || upper.includes('NOTIFICACIÓN')) return 'NOTIFICACION';
  if (upper.includes('REQUERIMIENTO')) return 'REQUERIMIENTO';
  if (upper.includes('EMPLAZAMIENTO')) return 'EMPLAZAMIENTO';
  return undefined;
}

async function extractZipContents(
  zipPath: string,
  extractPath: string,
  packageId: number
): Promise<{ docs: ExtractedDocument[], xmlData: XmlExtractedData[] }> {
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();
  const extractedDocs: ExtractedDocument[] = [];
  const xmlDataList: XmlExtractedData[] = [];

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
    const isXml = ext === '.xml';
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
    
    const groupKey = extractGroupKey(originalName);
    
    if (isXml && fileName.includes('DATOS ESTRUCTURADOS')) {
      try {
        const xmlContent = buffer.toString('utf-8');
        const xmlData = parseXmlData(xmlContent);
        xmlData.groupKey = groupKey;
        if (xmlData.court || xmlData.procedureNumber) {
          xmlDataList.push(xmlData);
          console.log(`[Processor] Extracted XML data with groupKey ${groupKey}:`, xmlData);
        }
      } catch (error) {
        console.error('[Processor] Error parsing XML:', error);
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
      requiresOcr,
      groupKey
    };

    extractedDocs.push(doc);

    await db.insert(documents).values({
      packageId,
      groupKey,
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

  return { docs: extractedDocs, xmlData: xmlDataList };
}

async function extractTextFromPdf(filePath: string): Promise<string> {
  try {
    const buffer = fs.readFileSync(filePath);
    const pdfParseModule = await import('pdf-parse') as any;
    const pdfParse = pdfParseModule.default || pdfParseModule;
    const data = await pdfParse(buffer);
    return data.text || '';
  } catch (error) {
    console.error('[Processor] PDF extraction error:', error);
    return '';
  }
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
