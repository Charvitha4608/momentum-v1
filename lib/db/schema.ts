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
  active: boolean("active").notNull().default(true),
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
