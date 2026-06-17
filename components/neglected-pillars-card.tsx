import { AlertTriangle } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import type { NeglectedPillar } from "@/app/actions/reflection"

export function NeglectedPillarsCard({ pillars }: { pillars: NeglectedPillar[] }) {
  return (
    <Card>
      <CardContent>
        <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold">
          {/* COLOR: warning icon uses destructive, signaling pillars that need attention */}
          <AlertTriangle className="size-4.5 text-destructive" />
          Neglected Pillars
        </h2>
        <p className="mb-4 text-xs text-muted-foreground">Pillars with no completed targets in 5+ days.</p>

        {pillars.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing neglected — nice work staying consistent 🎉</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {pillars.map((p) => (
              <li key={p.pillarId} className="flex items-center gap-2.5 rounded-lg bg-secondary/40 px-3 py-2.5">
                <span aria-hidden>{p.pillarIcon}</span>
                <span className="text-sm text-foreground">{p.message}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
