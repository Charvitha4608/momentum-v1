# How Momentum Works

Momentum is a personal-growth app for people who want to make steady progress on the things that matter to them. You organize your life into a handful of focus areas, set small daily goals inside each one, check them off as you go, and watch your consistency build over time. This document explains every part of the app in plain language so you can get the most out of it.

## Pillars (your focus areas)

A **pillar** is a part of your life you want to invest effort in — things like "DSA", "Gym", "Reading", or "Side Project". Pillars are the top-level buckets that everything else hangs off of. Each pillar has a name, an icon, and a color so it's easy to spot at a glance.

Every task you create lives inside exactly one pillar. This is what lets the app show you how your effort is spread across your life — how much you're doing for fitness versus learning versus rest, for example.

You can:

- **Create** as many pillars as you like.
- **Edit** a pillar's name, icon, or color at any time.
- **Reorder** your pillars to control the order they appear in.
- **Archive** a pillar you're no longer actively working on. Archiving hides the pillar from the menus where you'd pick it for a new task, but it does **not** delete anything — all the history and past tasks for that pillar stay intact. You can bring an archived pillar back at any time.

## Targets (your daily tasks)

A **target** is a single task or checklist item for a given day — one checkbox to tick off, like "Solve 3 problems" or "Run 5 km". Targets are where the day-to-day action happens.

To create a target, you give it a title and pick which pillar it belongs to. By default a new target is worth **10 points** (more on points below). When you finish it, you simply check it off.

When you create or edit a target you can optionally add a few extra details:

- **Quantity** — how many "units of work" the task represents (for example, "5 problems" or "10 pages"). If you don't set it, it counts as 1. The quantity matters mostly when the task is tied to a longer-term goal, because it's the amount that goal advances by when you finish the task.
- **Estimated time** — your up-front guess at how long the task will take.
- **Time actually spent** — when you check a task off, you can record how many minutes it actually took. If you later un-check it, that recorded time is cleared so you can enter a fresh value next time.
- **A pillar** — you can move a task to a different pillar after creating it.

You can rename a target, change its details, or delete it whenever you want.

## The day you planned it for vs. the day it's showing up

Every target quietly remembers two different days, and understanding the difference explains a lot about how the app behaves:

- **The day you originally planned it for.** This is set once, when you create the task, and it never changes. It's how the app remembers which day a task "belonged" to, so your history and statistics stay honest.
- **The day it's currently showing up on.** This can move forward if you don't finish the task (see carry-over, next). It's just where the task appears in your live to-do list right now.

For a task you create and finish on the same day, these are the same day. They only drift apart when a task rolls over to a later day unfinished.

## Carry-over (unfinished tasks follow you forward)

Momentum never lets an unfinished task silently disappear into the past. If a task from an earlier day is still not done, the app automatically **carries it over** to today so it keeps showing up in your list until you actually complete it. This happens on its own whenever you open your day — you don't have to do anything.

Two important things to know:

- Only **unfinished** tasks carry over. A task you completed stays put on the day it belonged to, so your record of that day stays accurate.
- Carrying a task forward changes only where it *shows up*, not the day it was originally planned for. That's why a past day's score reflects what you actually did that day — the unfinished tasks that moved away don't leave the old day looking falsely "complete," and they don't vanish.

## Backlog (the catch-up pile)

The **backlog** is made up of those carried-over tasks — items you planned for an earlier day that are still unfinished and have followed you into today. They're surfaced separately so you can see your catch-up pile at a glance, distinct from the things you actually planned for today.

For each backlog item you can either just check it off (it still counts, see "ahead / on-time / late" below), or use **Move to Today** to formally re-home it as a today task. Moving it to today updates the task's "originally planned for" day to today — which stops it from being flagged as overdue and shifts it out of the old day's statistics and into today's.

## Recurring tasks (habits that repeat)

A **recurring task** is a template for something you do regularly, so you don't have to re-create it by hand every time. You set it up once, and Momentum automatically drops a fresh copy into your list on each day it's due.

When you create one, you choose how often it repeats:

- **Daily** — every day.
- **Weekly** — on specific days of the week you choose (for example, Monday / Wednesday / Friday).
- **Every N days** ("custom") — a fixed rhythm like every 2 days or every 3 days, counted from the day you started it.

You can also give a recurring task an **end date**, after which it stops generating new copies — useful when the habit is only meant to last until a certain deadline. A recurring task starts producing tasks from its start date, and you can turn one off at any time, which stops future copies without touching the ones already created.

Each generated copy inherits the template's settings — its points, its quantity, its rough time estimate and preferred time of day, and any long-term goal it's linked to — so every repeat behaves consistently. The app won't create a duplicate for a day that already has that recurring task's copy.

## Ahead, on-time, and late (when you finished, not just whether)

When you complete a task, Momentum looks at the actual calendar day you checked the box and compares it to the day the task was originally planned for. This gives every completed task one of three labels:

- **Ahead** — you finished it *before* the day it was planned for. For example, knocking out tomorrow's task today.
- **On time** — you finished it *on* the day it was planned for.
- **Late** — you finished it *after* the day it was planned for. This is what a carried-over backlog task gets when you finally clear it.

This distinction lets the app celebrate getting ahead, recognize staying on schedule, and gently mark catch-up work — instead of lumping every off-day finish together. A late finish still earns you full points; it just doesn't pretend it happened on the original day.

## The calendar heatmap

