interface LexnetMetadata {
  year?: string;
  procedureNumber?: string;
  procedureType?: string;
  court?: string;
  nig?: string;
  documentType?: string;
  rawParts: string[];
}

const PROCEDURE_TYPE_MAP: Record<string, string> = {
  'ORD': 'Ordinario',
  'DSP': 'Despido',
  'ETJ': 'Ejecución de Títulos Judiciales',
  'CAN': 'Cantidad',
  'MON': 'Monitorio',
  'SSO': 'Seguridad Social',
  'VRB': 'Verbal',
  'CAM': 'Cambiario',
  'HIP': 'Hipotecario',
  'FAM': 'Familia',
  'ERE': 'ERE',
  'CON': 'Concurso',
  'LAB': 'Laboral',
  'ADM': 'Administrativo',
  'PEN': 'Penal',
  'MER': 'Mercantil',
  'CIV': 'Civil',
};

const DOCUMENT_TYPE_MAP: Record<string, string> = {
  'SEN': 'Sentencia',
  'AUT': 'Auto',
  'DEC': 'Decreto',
  'DIL': 'Diligencia',
  'NOT': 'Notificación',
  'CED': 'Cédula',
  'REQ': 'Requerimiento',
  'CIT': 'Citación',
  'PRO': 'Providencia',
  'COM': 'Comunicación',
  'INF': 'Informe',
  'OFI': 'Oficio',
  'EMB': 'Embargo',
  'SUB': 'Subasta',
  'ADJ': 'Adjudicación',
};

const COURT_PATTERNS: Array<{ pattern: RegExp; type: string }> = [
  { pattern: /JS(\d+)/i, type: 'Juzgado Social nº' },
  { pattern: /JPI(\d+)/i, type: 'Juzgado de Primera Instancia nº' },
  { pattern: /JM(\d+)/i, type: 'Juzgado de lo Mercantil nº' },
  { pattern: /JCA(\d+)/i, type: 'Juzgado Contencioso-Administrativo nº' },
  { pattern: /TSJ/i, type: 'Tribunal Superior de Justicia' },
  { pattern: /AP/i, type: 'Audiencia Provincial' },
  { pattern: /AN/i, type: 'Audiencia Nacional' },
  { pattern: /TS/i, type: 'Tribunal Supremo' },
];

export function parseLexnetFilename(filename: string): LexnetMetadata {
  const cleanName = filename.replace(/\.[^.]+$/, '');
  const parts = cleanName.split(/[_\-\s]+/).filter(p => p.length > 0);
  
  const metadata: LexnetMetadata = {
    rawParts: parts
  };
  
  for (const part of parts) {
    if (/^(19|20)\d{2}$/.test(part)) {
      metadata.year = part;
      continue;
    }
    
    if (/^\d{5,}$/.test(part)) {
      metadata.procedureNumber = part;
      continue;
    }
    
    const upperPart = part.toUpperCase();
    if (PROCEDURE_TYPE_MAP[upperPart]) {
      metadata.procedureType = PROCEDURE_TYPE_MAP[upperPart];
      continue;
    }
    
    if (DOCUMENT_TYPE_MAP[upperPart]) {
      metadata.documentType = DOCUMENT_TYPE_MAP[upperPart];
      continue;
    }
    
    for (const courtPattern of COURT_PATTERNS) {
      const match = part.match(courtPattern.pattern);
      if (match) {
        metadata.court = match[1] 
          ? `${courtPattern.type}${match[1]}`
          : courtPattern.type;
        break;
      }
    }
    
    const nigMatch = part.match(/NIG[:\s]*([\d\-\/]+)/i);
    if (nigMatch) {
      metadata.nig = nigMatch[1];
    }
  }
  
  if (!metadata.procedureNumber) {
    const numMatch = cleanName.match(/(\d{4,})/);
    if (numMatch) {
      metadata.procedureNumber = numMatch[1];
    }
  }
  
  return metadata;
}

export function extractGroupKey(filename: string): string {
  const cleanName = filename.replace(/\.[^.]+$/, '');
  const parts = cleanName.split(/[_\-]+/);
  
  if (parts.length >= 3) {
    return parts.slice(0, -2).join('_');
  }
  
  return cleanName;
}

export function normalizeDocumentName(
  filename: string,
  sequenceNumber: number,
  metadata?: LexnetMetadata
): string {
  const ext = filename.match(/\.[^.]+$/)?.[0] || '.pdf';
  const prefix = String(sequenceNumber).padStart(2, '0');
  
  if (!metadata) {
    metadata = parseLexnetFilename(filename);
  }
  
  let normalizedName = '';
  
  if (metadata.documentType) {
    normalizedName = metadata.documentType;
    
    if (metadata.procedureNumber) {
      normalizedName += ` ${metadata.procedureNumber}`;
    }
    if (metadata.year) {
      normalizedName += ` (${metadata.year})`;
    }
  } else {
    const cleanName = filename.replace(/\.[^.]+$/, '');
    normalizedName = cleanName.replace(/[_\-]+/g, ' ').trim();
  }
  
  return `[${prefix}] ${normalizedName}${ext}`;
}

export function determineInstance(
  procedureType?: string,
  metadata?: LexnetMetadata
): '1ª Instancia' | 'RSU' | 'RCUD' | 'Ejecución' | 'Otros' {
  const type = procedureType?.toUpperCase() || '';
  const court = metadata?.court?.toUpperCase() || '';
  
  if (type.includes('EJECUCION') || type.includes('ETJ') || type.includes('EJECUTIV')) {
    return 'Ejecución';
  }
  
  if (type.includes('RCUD') || court.includes('SUPREMO')) {
    return 'RCUD';
  }
  
  if (type.includes('RSU') || type.includes('SUPLICACION') || court.includes('TSJ')) {
    return 'RSU';
  }
  
  if (court.includes('PRIMERA INSTANCIA') || court.includes('SOCIAL') || court.includes('MERCANTIL')) {
    return '1ª Instancia';
  }
  
  return '1ª Instancia';
}

export function extractProcedureInfo(filename: string): {
  procedureNumber: string | null;
  year: string | null;
  court: string | null;
  nig: string | null;
} {
  const metadata = parseLexnetFilename(filename);
  
  return {
    procedureNumber: metadata.procedureNumber || null,
    year: metadata.year || null,
    court: metadata.court || null,
    nig: metadata.nig || null
  };
}

export function validateLexnetDocumentName(filename: string): {
  isValid: boolean;
  issues: string[];
  metadata: LexnetMetadata;
} {
  const metadata = parseLexnetFilename(filename);
  const issues: string[] = [];
  
  if (!metadata.year) {
    issues.push('No se detectó año en el nombre del archivo');
  }
  
  if (!metadata.procedureNumber) {
    issues.push('No se detectó número de procedimiento');
  }
  
  if (!metadata.court) {
    issues.push('No se detectó información del juzgado');
  }
  
  return {
    isValid: issues.length === 0,
    issues,
    metadata
  };
}
