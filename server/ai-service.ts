import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { db } from "./db";
import { users, offices } from "../shared/schema";
import { eq } from "drizzle-orm";

export type AIProvider = "OPENAI" | "GEMINI" | "NONE";

export interface AIAnalysisResult {
  confidence: number;
  reasoning: string[];
  suggestedCaseId?: string;
  extractedDeadlines: Array<{
    type: string;
    date: string;
    description: string;
    days?: number;
  }>;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  docType: string;
  court?: string;
  procedureNumber?: string;
  procedureType?: string;
  actType?: string;
  parties?: {
    client?: string;
    opponent?: string;
  };
  dates?: {
    hearing?: Date;
    deadline?: Date;
  };
  deadlines?: Array<{
    days: number;
    type: string;
    description: string;
  }>;
  evidences?: string[];
}

interface AIProviderConfig {
  provider: AIProvider;
  apiKey: string | null;
  model?: string;
  temperature?: number;
  userWantsAI: boolean;
}

async function getOfficeAIConfig(userId: number): Promise<AIProviderConfig> {
  const [user] = await db
    .select({
      useAi: users.useAi,
      officeId: users.officeId,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    return {
      provider: "NONE",
      apiKey: null,
      temperature: 0.7,
      userWantsAI: false,
    };
  }

  if (!user.useAi) {
    return {
      provider: "NONE",
      apiKey: null,
      temperature: 0.7,
      userWantsAI: false,
    };
  }

  if (!user.officeId) {
    return {
      provider: "GEMINI",
      apiKey: process.env.GEMINI_API_KEY || null,
      temperature: 0.7,
      userWantsAI: true,
    };
  }

  const [office] = await db
    .select()
    .from(offices)
    .where(eq(offices.id, user.officeId))
    .limit(1);

  if (!office || office.aiProvider === 'NONE') {
    return {
      provider: "NONE",
      apiKey: null,
      temperature: 0.7,
      userWantsAI: true,
    };
  }

  let apiKey: string | null = null;
  
  if (office.aiSecretKeyName) {
    apiKey = process.env[office.aiSecretKeyName] || null;
  }
  
  if (!apiKey) {
    if (office.aiProvider === 'GEMINI') {
      apiKey = process.env.GEMINI_API_KEY || null;
    } else if (office.aiProvider === 'OPENAI') {
      apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || null;
    }
  }

  return {
    provider: office.aiProvider as AIProvider,
    apiKey,
    temperature: office.aiTemperature ? parseFloat(office.aiTemperature) : 0.7,
    userWantsAI: true,
  };
}

const ANALYSIS_PROMPT = `Analiza el siguiente documento legal de LexNET y extrae la información relevante.

Documento:
{DOCUMENT_TEXT}

Responde en formato JSON con la siguiente estructura:
{
  "confidence": <número del 0 al 100 indicando la confianza del análisis>,
  "reasoning": [<array de strings explicando el razonamiento>],
  "court": "<nombre del juzgado>",
  "procedureNumber": "<número de autos/procedimiento>",
  "procedureType": "<tipo: PO, DSP, DOI, RSU, RCUD, ETJ, etc>",
  "actType": "<tipo de acto: SEÑALAMIENTO, SENTENCIA, PROVIDENCIA, AUTO, CITACION, REQUERIMIENTO, etc>",
  "parties": {
    "client": "<nombre del cliente si se identifica>",
    "opponent": "<nombre de la parte contraria si se identifica>"
  },
  "dates": {
    "hearing": "<fecha y hora de juicio/vista si existe, en ISO>",
    "deadline": "<fecha límite de plazo si existe, en ISO>"
  },
  "deadlines": [
    {
      "days": <número de días del plazo>,
      "type": "<HABIL o NATURAL>",
      "description": "<descripción del plazo>"
    }
  ],
  "evidences": [<fragmentos del texto que respaldan el análisis>],
  "suggestedCaseId": "<ID del caso sugerido si se puede inferir>",
  "extractedDeadlines": [
    {
      "type": "<tipo de plazo: RECURSO, CONTESTACION, AUDIENCIA, etc>",
      "date": "<fecha calculada en formato ISO>",
      "description": "<descripción del plazo>",
      "days": <días del plazo>
    }
  ],
  "priority": "<LOW|MEDIUM|HIGH|CRITICAL basado en urgencia>",
  "docType": "<tipo de documento: SENTENCIA, PROVIDENCIA, AUTO, CITACION, etc>"
}`;

async function analyzeWithGemini(
  apiKey: string,
  documentText: string,
  temperature: number = 0.7
): Promise<AIAnalysisResult> {
  const genAI = new GoogleGenAI({ apiKey });

  const prompt = ANALYSIS_PROMPT.replace('{DOCUMENT_TEXT}', documentText);

  const response = await genAI.models.generateContent({
    model: "gemini-2.0-flash",
    contents: prompt,
    config: {
      temperature,
      responseMimeType: "application/json",
    },
  });

  const text = response.text || "{}";
  return JSON.parse(text);
}

async function analyzeWithOpenAI(
  apiKey: string,
  documentText: string,
  temperature: number = 0.7,
  useReplit: boolean = false
): Promise<AIAnalysisResult> {
  const openai = new OpenAI({
    apiKey: useReplit ? process.env.AI_INTEGRATIONS_OPENAI_API_KEY : apiKey,
    baseURL: useReplit ? process.env.AI_INTEGRATIONS_OPENAI_BASE_URL : undefined,
  });

  const prompt = ANALYSIS_PROMPT.replace('{DOCUMENT_TEXT}', documentText);

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    temperature,
    response_format: { type: "json_object" },
  });

  const text = response.choices[0]?.message?.content || "{}";
  return JSON.parse(text);
}

