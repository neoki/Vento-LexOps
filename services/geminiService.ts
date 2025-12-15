import { GoogleGenAI } from "@google/genai";
import { NotificationPackage } from "../types";

// This is a simulation service. In a real app, this would process the text extracted 
// from the PDF by the Python backend/agent.
export const analyzeLegalText = async (textSnippet: string): Promise<{ summary: string; sentiment: string }> => {
  if (!process.env.API_KEY) {
    console.warn("API_KEY not found. Using mock AI response.");
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({
                summary: "El documento parece ser una notificación de sentencia estimatoria parcial. Se reconocen plazos de suplicación de 5 días.",
                sentiment: "Neutral/Informative"
            })
        }, 1500);
    });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Analiza el siguiente texto jurídico español y extrae un resumen ejecutivo y los plazos fatales si existen. Texto: ${textSnippet}`,
    });
    
    return {
        summary: response.text || "No se pudo generar resumen.",
        sentiment: "Analysis Complete"
    };
  } catch (error) {
    console.error("Gemini API Error:", error);
    return { summary: "Error conectando con IA.", sentiment: "Error" };
  }
};

export const suggestCaseClassification = async (notification: NotificationPackage, availableCases: string[]): Promise<string> => {
     // Simulation of RAG (Retrieval Augmented Generation) logic
     // In prod: Search vector DB for similar cases
     return availableCases[0] || "Unknown";
}