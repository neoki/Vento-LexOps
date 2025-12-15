import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const STORAGE_BASE = process.env.STORAGE_PATH || './storage';
const LEXNET_PATH = path.join(STORAGE_BASE, 'lexnet');
const EXTRACTED_PATH = path.join(STORAGE_BASE, 'extracted');
const TEMP_PATH = path.join(STORAGE_BASE, 'temp');

export function ensureDirectories() {
  [STORAGE_BASE, LEXNET_PATH, EXTRACTED_PATH, TEMP_PATH].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

export function getPackagePath(lawyerUsername: string, date: Date): string {
  const dateStr = date.toISOString().split('T')[0];
  const dirPath = path.join(LEXNET_PATH, dateStr, lawyerUsername);
  
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  
  return dirPath;
}

export function getExtractedPath(packageId: string): string {
  const dirPath = path.join(EXTRACTED_PATH, packageId);
  
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  
  return dirPath;
}

export function calculateFileHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    
    stream.on('data', data => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

export function calculateBufferHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export async function saveFile(
  buffer: Buffer,
  fileName: string,
  destinationDir: string
): Promise<{ filePath: string; fileHash: string; fileSize: number }> {
  ensureDirectories();
  
  if (!fs.existsSync(destinationDir)) {
    fs.mkdirSync(destinationDir, { recursive: true });
  }
  
  const filePath = path.join(destinationDir, fileName);
  fs.writeFileSync(filePath, buffer);
  
  const fileHash = calculateBufferHash(buffer);
  const fileSize = buffer.length;
  
  return { filePath, fileHash, fileSize };
}

export async function savePackageZip(
  zipBuffer: Buffer,
  lawyerUsername: string,
  packageId: string
): Promise<{ zipPath: string; zipHash: string }> {
  const packageDir = getPackagePath(lawyerUsername, new Date());
  const zipPath = path.join(packageDir, `${packageId}.zip`);
  
  fs.writeFileSync(zipPath, zipBuffer);
  const zipHash = calculateBufferHash(zipBuffer);
  
  return { zipPath, zipHash };
}

export async function saveReceipt(
  receiptBuffer: Buffer,
  lawyerUsername: string,
  packageId: string,
  extension: string = 'pdf'
): Promise<{ receiptPath: string; receiptHash: string }> {
  const packageDir = getPackagePath(lawyerUsername, new Date());
  const receiptPath = path.join(packageDir, `${packageId}_justificante.${extension}`);
  
  fs.writeFileSync(receiptPath, receiptBuffer);
  const receiptHash = calculateBufferHash(receiptBuffer);
  
  return { receiptPath, receiptHash };
}

export function readFile(filePath: string): Buffer {
  return fs.readFileSync(filePath);
}

export function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

export function deleteFile(filePath: string): void {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

export function listFiles(dirPath: string): string[] {
  if (!fs.existsSync(dirPath)) {
    return [];
  }
  return fs.readdirSync(dirPath);
}

export function getFileStats(filePath: string): fs.Stats | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return fs.statSync(filePath);
}

export function getMimeType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.zip': 'application/zip',
    '.txt': 'text/plain',
    '.html': 'text/html',
    '.xml': 'application/xml',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

export function generateSequentialFileName(
  sequenceNumber: number,
  documentType: string,
  originalName: string
): string {
  const seq = String(sequenceNumber).padStart(2, '0');
  const ext = path.extname(originalName);
  const sanitizedType = documentType.toUpperCase().replace(/[^A-Z0-9\s]/g, '');
  return `${seq} ${sanitizedType}${ext}`;
}

ensureDirectories();
