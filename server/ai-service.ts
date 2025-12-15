import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { db } from "./db";
import { userAiSettings } from "../shared/schema";
import { eq } from "drizzle-orm";

export type AIProvider = "OPENAI" | "GEMINI";

interface AIAnalysisResult {
  confidence: number;
  reasoning: string[];
  suggestedCaseId?: string;
  extractedDeadlines: Array<{
    type: string;
    date: string;
    description: string;
  }>;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  docType: string;
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

async function analyzeWithGemini(
  apiKey: string,
  documentText: string,
  temperature: number = 0.7
): Promise<AIAnalysisResult> {
  const genAI = new GoogleGenAI({ apiKey });

  const prompt = `Analiza el siguiente documento legal de LexNET y extrae la información relevante.

Documento:
${documentText}

Responde en formato JSON con la siguiente estructura:
{
  "confidence": <número del 0 al 100 indicando la confianza del análisis>,
  "reasoning": [<array de strings explicando el razonamiento>],
  "suggestedCaseId": "<ID del caso sugerido si se puede inferir>",
  "extractedDeadlines": [
    {
      "type": "<tipo de plazo: RECURSO, CONTESTACION, AUDIENCIA, etc>",
      "date": "<fecha en formato ISO>",
      "description": "<descripción del plazo>"
    }
  ],
  "priority": "<LOW|MEDIUM|HIGH|CRITICAL basado en urgencia>",
  "docType": "<tipo de documento: SENTENCIA, PROVIDENCIA, AUTO, CITACION, etc>"
}`;

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

  const prompt = `Analiza el siguiente documento legal de LexNET y extrae la información relevante.

Documento:
${documentText}

Responde en formato JSON con la siguiente estructura:
{
  "confidence": <número del 0 al 100 indicando la confianza del análisis>,
  "reasoning": [<array de strings explicando el razonamiento>],
  "suggestedCaseId": "<ID del caso sugerido si se puede inferir>",
  "extractedDeadlines": [
    {
      "type": "<tipo de plazo: RECURSO, CONTESTACION, AUDIENCIA, etc>",
      "date": "<fecha en formato ISO>",
      "description": "<descripción del plazo>"
    }
  ],
  "priority": "<LOW|MEDIUM|HIGH|CRITICAL basado en urgencia>",
  "docType": "<tipo de documento: SENTENCIA, PROVIDENCIA, AUTO, CITACION, etc>"
}`;

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
  userId: number,
  documentText: string
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
