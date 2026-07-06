import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { WeeklyFocusPillar, MonthlyFocusPillar } from "@/lib/focus-stats"

// ---------------------------------------------------------------------------
// Shared presentation for the Calendar "Focus by pillar" heatmaps. The weekly
// card renders 7 fixed cells (Mon→Sun); the monthly card renders n dynamic
// week-bucket cells. Both reuse PillarHeatmapRow — cell count, height and gap
// are parameterized. Intensity is encoded as opacity of the pillar's own color,
// scaled PER ROW (a pillar's busiest cell = full opacity). No hardcoded colors.
// ---------------------------------------------------------------------------

/** "${h}h ${mm}m" from a second count (rounded to the nearest minute). */
function formatHM(sec: number): string {
  const totalMin = Math.round(sec / 60)
  const h = Math.floor(totalMin / 60)
  const mm = totalMin % 60
  return `${h}h ${mm}m`
}

/** Opacity for one cell, scaled against its row's busiest cell. */
function cellOpacity(sec: number, max: number): number {
  if (max <= 0 || sec <= 0) return 0.08
  return 0.3 + 0.7 * (sec / max)
}

function PillarHeatmapRow({
  name,
  color,
  cells,
  total,
  cellHeightClass,
  gapClass,
}: {
  name: string
  color: string
  /** Seconds per cell. */
  cells: number[]
  /** Row total seconds. */
  total: number
  cellHeightClass: string
  gapClass: string
}) {
  const max = cells.reduce((m, s) => Math.max(m, s), 0)
  return (
    <div className="flex items-center gap-3">
      <div className="flex w-[78px] shrink-0 items-center gap-1.5">
        <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden />
        <span className="truncate text-xs">{name}</span>
      </div>
      <div className={cn("flex flex-1", gapClass)}>
        {cells.map((sec, i) => (
          <div
            key={i}
            className={cn("flex-1 rounded-sm", cellHeightClass)}
            style={{ backgroundColor: color, opacity: cellOpacity(sec, max) }}
            title={formatHM(sec)}
          />
        ))}
      </div>
      <span className="w-14 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{formatHM(total)}</span>
    </div>
  )
}

/** Full-width weekly heatmap (Section 4b). Renders nothing when there's no focus. */
export function WeeklyFocusCard({ pillars }: { pillars: WeeklyFocusPillar[] }) {
  if (pillars.length === 0) return null
  const weekTotal = pillars.reduce((s, p) => s + p.weekTotalSec, 0)

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Focus by pillar · this week</h3>
          <span className="text-xs text-muted-foreground">Mon → Sun</span>
        </div>
        <div className="flex flex-col gap-2">
          {pillars.map((p) => (
            <PillarHeatmapRow
              key={p.pillarId}
              name={p.pillarName}
              color={p.pillarColor}
              cells={p.days.map((d) => d.totalSec)}
              total={p.weekTotalSec}
              cellHeightClass="h-4"
              gapClass="gap-1"
            />
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-border pt-2">
          <span className="text-xs text-muted-foreground">Week total</span>
          <span className="text-xs font-semibold tabular-nums">{formatHM(weekTotal)}</span>
        </div>
      </CardContent>
    </Card>
  )
}

/** Full-width monthly week-bucket heatmap (Section 5). Renders nothing when there's no focus. */
export function MonthlyFocusCard({ pillars, monthLabel }: { pillars: MonthlyFocusPillar[]; monthLabel: string }) {
  if (pillars.length === 0) return null
  const weekCount = pillars[0].weeks.length
  const monthTotal = pillars.reduce((s, p) => s + p.monthTotalSec, 0)

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Focus by pillar · this month</h3>
          <span className="text-xs text-muted-foreground">{monthLabel}</span>
        </div>

        {/* Week-label header, aligned above the cell grid. */}
        <div className="flex items-center gap-3">
          <div className="w-[78px] shrink-0" />
          <div className="flex flex-1 gap-1.5">
            {Array.from({ length: weekCount }, (_, i) => (
              <span key={i} className="flex-1 text-center text-[0.6rem] text-muted-foreground">
                W{i + 1}
              </span>
            ))}
          </div>
          <div className="w-14 shrink-0" />
        </div>

        <div className="flex flex-col gap-2">
          {pillars.map((p) => (
            <PillarHeatmapRow
              key={p.pillarId}
              name={p.pillarName}
              color={p.pillarColor}
              cells={p.weeks.map((w) => w.totalSec)}
              total={p.monthTotalSec}
              cellHeightClass="h-[18px]"
              gapClass="gap-1.5"
            />
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-border pt-2">
          <span className="text-xs text-muted-foreground">Month total</span>
          <span className="text-xs font-semibold tabular-nums">{formatHM(monthTotal)}</span>
        </div>
      </CardContent>
    </Card>
  )
}
