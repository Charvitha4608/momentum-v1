import { Bell, Calendar, CircleUser, Compass, Flag, Target, Users } from "lucide-react"

export type ActivePath = "/" | "/calendar" | "/goals" | "/reflection" | "/friends" | "/notifications" | "/profile"

export const navItems: { href: ActivePath; label: string; icon: typeof Target }[] = [
  { href: "/", label: "Dashboard", icon: Target },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/goals", label: "Goals", icon: Flag },
  { href: "/reflection", label: "Reflection", icon: Compass },
  { href: "/friends", label: "Friends", icon: Users },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/profile", label: "Profile", icon: CircleUser },
]
