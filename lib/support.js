import { GoogleGenAI } from "@google/genai";
import { SYSTEM } from "./knowledge.js";
import { memory } from "./memory.js";
import { collectRelevantWebsiteContext } from "./site-rag.js";

export function createReply({ store = memory, generate = async (params) => {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is missing");
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return ai.models.generateContent(params);
} } = {}) {
  return async function generateReply(text, chatKey) {
    let history = [];
    if (chatKey) {
      try { history = await store.read(chatKey); }
      catch { console.error('Conversation memory read failed; continuing without history'); }
    }
    const contents = history.flatMap(turn => [
      { role: 'user', parts: [{ text: turn.user }] },
      { role: 'model', parts: [{ text: turn.model }] },
    ]);

    let rAGContext = '';
    const ragEnabled = process.env.ENABLE_SITE_RAG !== 'false' && Boolean(process.env.GEMINI_API_KEY);
    if (ragEnabled) {
      try {
        rAGContext = await collectRelevantWebsiteContext(text);
      } catch {
        console.error('Official website retrieval failed; continuing without website context');
      }
    }

    const finalUserMessage = rAGContext
      ? `Use only the official ApilageAI website information below to answer the question. If the answer is not in this content, say it is not available on the official site.\n\n${rAGContext}\n\nQuestion: ${text}`
      : text;

    contents.push({ role: 'user', parts: [{ text: finalUserMessage }] });
    const response = await generate({
      model: process.env.GEMINI_MODEL || "gemini-3.5-flash-lite",
      contents,
      config: { systemInstruction: SYSTEM, maxOutputTokens: 800 },
    });
    const answer = response.text;
    if (!answer) return "Sorry, I couldn't generate a reply. Please try again.";
    if (chatKey) {
      try { await store.append(chatKey, text, answer); }
      catch { console.error('Conversation memory save failed'); }
    }
    return answer;
  };
}

export const generateReply = createReply();
