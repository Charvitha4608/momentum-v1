import { pgTable, text, timestamp, boolean, serial, integer, real, unique } from "drizzle-orm/pg-core"

// --- Better Auth required tables -------------------------------------------
// Column names are camelCase to match Better Auth's defaults. Do not rename.

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  // App fields (additive, safe alongside Better Auth's managed columns).
  emoji: text("emoji").notNull().default("🎯"),
  bestStreak: integer("bestStreak").notNull().default(0),
})

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
})

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
})

// --- App tables ------------------------------------------------------------

// A pillar is a life area a user invests effort into (DSA, Gym, Reading...).
// Every target belongs to exactly one pillar. Archiving hides a pillar from
// pickers without deleting its history.
export const pillars = pgTable("pillars", {
  id: serial("id").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  icon: text("icon").notNull(),
  color: text("color").notNull(),
  archived: boolean("archived").notNull().default(false),
  sortOrder: integer("sortOrder").notNull().default(0),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

// A template that automatically generates target rows on the days it's due.
// `daysOfWeek` is a JSON-encoded array of 0-6 (Sun-Sat) used when
// frequency = 'weekly'. `intervalDays`/`anchorDate` are used when
// frequency = 'custom' ("every N days").
export const recurringTasks = pgTable("recurring_tasks", {
  id: serial("id").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  pillarId: integer("pillarId")
    .notNull()
    .references(() => pillars.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  points: integer("points").notNull().default(10),
  frequency: text("frequency").notNull(), // 'daily' | 'weekly' | 'custom'
  daysOfWeek: text("daysOfWeek"), // JSON array, e.g. "[1,3,5]" (weekly)
  intervalDays: integer("intervalDays"), // custom: every N days
  anchorDate: text("anchorDate").notNull(), // YYYY-MM-DD, reference date for custom interval
  endDate: text("endDate"), // YYYY-MM-DD inclusive last day this template generates targets (null = open-ended)
  active: boolean("active").notNull().default(true),
  // `quantity` is the units of work each generated target represents (e.g. "5
  // problems"), inherited by every generated target. `longTermGoalId` optionally
  // ties those targets to a long-term goal so each completed session advances it
  // — this is what lets a "do 50 questions in 2 weeks" goal be distributed into a
  // repeating ~N-per-session task that finishes the total by the deadline.
  quantity: integer("quantity").notNull().default(1),
  longTermGoalId: integer("longTermGoalId").references(() => longTermGoals.id, { onDelete: "set null" }),
  // Scheduling hints inherited by every generated target, consumed by the AI
  // Planner. `durationMinutes` is the rough effort estimate; `preferredTimeOfDay`
  // is one of 'morning' | 'afternoon' | 'evening' (null = no preference).
  durationMinutes: integer("durationMinutes"),
  preferredTimeOfDay: text("preferredTimeOfDay"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

// A single daily target / checklist item. Each row is its own checkbox.
// `date` is the currently active day (carry-over moves unfinished targets
// forward by updating this). `originalDate` is set once at creation and never
// mutated, preserving history/analytics for the day the target was created.
export const targets = pgTable("targets", {
  id: serial("id").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  completed: boolean("completed").notNull().default(false),
  completedDate: text("completedDate"), // YYYY-MM-DD, the day the task was actually marked done (null if incomplete)
  date: text("date").notNull(), // YYYY-MM-DD, current active day
  originalDate: text("originalDate").notNull(), // YYYY-MM-DD, creation day (immutable)
  points: integer("points").notNull().default(10),
  sortOrder: integer("sortOrder").notNull().default(0),
  pillarId: integer("pillarId")
    .notNull()
    .references(() => pillars.id, { onDelete: "cascade" }),
  recurringTaskId: integer("recurringTaskId").references(() => recurringTasks.id, { onDelete: "set null" }),
  // --- Effort & time tracking ---------------------------------------------
  // `quantity` is how many units of work this target represents (e.g. "5
  // problems"); it's what counts toward a linked long-term goal's progress.
  // `estimatedMinutes` is the user's up-front time guess; `actualMinutes` is
  // the time entered when the target is marked complete. `longTermGoalId`
  // optionally ties this target to a long-term goal so completing it advances
  // that goal by `quantity`.
  quantity: integer("quantity").notNull().default(1),
  estimatedMinutes: integer("estimatedMinutes"),
  actualMinutes: integer("actualMinutes"),
  longTermGoalId: integer("longTermGoalId").references(() => longTermGoals.id, { onDelete: "set null" }),
  // --- AI Planner scheduling metadata -------------------------------------
  // `durationMinutes` is the user's rough effort estimate for this task; the
  // planner uses it to pack tasks into available hours. `preferredTimeOfDay`
  // ('morning' | 'afternoon' | 'evening', null = any) is a soft placement
  // hint. `deadline` (YYYY-MM-DD) is the latest day the task should be
  // scheduled by; it can be set manually or filled in from the planner's
  // clarifying question. `scheduledStart` (HH:MM) is the concrete start time
  // the user accepted from an AI proposal, surfaced in the week/planner views.
  durationMinutes: integer("durationMinutes"),
  preferredTimeOfDay: text("preferredTimeOfDay"),
  deadline: text("deadline"),
  scheduledStart: text("scheduledStart"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

// Friend connections via email invite. status: 'pending' | 'accepted'.
export const friendships = pgTable("friendships", {
  id: serial("id").primaryKey(),
  requesterId: text("requesterId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  addresseeId: text("addresseeId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

// In-app notifications (friend requests, accepted requests, completed days,
// overtaken on the leaderboard, etc.). Retained indefinitely; read/unread
// status is tracked per-notification.
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  message: text("message").notNull(),
  // Optional pointer to a related row (e.g. friendships.id for a
  // "friend_request" notification), so the notification UI can act on it
  // directly (Accept/Reject) without a separate lookup.
  relatedId: integer("relatedId"),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

// Frozen per-day snapshot of a user's targets, used as the source of truth
// for the history calendar, daily score, and streak calculations -
// decoupled from `targets.date`, which carry-over mutates.
export const dailyStats = pgTable(
  "daily_stats",
  {
    id: serial("id").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    date: text("date").notNull(), // YYYY-MM-DD
    totalTargets: integer("totalTargets").notNull().default(0),
    completedTargets: integer("completedTargets").notNull().default(0),
    allCompleted: boolean("allCompleted").notNull().default(false),
    pointsEarned: integer("pointsEarned").notNull().default(0),
    dailyScore: real("dailyScore").notNull().default(0),
  },
  (table) => [unique("daily_stats_user_date_unique").on(table.userId, table.date)]
)

// A monthly target for effort invested in a pillar - either a points total
// or a number of completed-task "sessions". Drives the Goals page progress
// bars and the Reflection page's desired-vs-actual effort comparison.
export const pillarGoals = pgTable("pillar_goals", {
  id: serial("id").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  pillarId: integer("pillarId")
    .notNull()
    .references(() => pillars.id, { onDelete: "cascade" }),
  metric: text("metric").notNull(), // 'points' | 'sessions'
  targetValue: integer("targetValue").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

// A multi-week/month goal tied to one pillar (e.g. "Finish NeetCode 150").
// Progress is computed automatically as the count of completed targets in
// `pillarId` created on/after this row's `createdAt`, compared to `targetValue`.
export const longTermGoals = pgTable("long_term_goals", {
  id: serial("id").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  pillarId: integer("pillarId")
    .notNull()
    .references(() => pillars.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  targetValue: integer("targetValue").notNull(),
  deadline: text("deadline").notNull(), // YYYY-MM-DD
  completed: boolean("completed").notNull().default(false),
  reminded7: boolean("reminded7").notNull().default(false),
  reminded3: boolean("reminded3").notNull().default(false),
  reminded1: boolean("reminded1").notNull().default(false),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

// A frozen summary of one Sunday-Saturday week, generated once the week ends.
// Powers the Reflection page's "revisit previous reviews" history.
export const weeklyReviews = pgTable(
  "weekly_reviews",
  {
    id: serial("id").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    weekStart: text("weekStart").notNull(), // YYYY-MM-DD, Sunday
    weekEnd: text("weekEnd").notNull(), // YYYY-MM-DD, Saturday
    pointsEarned: integer("pointsEarned").notNull().default(0),
    tasksCompleted: integer("tasksCompleted").notNull().default(0),
    mostActivePillarId: integer("mostActivePillarId").references(() => pillars.id, { onDelete: "set null" }),
    leastActivePillarId: integer("leastActivePillarId").references(() => pillars.id, { onDelete: "set null" }),
    currentStreak: integer("currentStreak").notNull().default(0),
    bestDay: text("bestDay"), // YYYY-MM-DD
    // AI-generated narrative paragraph for the Reflection page (cached per review).
    aiNarrative: text("aiNarrative"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => [unique("weekly_reviews_user_week_unique").on(table.userId, table.weekStart)]
)

// A friend challenge over a fixed date range, optionally scoped to one pillar.
export const challenges = pgTable("challenges", {
  id: serial("id").primaryKey(),
  creatorId: text("creatorId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  pillarId: integer("pillarId").references(() => pillars.id, { onDelete: "set null" }),
  metric: text("metric").notNull(), // 'points' | 'tasks'
  startDate: text("startDate").notNull(), // YYYY-MM-DD
  endDate: text("endDate").notNull(), // YYYY-MM-DD
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const challengeParticipants = pgTable(
  "challenge_participants",
  {
    id: serial("id").primaryKey(),
    challengeId: integer("challengeId")
      .notNull()
      .references(() => challenges.id, { onDelete: "cascade" }),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joinedAt").notNull().defaultNow(),
  },
  (table) => [unique("challenge_participants_challenge_user_unique").on(table.challengeId, table.userId)]
)

// Permanent record of an unlocked achievement or profile badge. `key` is a
// catalog entry id from lib/achievements.ts (either a fixed key or a
// per-pillar key like "pillar_master_12").
export const userUnlocks = pgTable(
  "user_unlocks",
  {
    id: serial("id").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    kind: text("kind").notNull(), // 'achievement' | 'badge'
    unlockedAt: timestamp("unlockedAt").notNull().defaultNow(),
  },
  (table) => [unique("user_unlocks_user_key_unique").on(table.userId, table.key)]
)

// ===========================================================================
// AI PLANNER ("scheduling for poor planners")
// ===========================================================================

// One row per user: their default free-time budget. The simple model is
// `weekdayHours` / `weekendHours`; `weeklyBlocks` optionally holds a more
// precise weekly time-block grid as JSON (array of { day:0-6, start:"HH:MM",
// end:"HH:MM" }). The planner prefers the grid when present, otherwise falls
// back to the per-day-type hour budgets.
export const availability = pgTable("availability", {
  id: serial("id").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" })
    .unique(),
  weekdayHours: real("weekdayHours").notNull().default(3),
  weekendHours: real("weekendHours").notNull().default(5),
  // Default earliest hour work can be scheduled (0-23) and latest (1-24);
  // used by the deterministic packer to lay tasks onto a concrete timeline.
  dayStartHour: integer("dayStartHour").notNull().default(9),
  dayEndHour: integer("dayEndHour").notNull().default(22),
  weeklyBlocks: text("weeklyBlocks"), // JSON grid, optional
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

// Per-date override of the default budget ("today I only have 2 hours").
// Takes priority over `availability` for its single date.
export const availabilityOverride = pgTable(
  "availability_override",
  {
    id: serial("id").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    date: text("date").notNull(), // YYYY-MM-DD
    hours: real("hours").notNull(),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => [unique("availability_override_user_date_unique").on(table.userId, table.date)]
)

// State for one multi-turn planning run. The agentic loop persists itself
// here so a clarifying question can pause the run and resume once the user
// answers. `scope` is 'day' | 'week'; `status` is
// 'awaiting_user' | 'complete' | 'abandoned'. `messages` is the JSON
// transcript fed back to the model; `pendingQuestion` holds the current
// clarifying question + quick-reply options when status = 'awaiting_user'.
export const aiPlanningSession = pgTable("ai_planning_session", {
  id: serial("id").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  scope: text("scope").notNull(), // 'day' | 'week'
  anchorDate: text("anchorDate").notNull(), // YYYY-MM-DD the plan starts from
  status: text("status").notNull().default("awaiting_user"),
  messages: text("messages").notNull().default("[]"), // JSON transcript
  pendingQuestion: text("pendingQuestion"), // JSON { text, options[], field, taskRef }
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

// A single proposed (or accepted/edited/rejected) scheduled item. The Planner
// view renders these as draggable AI cards. `targetId` links to an existing
// target when the item schedules real work; it is null for a brand-new
// suggestion. `status`: 'proposed' | 'accepted' | 'edited' | 'rejected'.
// `aiGenerated` distinguishes model output from manual edits/additions.
export const aiSchedule = pgTable("ai_schedule", {
  id: serial("id").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  sessionId: integer("sessionId").references(() => aiPlanningSession.id, { onDelete: "set null" }),
  targetId: integer("targetId").references(() => targets.id, { onDelete: "cascade" }),
  pillarId: integer("pillarId").references(() => pillars.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  date: text("date").notNull(), // YYYY-MM-DD the item is scheduled on
  startTime: text("startTime"), // HH:MM
  endTime: text("endTime"), // HH:MM
  durationMinutes: integer("durationMinutes").notNull().default(30),
  timeOfDay: text("timeOfDay"), // 'morning' | 'afternoon' | 'evening' | 'any'
  reasoning: text("reasoning"), // short "why scheduled here" explanation
  priority: integer("priority").notNull().default(0),
  status: text("status").notNull().default("proposed"),
  aiGenerated: boolean("aiGenerated").notNull().default(true),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

// Append-only log of how the user reacted to each AI suggestion. Feeds the
// personalization signal that's summarized back into future planning prompts
// (e.g. detecting "user always moves Gym to evening").
export const aiScheduleFeedback = pgTable("ai_schedule_feedback", {
  id: serial("id").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  scheduleId: integer("scheduleId").references(() => aiSchedule.id, { onDelete: "set null" }),
  targetId: integer("targetId").references(() => targets.id, { onDelete: "set null" }),
  pillarId: integer("pillarId").references(() => pillars.id, { onDelete: "set null" }),
  action: text("action").notNull(), // 'accept' | 'edit' | 'reject'
  fromDate: text("fromDate"),
  toDate: text("toDate"),
  fromTimeOfDay: text("fromTimeOfDay"),
  toTimeOfDay: text("toTimeOfDay"),
  fromStart: text("fromStart"),
  toStart: text("toStart"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})
