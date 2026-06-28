// lib/ai/digest.ts
//
// Generates a one-to-two sentence "morning briefing" for the dashboard.
// Called server-side on page load; cached for the calendar day so the API
// isn't hit on every refresh.  Falls back to a deterministic summary when
// Gemini is unavailable.
//
// Deliberate constraints:
//   - Max 30 words.  It renders as a single line under the greeting.
//   - No emojis unless they come from pillar names.
//   - No cheerleading.  Just the facts + one nudge.

import { geminiText } from "@/lib/ai/gemini"

export interface DigestInput {
  today: string            // YYYY-MM-DD
  todayTargetCount: number
  completedToday: number
  streak: number
  neglectedPillars: { pillarName: string; daysSinceLastActivity: number }[]
  longTermGoals: {
    title: string
    progress: number       // 0-100 percent
    daysUntilDeadline: number
  }[]
  balanceScore: number | null
}

const SYSTEM_PROMPT = `You write a one-sentence morning briefing (max 30 words) for a productivity app dashboard.

Rules:
- Mention the single most important thing: open tasks, a neglected pillar, a goal falling behind, or a strong streak.
- Be specific (name the pillar or goal). Never say "some areas" or "your goals".
- No punctuation at the end (no period). Plain text only.
- No greetings, no "today", no "you should". Start directly with the observation.
- Tone: concise, honest, zero fluff.`

function buildPrompt(d: DigestInput): string {
  const openTasks = d.todayTargetCount - d.completedToday
  const goalsAtRisk = d.longTermGoals.filter((g) => g.daysUntilDeadline <= 14 && g.progress < 60)
  const topNeglect = d.neglectedPillars.sort((a, b) => b.daysSinceLastActivity - a.daysSinceLastActivity)[0]

  return `Today: ${openTasks} open task(s), ${d.completedToday} done so far.
Streak: ${d.streak} days.
Balance score: ${d.balanceScore ?? "N/A"}/100.
Most neglected: ${topNeglect ? `${topNeglect.pillarName} (${topNeglect.daysSinceLastActivity}d idle)` : "none"}.
Goals at risk (due ≤14d, <60% done): ${goalsAtRisk.map((g) => `${g.title} (${g.progress}%, ${g.daysUntilDeadline}d left)`).join("; ") || "none"}.

Write the one-sentence briefing now.`
}

/**
 * Heuristic fallback — no API key needed.
 * Picks the single most urgent signal and phrases it directly.
 */
function heuristicDigest(d: DigestInput): string {
  const topNeglect = d.neglectedPillars.sort((a, b) => b.daysSinceLastActivity - a.daysSinceLastActivity)[0]
  const goalsAtRisk = d.longTermGoals.filter((g) => g.daysUntilDeadline <= 14 && g.progress < 60)
  const openTasks = d.todayTargetCount - d.completedToday

  if (goalsAtRisk.length > 0) {
    const g = goalsAtRisk[0]
    return `${g.title} is ${g.progress}% done with ${g.daysUntilDeadline} days left`
  }
  if (topNeglect) {
    return `${topNeglect.pillarName} hasn't been touched in ${topNeglect.daysSinceLastActivity} days`
  }
  if (openTasks > 0) {
    return `${openTasks} task${openTasks > 1 ? "s" : ""} left for today`
  }
  if (d.streak >= 3) {
    return `${d.streak}-day streak — don't break it`
  }
  return "Set your targets and build the habit"
}

/**
 * Returns a short ambient briefing string for the dashboard header.
 * Never throws — always returns something.
 */
export async function getDailyDigest(input: DigestInput): Promise<string> {
  const ai = await geminiText(SYSTEM_PROMPT, buildPrompt(input), {
    temperature: 0.4,
    maxOutputTokens: 60,
  })
  return ai ?? heuristicDigest(input)
}
