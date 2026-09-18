import { GoogleGenAI } from "@google/genai";
import { SYSTEM } from "./knowledge.js";

export async function generateReply(text) {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is missing");
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || "gemini-3.8-flash",
    contents: text,
    config: { systemInstruction: SYSTEM, maxOutputTokens: 800 },
  });
  return response.text || "Sorry, I couldn't generate a reply. Please try again.";
}
