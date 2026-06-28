// lib/ai/gemini.ts
//
// Thin wrapper around the Gemini generateContent endpoint shared by all AI
// features (assistant agent, planner agent, narrative, digest).  Keeps
// fetch/error handling in one place so each feature file stays focused on its
// own prompt/parsing logic.

const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash"
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models"

export interface GeminiTextPart {
  text: string
}

export interface GeminiContent {
  role: "user" | "model"
  parts: GeminiTextPart[]
}

export interface GeminiOptions {
  temperature?: number
  maxOutputTokens?: number
}

/**
 * Single-turn text completion against Gemini.  Returns the first candidate's
 * text, or null when the API is unavailable / returns an empty response.
 * Never throws — callers should treat null as a graceful degradation signal.
 */
export async function geminiText(
  systemPrompt: string,
  userMessage: string,
  opts: GeminiOptions = {}
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null

  try {
    const res = await fetch(`${GEMINI_BASE}/${DEFAULT_MODEL}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userMessage }] }],
        generationConfig: {
          temperature: opts.temperature ?? 0.5,
          maxOutputTokens: opts.maxOutputTokens ?? 512,
        },
      }),
    })

    if (!res.ok) return null
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[]
    }
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text
    return text?.trim() || null
  } catch {
    return null
  }
}
