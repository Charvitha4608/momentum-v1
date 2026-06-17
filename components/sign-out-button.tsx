"use client"

import { useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { LogOut } from "lucide-react"

export function SignOutButton() {
  const router = useRouter()
  return (
    <button
      type="button"
      onClick={async () => {
        await authClient.signOut()
        router.push("/sign-in")
        router.refresh()
      }}
      className="ml-1 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground sm:px-3"
      aria-label="Sign out"
    >
      <LogOut className="size-4" />
      <span className="hidden lg:inline">Sign out</span>
    </button>
  )
}
