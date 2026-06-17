// Shared constant used by both server (lib/date.ts) and client
// (components/timezone-sync.tsx) code. Kept in its own file, free of
// "next/headers", so client components can import it without pulling in
// server-only APIs.
export const TIMEZONE_COOKIE = "tz"
