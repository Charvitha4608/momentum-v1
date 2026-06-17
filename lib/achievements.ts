/** A single achievement or badge that a user can unlock. */
export type UnlockDef = {
  key: string
  kind: "achievement" | "badge"
  label: string
  description: string
  icon: string
}

/** Snapshot of a user's stats, assembled by app/actions/achievements.ts from existing data. */
export type AchievementContext = {
  bestStreak: number
  currentStreak: number
  perfectWeekCount: number
  pillars: { id: number; name: string; icon: string; completedCount: number }[]
  /** Active pillar goals at >=100% of their target this month. */
  metPillarGoals: { pillarId: number; pillarName: string; pillarIcon: string }[]
  /** True if every active pillar goal is >=100% this month (and at least one exists). */
  allPillarGoalsMetThisMonth: boolean
  /** Long-term goals whose `completed` flag is true. */
  completedLongTermGoals: { id: number; title: string }[]
  /** True if at least one recurring task has had 30 days of perfect compliance. */
  recurringCompliance30: boolean
  neglectedPillarCount: number
}

/** Minimum completed tasks in a pillar to earn the "{icon} {Name} Master" badge. */
export const PILLAR_MASTER_THRESHOLD = 100

/** Fixed achievements and badges, independent of the user's specific pillars/goals. */
export const FIXED_UNLOCKS: (UnlockDef & { check: (ctx: AchievementContext) => boolean })[] = [
  {
    key: "first_perfect_week",
    kind: "achievement",
    label: "First Perfect Week",
    description: "Complete every target on every day of a week.",
    icon: "⚡",
    check: (ctx) => ctx.perfectWeekCount >= 1,
  },
  {
    key: "five_perfect_weeks",
    kind: "achievement",
    label: "5 Perfect Weeks",
    description: "Complete every target on every day of a week, 5 times.",
    icon: "⚡",
    check: (ctx) => ctx.perfectWeekCount >= 5,
  },
  {
    key: "ten_perfect_weeks",
    kind: "achievement",
    label: "10 Perfect Weeks",
    description: "Complete every target on every day of a week, 10 times.",
    icon: "⚡",
    check: (ctx) => ctx.perfectWeekCount >= 10,
  },
  {
    key: "streak_30",
    kind: "achievement",
    label: "30 Day Streak",
    description: "Reach a 30-day completion streak.",
    icon: "🔥",
    check: (ctx) => ctx.bestStreak >= 30,
  },
  {
    key: "streak_100",
    kind: "achievement",
    label: "100 Day Streak",
    description: "Reach a 100-day completion streak.",
    icon: "🔥",
    check: (ctx) => ctx.bestStreak >= 100,
  },
  {
    key: "monthly_goal_achieved",
    kind: "achievement",
    label: "Monthly Goal Achieved",
    description: "Reach every active pillar goal in the same month.",
    icon: "🏆",
    check: (ctx) => ctx.allPillarGoalsMetThisMonth,
  },
  {
    key: "recurring_consistency_30",
    kind: "achievement",
    label: "Never Missed A Recurring Task For 30 Days",
    description: "Complete a recurring task every time it was due for 30 days straight.",
    icon: "✅",
    check: (ctx) => ctx.recurringCompliance30,
  },
  {
    key: "badge_streak_30",
    kind: "badge",
    label: "30 Day Streak",
    description: "Reached a 30-day completion streak.",
    icon: "🔥",
    check: (ctx) => ctx.bestStreak >= 30,
  },
  {
    key: "badge_perfect_week",
    kind: "badge",
    label: "Perfect Week",
    description: "Completed every target on every day of a week.",
    icon: "⚡",
    check: (ctx) => ctx.perfectWeekCount >= 1,
  },
  {
    key: "badge_goal_crusher",
    kind: "badge",
    label: "Goal Crusher",
    description: "Completed a pillar goal or long-term goal.",
    icon: "🎯",
    check: (ctx) => ctx.metPillarGoals.length > 0 || ctx.completedLongTermGoals.length > 0,
  },
  {
    key: "badge_consistent_learner",
    kind: "badge",
    label: "Consistent Learner",
    description: "Maintained a 7+ day streak with no neglected pillars.",
    icon: "📚",
    check: (ctx) => ctx.currentStreak >= 7 && ctx.neglectedPillarCount === 0,
  },
]

/** The "{icon} {Name} Master" badge for a specific pillar, unlocked at PILLAR_MASTER_THRESHOLD completed tasks. */
export function pillarMasterUnlock(pillar: { id: number; name: string; icon: string }): UnlockDef {
  return {
    key: `pillar_master_${pillar.id}`,
    kind: "badge",
    label: `${pillar.icon} ${pillar.name} Master`,
    description: `Complete ${PILLAR_MASTER_THRESHOLD} tasks in ${pillar.name}.`,
    icon: pillar.icon,
  }
}

/** The "{Pillar} Goal Completed" achievement for a specific pillar. */
export function pillarGoalUnlock(pillar: { id: number; name: string; icon: string }): UnlockDef {
  return {
    key: `pillar_goal_${pillar.id}`,
    kind: "achievement",
    label: `${pillar.name} Goal Completed`,
    description: `Reached your monthly ${pillar.name} goal.`,
    icon: pillar.icon,
  }
}

/** The "{Goal title} Goal Achieved" achievement for a specific long-term goal. */
export function longTermGoalUnlock(goal: { id: number; title: string }): UnlockDef {
  return {
    key: `long_term_goal_${goal.id}`,
    kind: "achievement",
    label: `${goal.title} Goal Achieved`,
    description: `Completed the long-term goal "${goal.title}".`,
    icon: "🏁",
  }
}

/** All catalog entries (fixed + per-pillar masters) that are currently met, for unlocking. */
export function getNewlyMetUnlocks(ctx: AchievementContext): UnlockDef[] {
  const unlocks: UnlockDef[] = FIXED_UNLOCKS.filter((u) => u.check(ctx))

  for (const pillar of ctx.pillars) {
    if (pillar.completedCount >= PILLAR_MASTER_THRESHOLD) {
      unlocks.push(pillarMasterUnlock(pillar))
    }
  }
  for (const pillar of ctx.metPillarGoals) {
    unlocks.push(pillarGoalUnlock({ id: pillar.pillarId, name: pillar.pillarName, icon: pillar.pillarIcon }))
  }
  for (const goal of ctx.completedLongTermGoals) {
    unlocks.push(longTermGoalUnlock(goal))
  }

  return unlocks
}