The **calendar** gives you a month-at-a-glance view of your consistency. Each day is a small cell with a colored dot, and the dot's color tells you how that day went. Days are always grouped by the day a task was *originally planned for*, so the calendar reflects what you set out to do on each day.

Crucially, the calendar colors a day by **on-time** completion only — a task counts toward a day's color when it was finished *on that day*. If you carried a task forward and finished it late, it still earns its points, but it no longer turns the original day green. Green means "done on the day," not "done eventually."

The dot colors mean:

- **No dot / faint** — no tasks were planned for that day.
- **Coral (red-ish)** — none of the day's tasks were finished on time.
- **Amber** — between 1% and 49% of the day's tasks were finished on time.
- **Brand (purple)** — between 50% and 99% finished on time.
- **Green** — 100% finished on time. A perfect day.
- **Neutral "planned" tone** — a future day that already has tasks lined up. It's pending, not failed, so it never shows the red color. Today also won't show a discouraging red before you've had a chance to finish anything.

Tap any day to open it. For **today and future days** you can check tasks off and add new ones right there. **Past days** are read-only — you can review what you did (including which tasks were finished on time versus completed later, and how many points you earned) but not change them.

## Long-term goals

A **long-term goal** is a bigger target that spans weeks or months — something like "Finish NeetCode 150" or "Read 12 books." Each long-term goal is tied to one pillar, has a target amount to reach, and has a deadline.

Progress is tracked **automatically**. You link tasks to the goal (directly, or through a recurring task that feeds it), and every time you complete one of those linked tasks, the goal advances by that task's quantity. So if a task is worth 5 "questions" and you finish it, a "solve 100 questions" goal moves forward by 5. When your progress reaches the target amount, the goal is marked complete on its own.

As a deadline approaches, Momentum nudges you — you'll get a reminder at 7 days, 3 days, and 1 day left if the goal isn't done yet, each sent once.

There's a natural pairing here: a long-term goal works hand-in-hand with a recurring task. The recurring task generates a steady stream of smaller sessions, each one linked to the goal and worth a share of the total, so finishing the sessions steadily moves the goal toward the finish line by its deadline.

## Monthly pillar goals

Separately from long-term goals, you can set a **monthly effort goal** for a pillar — a target for how much you want to invest in that pillar over the current calendar month. You can measure it either as a number of **points** earned or as a number of **completed sessions** (finished tasks) in that pillar. The app fills in your actual progress against the target as the month goes on. You can have one active monthly goal per pillar at a time, so progress is never ambiguous.

## Points, daily score, and streaks

A few numbers track your momentum:

- **Points** — each task is worth points (10 by default), earned when you complete it. Your total points are the sum across every task you've ever finished.
- **Daily score** — a 0-to-10 rating of a day, based on the points you earned that day relative to how many tasks you'd planned.
- **Completion percentage** — simply how many of a day's tasks you finished, out of how many you planned.
- **Streak** — how many days in a row you've completed *all* of a day's tasks. The app also remembers your best-ever streak.

## The ⌘K command bar and AI assistant

Press **⌘K** (or click "Ask AI") anywhere in the app to open the **command bar** — a single text box where you can type a request in plain English and let the assistant help you act on it. It's the fastest way to plan, set up habits, or check what's coming up.

Here's what you can ask it to do:

- **Plan or organize your week** (the **AI Planner**). Say something like "plan my week" and the planner takes the tasks you *already have* — your open to-dos and anything carried over — and arranges them across the coming days into a sensible timetable. It works out priorities, balances your effort across pillars (leaning toward ones you've been neglecting), respects how much free time you have each day, and learns from your past tweaks (for instance, if you keep moving Gym to the evening, it starts suggesting evenings). It's a scheduler: it arranges and prioritizes the work that's already on your plate rather than inventing busywork for you.
- **Set up a repeating habit.** Say "gym mon/wed/fri" or "read 30 minutes every day" and it proposes a recurring task for you to confirm.
- **Break a goal into tasks.** Say "learn React" or "prepare for the interview" and it suggests a handful of concrete to-dos, each matched to the right pillar.
- **Plan a goal with a number and a deadline.** Say "do 50 questions in 2 weeks" or "read 12 books this year" and it figures out a realistic pace, then proposes a long-term goal plus a repeating task that spreads the work out so you finish the total by the deadline.
- **Check what's planned.** Ask "what's on Friday?", "what did I do yesterday?", or "show my week" and it simply reads back your schedule. These questions only look things up — they never change anything.

### Nothing happens without your say-so

Every action the assistant takes that would change your data follows the same careful flow: **propose → preview → confirm → apply.**

1. **Propose** — you type your request and the assistant turns it into a concrete suggestion.
2. **Preview** — it shows you exactly what it would do (the tasks, the schedule, the habit, the goal) before anything is real.
3. **Confirm** — nothing is saved until you explicitly accept it. You can accept everything at once, accept individual items, or tweak them first.
4. **Apply** — only then does the change actually take effect.

If a suggestion isn't quite right, you can **reject** it and type a quick correction — like "make it daily, not weekly" — and the assistant revises its proposal in place, without you having to start over. When the assistant needs one quick detail to do a good job, it may ask a short question with a few tap-to-answer options rather than guessing.

Scheduled suggestions from the planner can also be dragged to a different day or time, and the planner quietly learns from those adjustments to make better suggestions next time.

> Note: if the AI service is ever unavailable, the command bar still works using built-in rules — it just falls back to simpler, predictable behavior so the feature never breaks.
