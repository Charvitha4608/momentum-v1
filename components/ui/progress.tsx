import { Progress as ProgressPrimitive } from "@base-ui/react/progress"

import { cn } from "@/lib/utils"

function Progress({
  className,
  value,
  ...props
}: ProgressPrimitive.Root.Props) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      value={value}
      className={cn("block w-full", className)}
      {...props}
    >
      {/* COLOR: progress track is muted, filled portion is primary (Dashboard + Leaderboard friend profile) */}
      <ProgressPrimitive.Track
        data-slot="progress-track"
        className="block h-2 w-full overflow-hidden rounded-full bg-muted"
      >
        <ProgressPrimitive.Indicator
          data-slot="progress-indicator"
          className="block h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
        />
      </ProgressPrimitive.Track>
    </ProgressPrimitive.Root>
  )
}

export { Progress }
