"use client"

import { useLinkStatus } from "next/link"
import { Loader2 } from "lucide-react"

/**
 * Renders a nav item's icon, swapping to a spinner while the link's target
 * route is loading. Must be rendered inside a `<Link>` (useLinkStatus reads
 * the pending state of its nearest ancestor link).
 */
export function NavIcon({
  icon: Icon,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>
  className?: string
}) {
  const { pending } = useLinkStatus()
  if (pending) return <Loader2 className={className + " animate-spin"} />
  return <Icon className={className} />
}
