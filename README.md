# Momentum

> A personal growth operating system — not just another task manager.

Momentum helps you answer the questions that actually matter:
**What am I working on? What have I been neglecting? Am I progressing toward my goals? What am I becoming?**

---

## What Is Momentum?

Most productivity apps track tasks. Momentum tracks **who you are becoming**.

Every task you complete belongs to a **Pillar** — a domain of your life you are actively investing in (DSA, Gym, Reading, Projects, etc.). Over time, Momentum builds a picture of how you are allocating your effort, where you are excelling, and what you are neglecting — giving you the clarity to grow intentionally.

### AI Planner — Scheduling for Poor Planners
Tell Momentum how much free time you actually have, and let Gemini lay out your day or week.

- **Availability system** — set default free hours per weekday and per weekend day, override any specific date ("today I only have 2 hours"), and quick-edit today's hours straight from the dashboard
- **Task scheduling data** — give a target a duration estimate and a preferred time of day (morning / afternoon / evening); the planner can also fill in a deadline by asking
- **Hybrid planner** — deterministic logic enforces the hard constraints (your hours, deadlines, recurrence) while Gemini handles prioritization and balance-aware judgment, drawing on your desired-vs-actual pillar effort and neglected-pillar signals
- **Agentic clarifying questions** — when a task's duration or deadline is missing, the planner asks with quick-reply chips instead of free text, and decides on its own when it has enough to plan
- **Review & interact** — proposed items appear as draggable cards on the week grid with an AI badge; accept, edit, reject, or drag any item to another day. Manual edits always win
- **Learns your patterns** — every accept / edit / reject is logged and fed back into future prompts (e.g. "you always move Gym to the evening")
- **Works without a key** — if `GEMINI_API_KEY` is unset, a transparent heuristic planner produces the same result so the feature still runs end-to-end

Open it from **Calendar → Planner** or the **Plan my week** button on the dashboard.

---

## Features

### Daily Dashboard
- Create and complete **daily targets** organized by pillar
- View your **weekly score** and **streaks** at a glance
- **Backlog** for tasks you didn't finish — nothing gets lost
- Live **leaderboard** to stay competitive with friends

### Pillars System
- Define the areas of your life you want to invest in
- Assign each task to a pillar (e.g. 💻 DSA, 🏋 Gym, 📚 Reading, 🚀 Projects)
- Track effort distribution across pillars over time

### Recurring Tasks
- Set tasks as **Daily**, **Weekly**, or **Custom** (e.g. every 3 days)
- Recurring tasks regenerate automatically — set it once, stay consistent

### Calendar — Four Views
| View | Purpose |
|------|---------|
| **Month View** | Visual heatmap of daily completion |
| **Pillars View** | See which pillars you completed or missed each day |
| **Week View** | TickTick-style weekly breakdown with pillar colors |
| **Planner View** | AI-proposed schedule as draggable cards across the week |

### Goals Page
- Set **Pillar Goals** (e.g. 500 DSA points/month, 20 Gym sessions/month)
- Set **Long-Term Goals** with deadlines (e.g. Finish NeetCode 150 by Dec 31)
- Automatic progress tracking and deadline reminders (7 days, 3 days, 1 day before)

### Reflection Page
Compare **desired effort vs actual effort** across your pillars.

```
Desired: DSA 40% | Gym 20% | OS 20% | Reading 20%
Actual:  DSA 50% | Gym 5%  | OS 30% | Reading 15%
```

- **Balance Score** (0–100) — how evenly you are investing across pillars
- **Weekly & Monthly Breakdown** with most/least active pillar
- **Neglected Pillar Alerts** — notified if you haven't touched a pillar in 5+ days
- **Weekly Reviews** auto-generated every Sunday: points, tasks, streak, best day

### Friends & Social
- Add friends and see their progress
- **All-time Leaderboard** and **Weekly Leaderboard** (resets every week)
- **Friend Profiles** showing streak, total points, top pillars, badges
- **Challenges** — compete together on sprints (7 Day DSA Sprint, 30 Day Gym Challenge, etc.)

### Achievements & Badges
Earned through consistency, not volume:

| Achievement | Trigger |
|------------|---------|
| 🔥 30 Day Streak | 30 consecutive active days |
| ⚡ Perfect Week | All targets completed in a week |
| 🏋 Gym Champion | Gym goal consistently achieved |
| 💻 DSA Master | DSA milestones reached |
| 🎯 Goal Crusher | Long-term goal completed |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Animations | Framer Motion |
| Auth | Better Auth |
| ORM | Drizzle ORM |
| Database | PostgreSQL (Neon recommended) |
| Deployment | Vercel |

---

## Getting Started

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd target-completion-app
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Set up environment variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

```env
# PostgreSQL connection string (Neon recommended — use a pooled connection string)
DATABASE_URL="postgresql://user:password@host/dbname?sslmode=require"

# Random 32+ byte secret for Better Auth session signing
# Generate with: openssl rand -base64 32
BETTER_AUTH_SECRET=""

# Base URL of your app
BETTER_AUTH_URL="http://localhost:3000"

# Optional — AI Planner (Google Gemini, free tier). Without a key, a heuristic fallback is used.
GEMINI_API_KEY=""
GEMINI_MODEL="gemini-2.5-flash"
```

### 4. Run database migrations

```bash
pnpm db:migrate
```

### 5. Start the development server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Database Commands

| Command | Description |
|---------|-------------|
| `pnpm db:generate` | Generate migration files from schema changes |
| `pnpm db:migrate` | Apply pending migrations to the database |
| `pnpm db:push` | Push schema directly (dev only) |
| `pnpm db:studio` | Open Drizzle Studio to browse your database |

---

## Project Structure

```
app/
├── dashboard/        # Daily targets + leaderboard
├── calendar/         # Month, Week, Pillars views
├── goals/            # Pillar goals + long-term goals
├── reflection/       # Balance score + effort analytics
├── friends/          # Friends list + challenges
├── notifications/    # All notifications
└── profile/          # User profile + badges

components/           # Reusable UI components
lib/                  # Auth, DB, utilities
drizzle/              # Schema + migration files
```

---

## Design Philosophy

Momentum is:
- **Minimal** — no clutter, no noise
- **Dark themed** — easy on the eyes for long sessions
- **Not childish** — designed for serious, intentional people
- **Not overly gamified** — points and streaks serve a purpose, not a gimmick

Inspired by the design sensibility of Linear, Vercel, and Notion.

---

## Deployment

Momentum is built to deploy on **Vercel** with zero configuration. Push to `main` and your latest version goes live automatically.

For the database, [Neon](https://neon.tech) is the recommended provider — serverless PostgreSQL that works seamlessly with Vercel.
