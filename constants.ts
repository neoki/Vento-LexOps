import { NotificationPackage, NotificationStatus, Priority, DocType, AuditEntry, LexNetAccount, AgentLog } from './types';

export const APP_NAME = "Vento LexOps";

export const MOCK_ACCOUNTS: LexNetAccount[] = [
  { id: '1', lawyerName: 'Carlos García', barAssociationNumber: 'ICAV-1234', status: 'ACTIVE', lastSync: 'Hace 5 min' },
  { id: '2', lawyerName: 'Elena Martín', barAssociationNumber: 'ICAM-5678', status: 'NEEDS_AUTH', lastSync: 'Hace 2 días' },
];

export const MOCK_NOTIFICATIONS: NotificationPackage[] = [
  {
    id: 'NOT-2024-001',
    lexnetId: 'LEX-998877',
    receivedDate: '2024-05-20T09:00:00Z',
    downloadedDate: '2024-05-20T09:15:00Z',
    court: 'Juzgado de lo Social Nº 3 de Vigo',
    procedureType: 'Despido',
    procedureNumber: '123/2024',
    status: NotificationStatus.TRIAGE_REQUIRED,
    priority: Priority.HIGH,
    docType: DocType.SENTENCIA,
    aiConfidence: 45,
    aiReasoning: ['Palabra clave "FALLO" detectada', 'No coincide con expediente abierto exacto'],
    extractedDeadlines: [
      { id: 'D1', description: 'Plazo Recurso Suplicación', date: '2024-05-25', isFatal: true, type: 'MAIN' }
    ],
    suggestedCaseId: 'EXP-2023-999 (Confidence: Low)',
    assignedLawyerId: '1',
    hasZip: true,
    hasReceipt: true
  },
  {
    id: 'NOT-2024-002',
    lexnetId: 'LEX-998878',
    receivedDate: '2024-05-20T09:05:00Z',
    downloadedDate: '2024-05-20T09:15:00Z',
    court: 'TSJ Galicia Sala Social',
    procedureType: 'Reclamación Cantidad',
    procedureNumber: '445/2023',
    status: NotificationStatus.READY_FOR_INVENTO,
    priority: Priority.NORMAL,
    docType: DocType.DECRETO,
    aiConfidence: 98,
    aiReasoning: ['Coincidencia exacta autos 445/2023', 'Tipo documento validado por estructura'],
    extractedDeadlines: [],
    suggestedCaseId: 'EXP-2023-445',
    assignedLawyerId: '1',
    hasZip: true,
    hasReceipt: true
  },
  {
    id: 'NOT-2024-003',
    lexnetId: 'LEX-998879',
    receivedDate: '2024-05-20T10:00:00Z',
    downloadedDate: '2024-05-20T10:01:00Z',
    court: 'Juzgado Social Nº 1 Ourense',
    procedureType: 'Seguridad Social',
    procedureNumber: '88/2024',
    status: NotificationStatus.SYNCED,
    priority: Priority.LOW,
    docType: DocType.MERO_TRAMITE,
    aiConfidence: 99,
    aiReasoning: ['Traslado de documentos', 'Sin plazos detectados'],
    extractedDeadlines: [],
    suggestedCaseId: 'EXP-2024-088',
    assignedLawyerId: '2',
    hasZip: true,
    hasReceipt: true
  },
  {
    id: 'NOT-2024-004',
    lexnetId: 'LEX-998880',
    receivedDate: '2024-05-19T14:30:00Z',
    downloadedDate: '2024-05-19T14:35:00Z',
    court: 'Juzgado Mercantil Nº 2 Pontevedra',
    procedureType: 'Concurso',
    procedureNumber: '990/2022',
    status: NotificationStatus.SYNCED,
    priority: Priority.HIGH,
    docType: DocType.AUTO,
    aiConfidence: 95,
    aiReasoning: ['Auto admisión a trámite', 'Plazo contestación demanda'],
    extractedDeadlines: [
         { id: 'D2', description: 'Contestación Demanda Incidental', date: '2024-05-28', isFatal: true, type: 'MAIN' }
    ],
    suggestedCaseId: 'EXP-2022-990',
    assignedLawyerId: '1',
    hasZip: true,
    hasReceipt: true
  }
];

export const MOCK_AUDIT_LOG: AuditEntry[] = [
  { id: 'AUD-1', timestamp: '2024-05-20 09:15:22', actor: 'System (Agent)', action: 'DOWNLOAD_PACKAGE', targetId: 'NOT-2024-001', details: 'Hash SHA256 verificado.' },
  { id: 'AUD-2', timestamp: '2024-05-20 09:16:00', actor: 'AI Orchestrator', action: 'CLASSIFY', targetId: 'NOT-2024-001', details: 'Confianza baja (45%). Enviado a Triage.' },
  { id: 'AUD-3', timestamp: '2024-05-20 09:20:00', actor: 'System (Agent)', action: 'SYNC_INVENTO', targetId: 'NOT-2024-002', details: 'Documento subido a Expediente EXP-2023-445.' },
];

export const MOCK_AGENT_LOGS: AgentLog[] = [
    { id: 'L1', timestamp: '10:45:01', level: 'INFO', message: 'Iniciando ciclo de sondeo LexNET...', agentId: 'AGENT-WS-01' },
    { id: 'L2', timestamp: '10:45:05', level: 'INFO', message: 'Autenticación con certificado FNMT correcta.', agentId: 'AGENT-WS-01' },
    { id: 'L3', timestamp: '10:45:12', level: 'SUCCESS', message: 'Encontradas 3 notificaciones nuevas.', agentId: 'AGENT-WS-01' },
    { id: 'L4', timestamp: '10:45:15', level: 'INFO', message: 'Descargando paquete ID: 2399482...', agentId: 'AGENT-WS-01' },
    { id: 'L5', timestamp: '10:45:18', level: 'SUCCESS', message: 'Paquete desencriptado y firmado localmente.', agentId: 'AGENT-WS-01' },
    { id: 'L6', timestamp: '10:45:20', level: 'INFO', message: 'Subiendo a Vento Cloud (Secure Tunnel)...', agentId: 'AGENT-WS-01' },
];