export async function analyzeDocument(
  documentText: string,
  userId: number
): Promise<AIAnalysisResult> {
  const config = await getOfficeAIConfig(userId);

  if (config.provider === "NONE" || !config.userWantsAI) {
    throw new Error("El análisis con IA está desactivado para este usuario u oficina");
  }

  if (!config.apiKey) {
    throw new Error(`No se ha configurado una API key para ${config.provider}`);
  }

  if (config.provider === "OPENAI") {
    const useReplitIntegration = config.apiKey === process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    return analyzeWithOpenAI(config.apiKey, documentText, config.temperature, useReplitIntegration);
  }

  return analyzeWithGemini(config.apiKey, documentText, config.temperature);
}

export async function isAIEnabled(userId: number): Promise<boolean> {
  const config = await getOfficeAIConfig(userId);
  return config.provider !== "NONE" && config.userWantsAI && !!config.apiKey;
}

export async function updateOfficeAISettings(
  officeId: number,
  provider: AIProvider,
  secretKeyName?: string,
  temperature?: number
): Promise<void> {
  await db
    .update(offices)
    .set({
      aiProvider: provider,
      aiSecretKeyName: secretKeyName,
      aiTemperature: temperature?.toString() || "0.7",
      updatedAt: new Date(),
    })
    .where(eq(offices.id, officeId));
}

export async function getOfficeAISettings(officeId: number) {
  const [office] = await db
    .select({
      aiProvider: offices.aiProvider,
      aiSecretKeyName: offices.aiSecretKeyName,
      aiTemperature: offices.aiTemperature,
    })
    .from(offices)
    .where(eq(offices.id, officeId))
    .limit(1);

  return office || { aiProvider: "NONE", aiSecretKeyName: null, aiTemperature: "0.7" };
}

export async function updateUserAIPreference(userId: number, useAi: boolean): Promise<void> {
  await db
    .update(users)
    .set({ useAi, updatedAt: new Date() })
    .where(eq(users.id, userId));
}
