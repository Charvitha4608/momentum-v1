# DAILY TARGETS + FRIEND LEADERBOARD

## MASTER SPECIFICATION

---

# PROJECT OVERVIEW

This application is a social accountability and productivity platform.

Users:

* Create daily targets
* Complete daily targets
* Earn points
* Build streaks
* Compare progress with friends
* View monthly completion history

The application should feel:

* Premium
* Competitive
* Motivating
* Minimal
* Social

Inspired by:

* Linear
* Vercel
* Notion
* Stripe

Avoid:

* Jira
* Trello
* Corporate analytics dashboards
* Generic SaaS templates
* Gaming-style interfaces

---

# TECH STACK

Framework:

* Next.js App Router

Database:

* Neon PostgreSQL

ORM:

* Drizzle

Authentication:

* Better Auth

Styling:

* Tailwind CSS
* shadcn/ui

Animation:

* Framer Motion

Hosting:

* Vercel

---

# COLOR SYSTEM

Darkest Blue:
#28264B

Medium Blue:
#4E5174

Light Blue:
#959EC9

White:
#E8EAE7

Accent Red:
#A40033

Use these colors consistently throughout the application.

---

# AUTHENTICATION

Email + Password Authentication

Requirements:

* Sign Up
* Login
* Logout
* Persistent Sessions

Each user's data must remain private and isolated.

---

# USER PROFILE

Instead of avatars, users select a profile emoji.

Allowed Emojis:

🎯 🥅 ✅ 🏁 🚩 🏆 🥇 🌟 🌠 💫 🎖️ 💯 📈 🔝 🪜 🏅 🎓 📜 🎉 🥳 🎊 🎗️ 🚀 ⚡ 🏃 🏃‍♂️ 🏃‍♀️ ⏩ 🐇 💨 🔥 ⏳ ⏰ ⌛ 🕒 🚄 🛸 💥 🌪️ ⏱️ 🕷️ 💪🏻

Profile Fields:

* Emoji
* Display Name
* Email

Editable:

* Emoji
* Display Name

Not Editable:

* Email

Display Format:

🚀 Rahul

[rahul@example.com](mailto:rahul@example.com)

---

# DAILY TARGETS

Users can:

* Create targets
* Edit target titles
* Delete targets
* Complete targets
* Uncomplete targets

Quick Add Input:

"Add today's target..."

Pressing Enter creates the target.

---

# CARRY-OVER SYSTEM

Any unfinished target automatically carries over to the next day.

Example:

June 12

☑ DSA Problems

☐ Workout

June 13

☐ Workout (carried over)

Carry-over targets remain active until completed.

Preserve original creation dates for history and analytics.

---

# POINT SYSTEM

Each completed task:

+10 Points

---

## Lifetime Points

Formula:

Total Completed Tasks × 10

Used for:

* Leaderboards
* Friend Comparisons
* Profiles

Example:

120 Completed Tasks

120 × 10

= 1200 Points

---

## Daily Score

Formula:

(Total Points Earned Today) / (Total Number Of Tasks Today)

Examples:

4 Tasks

3 Completed

30 / 4

= 7.5

---

5 Tasks

5 Completed

50 / 5

= 10

---

3 Tasks

0 Completed

0 / 3

= 0

Range:

0 → 10

Used for:

* Calendar Day Details
* Profile Statistics
* Friend Profiles
* Daily Analytics

Not used for leaderboard ranking.

---

# DAILY COMPLETION %

Formula:

Completed Tasks / Total Tasks

Example:

3 / 4

75%

Used for:

* Dashboard
* Calendar
* Friend Activity

---

# STREAK SYSTEM

A streak increases ONLY when ALL tasks for that day are completed.

Examples:

4/4 Completed

→ Streak Continues

3/4 Completed

→ Streak Breaks

0/4 Completed

→ Streak Breaks

5/5 Completed

→ Streak Continues

---

## No Task Day Rule

If a user creates zero tasks:

* Streak does not increase
* Streak does not decrease

The day is considered neutral.

---

# DASHBOARD

Order:

1. Current Streak
2. Total Points
3. Today's Progress
4. Today's Targets
5. Friends Leaderboard

