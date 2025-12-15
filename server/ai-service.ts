import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { db } from "./db";
import { userAiSettings } from "../shared/schema";
import { eq } from "drizzle-orm";

export type AIProvider = "OPENAI" | "GEMINI";

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
}

async function getUserAIConfig(userId: number): Promise<AIProviderConfig> {
  const [settings] = await db
    .select()
    .from(userAiSettings)
    .where(eq(userAiSettings.userId, userId))
    .limit(1);

  if (settings) {
    return {
      provider: settings.provider as AIProvider,
      apiKey: settings.apiKey,
      temperature: settings.temperature ? parseFloat(settings.temperature) : 0.7,
    };
  }

  return {
    provider: "GEMINI",
    apiKey: process.env.GEMINI_API_KEY || null,
    temperature: 0.7,
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
  const config = await getUserAIConfig(userId);

  if (!config.apiKey && config.provider === "OPENAI") {
    if (process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
      return analyzeWithOpenAI(
        process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        documentText,
        config.temperature,
        true
      );
    }
    throw new Error("No se ha configurado una API key para OpenAI");
  }

  if (!config.apiKey && config.provider === "GEMINI") {
    if (process.env.GEMINI_API_KEY) {
      return analyzeWithGemini(
        process.env.GEMINI_API_KEY,
        documentText,
        config.temperature
      );
    }
    throw new Error("No se ha configurado una API key para Gemini");
  }

  if (config.provider === "OPENAI") {
    return analyzeWithOpenAI(config.apiKey!, documentText, config.temperature);
  }

  return analyzeWithGemini(config.apiKey!, documentText, config.temperature);
}

export async function updateUserAISettings(
  userId: number,
  provider: AIProvider,
  apiKey?: string
): Promise<void> {
  const [existing] = await db
    .select()
    .from(userAiSettings)
    .where(eq(userAiSettings.userId, userId))
    .limit(1);

  if (existing) {
    await db
      .update(userAiSettings)
      .set({
        provider,
        apiKey: apiKey || existing.apiKey,
        updatedAt: new Date(),
      })
      .where(eq(userAiSettings.userId, userId));
  } else {
    await db.insert(userAiSettings).values({
      userId,
      provider,
      apiKey,
    });
  }
}

export async function getAISettings(userId: number) {
  const [settings] = await db
    .select()
    .from(userAiSettings)
    .where(eq(userAiSettings.userId, userId))
    .limit(1);

  return settings || { provider: "GEMINI", apiKey: null };
}
