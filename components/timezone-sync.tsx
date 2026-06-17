"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { TIMEZONE_COOKIE } from "@/lib/timezone"

function readCookie(name: string): string | undefined {
  return document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))
    ?.split("=")[1]
}

/**
 * Detects the visitor's IANA timezone and stores it in a cookie so server
 * components can compute "today" in local time. Refreshes the page once if
 * the stored timezone is missing or stale.
 */
export function TimezoneSync() {
  const router = useRouter()

  useEffect(() => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (readCookie(TIMEZONE_COOKIE) !== timeZone) {
      document.cookie = `${TIMEZONE_COOKIE}=${timeZone}; path=/; max-age=31536000; samesite=lax`
      router.refresh()
    }
  }, [router])

  return null
}
