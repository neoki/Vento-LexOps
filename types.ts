export enum Role {
  ADMIN = 'ADMIN',
  LAWYER = 'LAWYER',
  SUPPORT = 'SUPPORT', // Administrativa
  AUDITOR = 'AUDITOR'
}

export enum NotificationStatus {
  PENDING_DOWNLOAD = 'PENDING_DOWNLOAD',
  DOWNLOADED = 'DOWNLOADED',
  PROCESSING = 'PROCESSING',
  TRIAGE_REQUIRED = 'TRIAGE_REQUIRED', // Low confidence
  READY_FOR_INVENTO = 'READY_FOR_INVENTO', // High confidence
  SYNCED = 'SYNCED',
  ERROR = 'ERROR'
}

export enum Priority {
  HIGH = 'HIGH', // Plazos cercanos, Sentencias
  NORMAL = 'NORMAL',
  LOW = 'LOW' // Meros trámites
}

export enum DocType {
  SENTENCIA = 'SENTENCIA',
  AUTO = 'AUTO',
  DECRETO = 'DECRETO',
  CEDULA_CITACION = 'CEDULA_CITACION',
  MERO_TRAMITE = 'MERO_TRAMITE',
  UNKNOWN = 'UNKNOWN'
}

export interface LexNetAccount {
  id: string;
  lawyerName: string;
  barAssociationNumber: string; // Nº Colegiado
  status: 'ACTIVE' | 'REVOKED' | 'NEEDS_AUTH';
  lastSync: string;
}

export interface NotificationPackage {
  id: string;
  lexnetId: string; // ID original de LexNET
  receivedDate: string;
  downloadedDate: string;
  court: string; // Juzgado
  procedureType: string; // Tipo procedimiento (Social, Ordinario...)
  procedureNumber: string; // Autos
  status: NotificationStatus;
  priority: Priority;
  docType: DocType;
  
  // AI Analysis
  aiConfidence: number; // 0-100
  aiReasoning: string[]; // Why did AI classify this?
  extractedDeadlines: Deadline[];
  
  // Mapping
  suggestedCaseId?: string; // Invento Expediente ID
  assignedLawyerId: string;
  
  hasZip: boolean;
  hasReceipt: boolean; // Justificante
}

export interface Deadline {
  id: string;
  description: string;
  date: string; // ISO Date
  isFatal: boolean; // Término fatal
  type: 'MAIN' | 'DERIVED_15' | 'DERIVED_30' | 'WARNING';
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string; // e.g., "MANUAL_OVERRIDE_DEADLINE"
  targetId: string;
  details: string;
}

export interface StatMetric {
  label: string;
  value: string | number;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
}

export interface AgentLog {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS';
  message: string;
  agentId: string;
}