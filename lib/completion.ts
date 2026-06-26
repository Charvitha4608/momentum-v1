// Classifies WHEN a target was finished relative to the day it was planned for
// (`originalDate`), so the UI can distinguish "done early" from "done late"
// rather than lumping every off-day completion together as "late".
//
// `completedDate` is the real day the box was checked (set in toggleTarget),
// independent of which day's view it was checked from. So finishing tomorrow's
// task today reads as "ahead", and clearing a carried-over backlog task reads
// as "late". Incomplete (or legacy null-completedDate) rows return null.

export type CompletionStatus = "ahead" | "on-time" | "late" | null

export function completionStatus(t: {
  completed: boolean
  completedDate: string | null
  originalDate: string
}): CompletionStatus {
  if (!t.completed || !t.completedDate) return null
  if (t.completedDate < t.originalDate) return "ahead"
  if (t.completedDate === t.originalDate) return "on-time"
  return "late"
}

// Presentation for each status: a short label and a Tailwind text-color class,
// matching the existing palette (text-amber-500 / text-emerald-500 are already
// used in target-list). Indigo marks "ahead" as a distinct, positive state.
export const COMPLETION_META: Record<Exclude<CompletionStatus, null>, { label: string; textClass: string }> = {
  ahead: { label: "Ahead", textClass: "text-indigo-400" },
  "on-time": { label: "On time", textClass: "text-emerald-500" },
  late: { label: "Late", textClass: "text-amber-500" },
}
