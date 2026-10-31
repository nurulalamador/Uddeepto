import { ApiError } from "@uddeepto/common";
export const aiRequests = new Map();
export const aiFallbackModels = ["gemini-flash-latest", "gemini-3.8-flash", "gemini-flash-lite-latest", "gemini-2.5-flash"];
export let aiWorkingModel = null;
/** Calls Gemini for a learner. attachment = {mimeType, data(base64)} is shown to the model together with the first question. */
export async function askGemini(userId, {
  system,
  messages,
  attachment
}) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new ApiError(503, "The AI assistant is not configured yet. Ask an admin to add a Gemini API key.");
  if (messages.at(-1).role !== "user") throw new ApiError(422, "Send a question to get an answer");
  const now = Date.now(),
    recent = (aiRequests.get(userId) || []).filter(time => now - time < 60000);
  if (recent.length >= Number(process.env.AI_REQUESTS_PER_MINUTE || 12)) throw new ApiError(429, "You are sending messages too quickly. Please wait a moment and try again.");
  aiRequests.set(userId, [...recent, now]);
  const contents = messages.slice(-24).map(item => ({
    role: item.role === "assistant" ? "model" : "user",
    parts: [{
      text: item.content
    }]
  }));
  if (attachment) contents[0].parts.unshift({
    inlineData: {
      mimeType: attachment.mimeType,
      data: attachment.data
    }
  });
  const payload = JSON.stringify({
    systemInstruction: {
      parts: [{
        text: system
      }]
    },
    contents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 4096
    }
  });
  // Google retires Gemini models over time, so fall back to newer ones when a model has been removed.
  const candidates = [...new Set([aiWorkingModel, process.env.GEMINI_MODEL, ...aiFallbackModels].filter(Boolean))];
  // Models can be retired (404) or overloaded (503/500). Try the next model, and one more full round, within a time budget.
  const retriable = new Set([404, 500, 502, 503, 504]);
  const deadline = Date.now() + 55000;
  let response;
  attempts: for (let round = 0; round < 2; round++) {
    for (const model of candidates) {
      const remaining = deadline - Date.now();
      if (remaining < 4000) break attempts;
      try {
        response = await fetch(`${process.env.GEMINI_API_BASE || "https://generativelanguage.googleapis.com/v1beta"}/models/${encodeURIComponent(model)}:generateContent`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": key
          },
          signal: AbortSignal.timeout(Math.min(25000, remaining)),
          body: payload
        });
      } catch {
        response = null;
        continue;
      }
      if (response.ok) {
        aiWorkingModel = model;
        break attempts;
      }
      if (!retriable.has(response.status)) break attempts;
      console.error(`[ai] Gemini model "${model}" returned ${response.status}. Trying another model.`);
    }
    if (round === 0 && Date.now() + 6000 < deadline) await new Promise(resolve => setTimeout(resolve, Number(process.env.AI_RETRY_DELAY_MS || 1500)));
  }
  if (!response) throw new ApiError(504, "The AI assistant took too long to answer. Please try again.");
  if (response.status === 503 || response.status === 500) throw new ApiError(503, "The AI service is very busy right now. Please try again in a moment.");
  if (response.status === 429) throw new ApiError(429, "The AI assistant is busy right now (free quota reached). Please try again in a little while.");
  if (!response.ok) {
    console.error("[ai] Gemini error", response.status, (await response.text().catch(() => "")).slice(0, 300));
    throw new ApiError(502, "The AI assistant could not answer right now. Please try again.");
  }
  const data = await response.json();
  if (data.promptFeedback?.blockReason) throw new ApiError(422, "I can’t help with that request. Try rephrasing your question.");
  const candidate = data.candidates?.[0];
  const text = (candidate?.content?.parts || []).map(part => part.text || "").join("").trim();
  if (!text) throw new ApiError(502, "The AI assistant returned an empty answer. Please try again.");
  return {
    reply: text,
    truncated: candidate?.finishReason === "MAX_TOKENS"
  };
}
