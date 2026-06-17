# MOMENTUM PRODUCT SPEC V2

## Product Philosophy

Momentum is not a task manager.

Momentum is a personal growth operating system.

Users are not simply completing tasks.

Users are investing effort into areas of their life and gradually becoming a certain type of person.

The application should help users answer:

* What am I working on?
* What have I been neglecting?
* Am I progressing toward my goals?
* What am I becoming?

The design should remain:

* Minimal
* Modern
* Dark themed
* Similar in spirit to Linear, Vercel, Notion
* Not childish
* Not overly gamified

---

# Existing Core Systems

Already present:

* Authentication
* Friends
* Leaderboard
* Notifications
* History Calendar
* Daily Targets
* Backlogs
* Weekly Score
* Streaks
* Points

These systems should be reused whenever possible.

---

# Sidebar Architecture

Rename:

History
→ Calendar

Final Sidebar:

* Dashboard
* Calendar
* Goals
* Reflection
* Friends
* Notifications
* Profile

---

# Dashboard

Purpose:

Daily execution.

Dashboard should remain focused on today's work.

Keep:

* Today's Targets
* Leaderboard
* Backlog

Remove:

* Neglected Pillar Alerts
* Weekly Goal Progress

These belong elsewhere.

---

# Dashboard Bug Fix

Current issue:

When a user has zero tasks for today, the dashboard can display messaging that implies everything is completed.

This is incorrect.

Desired behavior:

If total tasks = 0:

Display:

"No targets created for today."

Do not display:

"All tasks completed."

---

# Pillars System

Pillars are the foundation of the product.

Examples:

* 💻 DSA
* 🖥 OS
* 🏋 Gym
* 📚 Reading
* 🚀 Projects

Every task belongs to exactly one pillar.

When creating a task:

User must choose:

* Existing Pillar

or

* Create New Pillar

Each pillar stores:

* Name
* Icon
* Color

Users may:

* Create pillars
* Edit pillars
* Archive pillars

---

# Recurring Tasks

Tasks may be:

* One-time
* Daily
* Weekly
* Custom

Examples:

Daily:
Read 10 pages

Weekly:
Gym Monday Wednesday Friday

Custom:
Every 3 days

Recurring tasks should automatically regenerate.

---

# Calendar Page

Purpose:

Past activity.

The page should contain a View Switcher.

Views:

## Month View

Current calendar view.

Keep existing behavior.

* Month navigation
* Completion coloring
* Daily completion visualization

Clicking a day should continue to show:

* Tasks
* Completion state
* Points earned

---

## Pillars View

Calendar still displays dates.

Each date displays pillar outcomes.

Example:

June 15

🟢 DSA
🔴 Gym
🟢 OS

Meaning:

* Green = completed pillar work
* Red = missed pillar work
* Yellow = partially completed

Clicking a day shows:

DSA
✓ Binary Search

Gym
✗ Workout

OS
✓ Notes

---

## Week View

TickTick-inspired weekly layout.

Display:

* Monday → Sunday
* Tasks grouped by day
* Pillars visible
* Completion state visible

Purpose:

Quick review of recent work.

---

# Goals Page

Purpose:

Future direction.

Users can create:

## Pillar Goals

Examples:

DSA
500 points/month

Gym
20 workouts/month

Reading
15 sessions/month

Progress updates automatically.

---

## Long-Term Goals

Examples:

Finish NeetCode 150

Deadline:
Dec 31

Finish OS Concepts

Deadline:
Aug 15

Progress should be visible.

---

## Goal Reminders

Notify users:

* 7 days before deadline
* 3 days before deadline
* 1 day before deadline

Notifications should integrate with existing notification systems.

---

# Reflection Page

Purpose:

Help users understand what they are becoming.

This page is not based on raw activity percentages.

It compares:

Desired effort
vs
Actual effort

Example:

Desired:

DSA 40%
Gym 20%
OS 20%
Reading 20%

Actual:

DSA 50%
Gym 5%
OS 30%
Reading 15%

Reflection should show:

DSA:
125% of target

Gym:
25% of target

OS:
150% of target

Reading:
75% of target

---

# Balance Score

Reflection page contains:

Balance Score

Example:

82/100

Purpose:

Measure how balanced effort is across pillars.

Someone investing in all intended pillars should score highly.

Someone ignoring multiple pillars should score poorly.

---

# Weekly Breakdown Analytics

Reflection page contains:

Weekly Breakdown

Examples:

DSA 42%
Projects 25%
OS 18%
Gym 10%
Reading 5%

Show:

* Weekly breakdown
* Monthly breakdown
* Most active pillar
* Least active pillar

---

# Weekly Review

Every Sunday automatically generate:

* Points earned
* Tasks completed
* Most active pillar
* Least active pillar
* Current streak
* Best day

Store reviews historically.

Users should be able to revisit previous reviews.

---

# Neglected Pillar Alerts

Purpose:

Prevent users from abandoning important areas.

Rule:

Only trigger if:

daysSinceLastActivity >= 5

Examples:

"You haven't touched Gym in 7 days."

"You haven't touched Reading in 11 days."

Display:

* Notifications
* Reflection page

Do not display on Dashboard.

---

# Friend Profiles

Each friend profile should show:

* Current streak
* Longest streak
* Total points
* Weekly points
* Top pillars
* Achievements
* Badges

---

# Weekly Leaderboards

Separate from all-time leaderboard.

Reset every week.

Track:

* Weekly points
* Weekly tasks completed

Display rankings among friends.

---

# Challenges

Friends can participate together.

Examples:

* 7 Day DSA Sprint
* 30 Day Gym Challenge
* Reading Challenge

Challenge page should show:

* Participants
* Rankings
* Time remaining
* Winner

---

# Achievement System

Focus on consistency, not volume.

Examples:

* First Perfect Week
* 5 Perfect Weeks
* 10 Perfect Weeks
* 30 Day Streak
* 100 Day Streak
* DSA Goal Completed
* Gym Goal Completed
* Reading Goal Completed
* Monthly Goal Achieved
* Semester Goal Achieved
* Never Missed A Recurring Task For 30 Days

Achievements are permanent.

---

# Profile Badges

Badges are personal milestones.

Do NOT use:

* Top 10%
* Top 5%
* Top 1%

Examples:

* 🔥 30 Day Streak
* ⚡ Perfect Week
* 🏋 Gym Champion
* 💻 DSA Master
* 🎯 Goal Crusher
* 📚 Consistent Learner
* 🚀 Project Builder

Badges should be visible on profile pages and friend profiles.

---

# Mobile Requirements

All features must function on:

* Desktop
* Tablet
* Mobile

No desktop-only implementations.

---

# Implementation Order

Build in this order:

1. Pillars System
2. Recurring Tasks
3. Calendar View Switcher
4. Goals Page
5. Reflection Page
6. Weekly Breakdown Analytics
7. Balance Score
8. Neglected Pillar Alerts
9. Weekly Reviews
10. Friend Profiles
11. Weekly Leaderboards
12. Challenges
13. Achievement System
14. Profile Badges
