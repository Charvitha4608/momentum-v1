"use client"

import { useState, useTransition } from "react"

import {
  getLongTermGoals,
  getPillarGoals,
  type LongTermGoalWithProgress,
  type PillarGoalWithProgress,
} from "@/app/actions/goals"
import { GoalFormDialog } from "@/components/goal-form-dialog"
import { LongTermGoalCard } from "@/components/long-term-goal-card"
import { PillarGoalCard } from "@/components/pillar-goal-card"
import { PillarManager } from "@/components/pillar-manager"
import type { PillarOption } from "@/components/pillar-picker"

type ManagedPillar = PillarOption & { archived: boolean }

export function GoalsBoard({
  initialPillarGoals,
  initialLongTermGoals,
  initialActivePillars,
  initialAllPillars,
  today,
}: {
  initialPillarGoals: PillarGoalWithProgress[]
  initialLongTermGoals: LongTermGoalWithProgress[]
  initialActivePillars: PillarOption[]
  initialAllPillars: ManagedPillar[]
  today: string
}) {
  const [pillarGoals, setPillarGoals] = useState(initialPillarGoals)
  const [longTermGoals, setLongTermGoals] = useState(initialLongTermGoals)
  const [activePillars, setActivePillars] = useState(initialActivePillars)
  const [refreshKey, setRefreshKey] = useState(0)
  const [, startTransition] = useTransition()

  function refreshGoals() {
    startTransition(async () => {
      const [pg, ltg] = await Promise.all([getPillarGoals(), getLongTermGoals()])
      setPillarGoals(pg)
      setLongTermGoals(ltg)
      setRefreshKey((k) => k + 1)
    })
  }

  function handlePillarCreated(pillar: PillarOption) {
    setActivePillars((prev) => [...prev, pillar])
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end">
        <GoalFormDialog
          pillars={activePillars}
          today={today}
          onPillarCreated={handlePillarCreated}
          onSaved={refreshGoals}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <PillarGoalCard key={`pillar-goals-${refreshKey}`} initialGoals={pillarGoals} />
        <LongTermGoalCard key={`long-term-goals-${refreshKey}`} initialGoals={longTermGoals} today={today} />
      </div>

      <PillarManager initialPillars={initialAllPillars} onActivePillarsChange={setActivePillars} />
    </div>
  )
}
