// lib/ai/narrative.ts
//
// Generates a short AI-written paragraph (3-5 sentences) for a completed week.
// Called once per weekly review row when aiNarrative is null; the result is
// persisted so the API is never called again for the same week.
//
// Input shape mirrors what we already have in weeklyReviews + the effort
// comparison rows — no extra DB queries needed at the call site.

import { geminiText } from "@/lib/ai/gemini"

export interface NarrativeInput {
  weekStart: string   // YYYY-MM-DD
  weekEnd: string     // YYYY-MM-DD
  pointsEarned: number
  tasksCompleted: number
  currentStreak: number
  bestDay: string | null
  mostActivePillar: { name: string; icon: string } | null
  leastActivePillar: { name: string; icon: string } | null
  effort: {
    pillarName: string
    desiredPercent: number
    actualPercent: number
    percentOfTarget: number
  }[]
  balanceScore: number | null
  neglectedPillars: { pillarName: string; daysSinceLastActivity: number }[]
}

const SYSTEM_PROMPT = `You are the reflection engine inside Momentum, a personal growth app.

Given one week of the user's effort data, write a SHORT, honest, insightful paragraph (3-5 sentences, max 90 words).

Rules:
- Lead with the single most important pattern or tension you see (e.g. imbalance, strong streak, neglected area).
- Name specific pillars — never say "some areas" when you have exact data.
- Be direct, not cheerleady. Do not start with "Great week!" or similar filler.
- End with one concrete, actionable observation for the coming week.
- Do NOT use markdown, bullet points, or headers. Plain prose only.
- Tone: honest mentor, not a personal trainer.`

function buildPrompt(d: NarrativeInput): string {
  const fmt = (p: number) => `${p}%`
  const effortLines = d.effort
    .map((e) => `  ${e.pillarName}: wanted ${fmt(e.desiredPercent)}, got ${fmt(e.actualPercent)} (${fmt(e.percentOfTarget)} of target)`)
    .join("\n")

  const neglectedLines =
    d.neglectedPillars.length > 0
      ? d.neglectedPillars.map((n) => `  ${n.pillarName}: ${n.daysSinceLastActivity} days without activity`).join("\n")
      : "  (none)"

  return `Week: ${d.weekStart} → ${d.weekEnd}
Points earned: ${d.pointsEarned}
Tasks completed: ${d.tasksCompleted}
Current streak: ${d.currentStreak} days
Best day: ${d.bestDay ?? "none"}
Most active pillar: ${d.mostActivePillar ? `${d.mostActivePillar.icon} ${d.mostActivePillar.name}` : "none"}
Least active pillar: ${d.leastActivePillar ? `${d.leastActivePillar.icon} ${d.leastActivePillar.name}` : "none"}
Balance score: ${d.balanceScore ?? "N/A"}/100

Effort vs target:
${effortLines || "  (no pillar goals set)"}

Neglected pillars (5+ days no activity):
${neglectedLines}

Write the reflection paragraph now.`
}

/**
 * Generates a narrative for a completed week.
 * Returns null if the API is unavailable — callers should degrade gracefully
 * (show stats without narrative rather than blocking the page).
 */
export async function generateWeeklyNarrative(input: NarrativeInput): Promise<string | null> {
  return geminiText(SYSTEM_PROMPT, buildPrompt(input), {
    temperature: 0.6,
    maxOutputTokens: 180,
  })
}