---

## Top Cards

🔥 Current Streak

⭐ Total Points

🎯 Today's Progress

Use:

* Count-up animations
* Premium cards
* Consistent spacing
* Framer Motion

---

# TODAY'S TARGETS

Display active tasks separately from completed tasks.

Example:

Today's Targets

☐ Workout

☐ Read OS

---

Completed Today

☑ DSA Problems

☑ System Design

---

# FRIENDS SYSTEM

Friend requests sent by email.

Sections:

* Pending Sent
* Pending Received
* Connected Friends

Actions:

* Send Request
* Accept Request
* Reject Request
* Remove Friend

Removing a friend should not prevent future friend requests.

---

# FRIEND REQUEST RESTRICTIONS

Users cannot:

* Send requests to themselves
* Send duplicate requests
* Send requests to existing friends
* Send requests while another request is pending

Display appropriate errors.

---

# LEADERBOARD

Header:

🏆 Friends Leaderboard

Sorting Toggle:

[ ⭐ Points ] [ 🔥 Streak ]

Default:

⭐ Points

---

## Points Mode

Sort descending by Lifetime Points.

---

## Streak Mode

Sort descending by Current Streak.

Always display:

* Points
* Streak

Highlight current user row.

Animate row reordering.

---

# LEADERBOARD INTERACTION

Clicking a leaderboard row opens a Friend Profile panel.

Display:

* Emoji
* Name
* Lifetime Points
* Current Streak
* Daily Score
* Today's Targets
* Today's Progress

---

# FRIEND VISIBILITY RULES

Friends CAN see:

* Emoji
* Display Name
* Total Lifetime Points
* Current Streak
* Daily Score
* Today's Targets
* Today's Progress %

---

# PRIVACY RULES

Friends CANNOT see:

* Calendar History
* Previous Days
* Previous Daily Scores
* Historical Task Data
* Notifications
* Friend Requests
* Account Settings

Only today's activity is visible.

History remains private.

---

# NOTIFICATIONS

Dedicated Notifications Page.

Examples:

* Friend Request Received
* Friend Request Accepted
* Completed All Targets
* Overtaken On Leaderboard

Notifications support:

* Read
* Unread

Unread notifications show badge count.

---

# MONTHLY HISTORY CALENDAR

Monthly Heatmap Calendar.

One month visible at a time.

Users can:

* Navigate months
* Click days

Day Details Show:

* Targets
* Completed Tasks
* Completion %
* Daily Score
* Points Earned

---

# CALENDAR COLORS

#E8EAE7

No Targets

---

#A40033

0% Completed

---

#959EC9

1%-49% Completed

---

#4E5174

50%-99% Completed

---

#28264B

100% Completed

Display a legend explaining these colors.

---

# PROFILE PAGE

Display:

* Emoji
* Name
* Email
* Total Points
* Current Streak
* Best Streak
* Total Completed Tasks

---

# PROFILE SETTINGS

Users can edit:

* Display Name
* Emoji

Users cannot edit:

* Email

---

# TIMEZONE SUPPORT

All calculations use the user's local timezone.

Includes:

* Daily Targets
* Daily Score
* Calendar
* Streaks
* Carry-over Logic

---

# MIDNIGHT PROCESSING

Automatically:

* Carry over unfinished targets
* Recalculate streaks
* Create new daily records

---

# MOBILE SUPPORT

Fully responsive:

* Dashboard
* Friends
* Leaderboard
* Notifications
* Calendar
* Profile

---

# ANIMATIONS

Use Framer Motion.

Include:

* Hover Elevation
* Progress Animations
* Count-Up Numbers
* Leaderboard Reordering
* Checkbox Animations
* Page Transitions

Avoid:

* Excessive Neon
* Flashy Effects
* Distracting Motion

---

# FINAL GOAL

Build a cohesive production-quality social accountability platform.

Every page should feel like part of the same design system.

Prioritize:

* Consistency
* Simplicity
* Maintainability
* Performance
* Premium UX

The application should motivate users to complete daily targets, maintain streaks, and stay accountable through friendly competition.
