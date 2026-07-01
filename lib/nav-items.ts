import { Calendar, CircleHelp, CircleUser, Compass, Flag, Target, Users } from "lucide-react"

export type ActivePath = "/" | "/calendar" | "/goals" | "/reflection" | "/friends" | "/notifications" | "/profile" | "/help"

// Notifications is intentionally not in this list — it lives in the
// NotificationBell (mobile top bar / desktop sidebar footer) instead.
export const navItems: { href: ActivePath; label: string; icon: typeof Target }[] = [
  { href: "/", label: "Dashboard", icon: Target },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/goals", label: "Goals", icon: Flag },
  { href: "/reflection", label: "Reflection", icon: Compass },
  { href: "/friends", label: "Friends", icon: Users },
  { href: "/profile", label: "Profile", icon: CircleUser },
  { href: "/help", label: "Help", icon: CircleHelp },
]
