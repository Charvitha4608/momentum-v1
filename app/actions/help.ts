"use server"

// In-app help assistant. Answers free-form questions about how Momentum works,
// grounded ONLY in the user-facing guide at lib/help/app-knowledge.md. The same
// guide is rendered on the /help page as an always-available reference, so when
// the AI is unavailable we fall back to pointing the user at it.

import { promises as fs } from "fs"
import path from "path"

import { geminiText } from "@/lib/ai/gemini"

const DOC_PATH = path.join(process.cwd(), "lib", "help", "app-knowledge.md")

// Read once and cache for the lifetime of the server process — the guide is a
// static file, so there's no need to hit the disk on every question.
let cachedDoc: string | null = null
async function loadDoc(): Promise<string> {
  if (cachedDoc !== null) return cachedDoc
  cachedDoc = await fs.readFile(DOC_PATH, "utf8")
  return cachedDoc
}

/** The full guide text, for rendering the reference section on the /help page. */
export async function getHelpDoc(): Promise<string> {
  return loadDoc()
}

export type HelpAnswer =
  | { ok: true; answer: string }
  | { ok: false; message: string }

const FALLBACK_MESSAGE =
  "I couldn't generate an answer right now. Please refer to the full guide below — it covers every part of the app."

/**
 * Answer one help question from the guide. Returns the model's answer, or an
 * `ok: false` fallback (pointing at the on-page guide) whenever the AI is
 * unavailable — no API key, an API error, or an empty response.
 */
export async function askHelpAssistant(question: string): Promise<HelpAnswer> {
  const trimmed = question.trim()
  if (!trimmed) return { ok: false, message: "Type a question to get started." }

  const doc = await loadDoc()

  const systemPrompt = `You are the help assistant inside Momentum, a personal-growth app. Answer the user's question about how the app works using ONLY the guide below. Do not invent features or behavior that the guide doesn't describe.

Style: friendly, plain language, second person ("you"). Be concise — a few sentences or a short list, not an essay. Don't mention "the guide" or that you were given a document; just answer naturally.

If the guide doesn't cover the question, say so briefly and suggest they read the full guide on this page rather than guessing.

=== MOMENTUM GUIDE ===
${doc}
=== END GUIDE ===`

  const answer = await geminiText(systemPrompt, trimmed, { temperature: 0.3, maxOutputTokens: 600 })
  if (!answer) return { ok: false, message: FALLBACK_MESSAGE }
  return { ok: true, answer }
}
