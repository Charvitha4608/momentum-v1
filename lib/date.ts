import { cookies } from "next/headers"
import { TIMEZONE_COOKIE } from "@/lib/timezone"
import { formatDateInTimeZone } from "@/lib/date-utils"

const FALLBACK_TIMEZONE = "UTC"

export { formatDateInTimeZone, shiftDateString, daysBetween, getWeekRange } from "@/lib/date-utils"

/** Reads the visitor's IANA timezone from the cookie set by <TimezoneSync>, defaulting to UTC. */
export async function getUserTimeZone(): Promise<string> {
  const store = await cookies()
  return store.get(TIMEZONE_COOKIE)?.value || FALLBACK_TIMEZONE
}

/** Today's date (YYYY-MM-DD) in the visitor's local timezone. */
export async function getToday(): Promise<string> {
  const timeZone = await getUserTimeZone()
  return formatDateInTimeZone(new Date(), timeZone)
}
