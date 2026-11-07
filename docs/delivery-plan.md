# GymJourno — Agile delivery plan

Drafted 6 November 2026, revised the same day. How we build every epic that isn't done yet:
individuals first (they open the app every day), then trainers (including creators who coach), then gyms, then chains
and enterprise.

This is a living plan. The backlog order is reviewed every week and changes when real users tell us
something new. Dates more than a few weeks out are forecasts, not promises.

- Section 1: how we work (a weekly rhythm)
- Section 2: the releases at a glance
- Section 3: the story map (every epic, one line per story) and how the epics depend on each other
- Section 4: Release 1 written in full, ready to build
- Section 5: decisions only Vijay can make
- Section 6: risks
- Why we're building it, who for, and what's decided: [`product-charter.md`](product-charter.md)
- What we believe but haven't proven, and how we'll test it: [`product-strategy.md`](product-strategy.md)
- Talking to users before Release 1: [`user-interviews-r1.md`](user-interviews-r1.md)

---

## 1. How we work

A lightweight agile flow (Kanban style) for a team of two: Vijay decides, Claude builds. Two-week
sprints, points and team ceremonies are built for larger teams; this keeps what matters — small
finished pieces, a regular review, and a backlog that changes with what we learn.

### Roles

| Role | Who | Does what |
| --- | --- | --- |
| Product owner | Vijay | Orders the backlog, makes product decisions, accepts finished stories, decides what goes live and when. |
| Delivery team | Claude | Writes and refines stories, builds, tests, shows screenshots, keeps this plan current. |
| Users | Pilot trainer, clients, class-goers, creators, gyms | Try each release and tell us what's missing. |

### The weekly rhythm

| When | What happens |
| --- | --- |
| **Weekly check-in** (Monday, 15–30 min) | Review what finished last week with screenshots and the app running locally. Vijay accepts or sends back each story, answers any open decision, and confirms what's next from the top of the backlog. |
| **During the week** | One epic at a time. At most one story being built and one waiting for review, so work finishes instead of piling up half-done. |
| **Before an epic starts** | Its stories are written in full (section 4 shows the standard) and checked against the Definition of Ready. |
| **Release** | Whenever Vijay says. Accepted work stays staged locally until then; nothing is committed, pushed or merged before he asks. |
| **Every four weeks** | A short look back (what went well, what didn't, one thing to change), re-forecast the dates, and reorder the backlog. |

### Definition of Ready (a story can be started when)

- It says who it's for and why: "As a … I want … so that …".
- It has acceptance criteria someone can check by using the app, including the awkward cases.
- Any product decision it needs has been made (section 5).
- It's small enough to finish within a week.

### Definition of Done (a story is finished when)

- It meets its acceptance criteria on a phone and a desktop, in light and dark mode.
- Lint, type checks and all automated tests pass, with new tests for the new behaviour (unit tests,
  database tests for anything touching who-can-see-what, end-to-end tests for the main flow).
- Database changes keep the live app working while they're applied.
- The privacy page is updated if what we store or who sees it changes.
- Screenshots have been shared, the change is staged locally, and Vijay has accepted it.

### Measuring pace and success

- **Pace:** stories finished per week. After the first two weeks we re-forecast every date from the
  real number. Until then the forecast assumes **about 4 stories a week**.
- **Success**, from the app's own records (no tracking cookies). Run
  `supabase/queries/baseline_metrics.sql` before Release 1 and after each release; it returns
  counts only.
  - Individuals: share who log in week 2 and week 4 after sign-up.
  - Trainers: active clients per trainer; days per week a trainer plans for a client (the app
    doesn't record when someone opens it, so this is the closest measure).
  - Gyms: members active in the last 7 days; quiet members who come back.
  - Business (from Release 5): paying trainers and gyms, monthly revenue.

### Starting numbers

**There's no real starting line yet.** On 6 November 2026 every account on the live site was a
test account (11 test individuals, 3 test trainers, 1 test gym). The query ran cleanly against them,
which shows it works, but their numbers say nothing about real use.

The query now counts only accounts created from 7 November 2026 onwards. Real starting numbers come
from the first real users:

- **2 weeks after the first real sign-ups:** first "logged in week 2" number.
- **4 weeks after:** first "logged in week 4" number, and the first real trainer and gym numbers if
  any have joined.

Until then, success for Release 1 is judged from the discovery survey and from real people trying it.

---

## 2. Releases at a glance

| Release | Forecast | Goal | Stories |
| --- | --- | --- | --- |
| Before R1 | 9–13 Nov 2026 | **Gate:** Phase 2 discovery survey (`discovery-survey.gs`): enough survey responses: at least 20 from individuals (5 or more who take classes) and 5 from trainers, plus follow-ups with those who agree to try the app (numbers proposed, for Vijay to confirm), hypotheses marked in the [strategy](product-strategy.md), the dependent Release 1 stories adjusted. Meanwhile, I1.1–I1.3, I5.1 and the leave-journey test are built in parallel. If the chats take longer, the dependent stories move, not the gate | — |
| **R1. Every kind of training** | 16 Nov – 25 Dec 2026 | Classes, yoga, cardio and timed work can be planned and logged; measurable goals | 17 |
| **R2. Keep individuals coming back** | 28 Dec 2026 – 22 Jan 2027 | Recovery check-ins, data download, progress photos, nutrition decision | 9 |
| **R3. Trainers run their day** | 25 Jan – 5 Mar 2027 | Ranked client list, notes and check-ins, safe shared editing, trainer pages and bio link, several trainers and gyms | 15 |
| **R4. Gyms run on GymJourno** | 8 Mar – 16 Apr 2027 | Door check-in, classes and booking, reports, ownership handover | 13 |
| **R5. Get paid** | 19 Apr – 14 May 2027 | Trainers pay first, then gyms (the core stays free for individuals); online membership payments | 8 |
| **R6. Chains and enterprise** | 17 May – 23 Jul 2027 | Branches, finer roles, audit log, business sign-in, white-label, integrations, corporate wellness | 18 |
| Later | after July 2027 | Native apps and health sync, social, languages, AI for trainers, full nutrition | — |

R4 and R6 start only when a real gym or chain is ready to try them. Each release ends with real users
trying it before the next one is locked in. These are formal gates (charter, section 9): R5 also
needs trainers who say they'd pay, at a stated price.

---

## 3. Story map

Every epic, one line per story, by user. IDs (I1.2, T3.1 …) are how we refer to stories. Only
Release 1 is written in full (section 4); the rest are written in full just before their epic
starts, because what we learn will change them.

### Individuals

**I1. Log any kind of training** — R1 · Must
- I1.1 Exercises know how they're measured (weight and reps, reps only, time, distance and time)
- I1.2 Log timed sets (a 60-second plank)
- I1.3 Log distance and time, with pace (a 5 km run)
- I1.4 Log a class or session as one entry (Zumba, 45 min, effort 7/10)
- I1.5 Add exercises under a session if you want the detail (yoga poses with hold times)
- I1.6 Sessions count everywhere: calendar, streaks, adherence, history, Coach, trainer and gym views
- I1.7 Progress and records for time and distance (longest hold, best pace, minutes per week)

**I2. Non-lifting content and planning** — R1 · Must
- I2.1 Yoga, mobility, stretching, cardio and dance in the exercise library (a base set we write; D2)
- I2.2 Plan a class or session ahead (Zumba, Tuesday, 45 min)
- I2.3 Say how you train at sign-up (lifting, yoga, dance, cardio, a mix)
- I2.4 Short sessions for non-lifters when nothing's planned (20-minute mobility flow)
- I2.5 The front door and demo show non-lifting training too

**I3. Measurable goals** — R1 · Should
- I3.1 Set a goal with a target and an optional date
- I3.2 See progress towards each goal on Today
- I3.3 Reaching (or missing) a goal
- I3.4 Your trainer sees your goals
- I3.5 Ask Coach whether you're on track

**I4. Recovery** — R2 · Should
- I4.1 A 10-second daily check-in: sleep, soreness, energy
- I4.2 Suggestions and Coach take recovery into account
- I4.3 Your trainer sees check-ins (with consent) *(pairs with T2.2)*

**I5. Your data** — R2 · Should
- I5.1 Download your workouts, sessions, plans and body weight as a spreadsheet
- I5.2 Download includes goals and check-ins

**I6. Progress photos** — R2 · Could *(needs D3)*
- I6.1 Add private progress photos
- I6.2 Compare two dates side by side
- I6.3 Delete photos for good

**I7. Nutrition** — decide in R2 *(needs D4)*
- I7.1 A one-page comparison: our own food log vs connecting a nutrition app

### Trainers and creators

**T1. Who needs me today** — R3 · Must
- T1.1 Clients ranked by who needs you, each with the reason (missed a day, no plan, quiet, fee overdue, goal at risk)
- T1.2 A warning when you and a client edit the same plan
- T1.3 Fewer, grouped notifications for plan changes

**T2. Notes and check-ins** — R3 · Must
- T2.1 Private notes per client
- T2.2 Weekly client check-in (energy, soreness, a comment)
- T2.3 See client goals and recovery, with their consent *(needs I3, I4)*

**T3. Trainer pages and bio link** — R3 · Should

Creators are a way in, not a platform (decided 6 Nov 2026): a fitness creator who coaches is a
trainer with a big audience. Instagram stays where their audience lives; GymJourno is where the
coaching happens. We don't host creator content, feeds or followers, or pay creators out.

- T3.1 Pick a handle and get a public page (gymjourno.fit/name) with photo, bio and what you coach
- T3.2 Upload a photo (trainers and gyms) *(shared with I6)*
- T3.3 A permanent "join me" link for an Instagram bio that doesn't expire
- T3.4 Link previews show the trainer's photo
- T3.5 Turn the public page off at any time
- T3.6 Show qualifications and experience on trainer pages *(needs the charter's open question on verification)*

**T4. Several trainers and gyms per person** — R3 · Should

The charter's target design (decided 6 Nov 2026): one person can have several trainers and gyms at
once, each with its own permissions. Until this epic, it's one of each.

- T4.1 Join a second trainer or gym without ending the first
- T4.2 Choose what each trainer or gym can see, separately, and change it later
- T4.3 Plans, fees and notifications show which trainer or gym they're from

### Gyms

**G1. Door check-in** — R4 · Must
- G1.1 Members check in by scanning the gym's door QR code
- G1.2 The gym sees today's visits and busy hours
- G1.3 Visits count on the member's calendar

**G2. Ownership and more than one gym** — R4 · Must
- G2.1 Hand ownership to an admin
- G2.2 One person runs more than one gym, and switches between them

**G3. Classes and booking** — R4 · Should *(builds on I1.4)*
- G3.1 The gym sets up classes (time, trainer, places)
- G3.2 Members book and cancel, with a waitlist
- G3.3 A booked class appears on the member's calendar and is logged as a session
- G3.4 Reminder before class

**G4. Gym reports** — R4 · Should
- G4.1 Owner dashboard: active, at-risk, renewals due, fees collected
- G4.2 Per-trainer workload and client retention
- G4.3 Monthly email summary and spreadsheet export

**G5. Equipment** — R4 · Could (only if a gym asks)
- G5.1 Members report a broken machine; the gym tracks it to fixed

### Business

**B1. Paid plans** — R5 · Must *(needs D6, D7)*

Who pays (decided 6 Nov 2026, see the charter): the core is free for individuals, always. Trainers
pay first, then gyms; an optional premium for individuals comes last, once we know what they'd pay
for.

- B1.1 A trainer plan first, then a gym plan: prices and limits
- B1.2 Upgrade, change plan and cancel
- B1.3 Invoices and a billing page

**B2. Online payments** — R5 · Should *(needs D7, legal review)*
- B2.1 Members pay gym or trainer fees online, recorded automatically
- B2.2 Recurring memberships with failed-payment reminders
- B2.3 GST invoices
- B2.4 Refunds
- B2.5 Payouts report for the gym or trainer

### Chains and enterprise

**E1. Organisations and branches** — R6 · Must for chains
- E1.1 An organisation owns several gyms
- E1.2 Members and trainers belong to a branch; can move between branches
- E1.3 Owners see every branch; managers see theirs

**E2. Finer roles** — R6 · Must for chains
- E2.1 Regional manager, front desk, finance-only and read-only roles
- E2.2 Choose what each role can do

**E3. Audit log** — R6 · Must for chains
- E3.1 A record of who changed plans, fees, roles and members, and when
- E3.2 Search and export the record

**E4. Business sign-in** — R6 · Should
- E4.1 Sign in with Google or Microsoft
- E4.2 Staff added and removed automatically from the company directory
- E4.3 The organisation can require two-step sign-in

**E5. White-label** — R6 · Could
- E5.1 The organisation's logo, colours and app name
- E5.2 Their own web address

**E6. Integrations and API** — R6 · Could
- E6.1 Accounting export
- E6.2 WhatsApp Business reminders
- E6.3 Calendar sync
- E6.4 Webhooks and an API for large chains

**E7. Corporate wellness** — R6 · Could
- E7.1 Company invites staff; staff choose to join
- E7.2 HR sees participation only, never personal health data without consent

### Later (parked, reviewed every quarter)

| Epic | Why it's parked |
| --- | --- |
| Native Android and iPhone apps; Apple Health and Google Fit | After the web app proves out (D8) |
| Social: follow and feed | Changes the private-by-default promise (D5) |
| Languages other than English | After the main markets are clear |
| AI help for trainers | After notes and check-ins prove useful; consent rules first |
| Full nutrition logging | Depends on I7.1 |
| Optional premium for individuals | After trainers and gyms pay, once real usage shows what individuals would pay for |

### How the epics depend on each other

| This … | … needs this first | Why |
| --- | --- | --- |
| I1.1 measured kinds | — | Everything about non-lifting training builds on it |
| I1.6, I1.7, I3 goals, G3 classes, G4 reports | I1.1 and I1.4 | They count and chart sessions and timed work |
| I2.1 library content | Decision D2 | We need to know where the content comes from |
| I3.4, T2.3 trainer sees goals | I3.1 | — |
| T2.3 trainer sees recovery | I4.1 | — |
| T3.2 photo upload and I6 progress photos | One shared, private photo store (D3) | Build the store once, use it twice |
| G1–G4 gym epics, E1 organisations | T4 several trainers and gyms | A member may belong to more than one gym, each with its own permissions |
| G3.3 booked class logged as a session | I1.4 | A class attended is a session |
| B2 online payments | B1 and D7 | Billing has to exist before payments |
| E1–E7 | G2.2 one person, several gyms | Organisations grow out of multi-gym ownership |

---

## 4. Release 1 in full: Every kind of training

**Goal:** someone who does Zumba, yoga, cardio or timed work can sign up, plan a week, log every
session, see progress, and set a goal.

**Forecast:** 16 Nov – 25 Dec 2026 (17 stories, at about 4 a week).

**Gate (charter v1.1):** stories that depend on the chats (I1.4–I1.7, I2.1–I2.5, I3) wait for the
discovery survey (enough survey responses: at least 20 from individuals (5 or more who take classes) and 5 from trainers, plus follow-ups with those who agree to try the app (numbers proposed, for Vijay to confirm)), the hypotheses marked in the
[strategy](product-strategy.md), and those stories adjusted. Stories needed whatever the chats say
(I1.1–I1.3, plus I5.1 data download from Release 2 and testing the leave journey) start now, in
parallel.

**Decided:** D1 (6 Nov) — a class or session is one entry: activity, duration and effort, with
optional notes, distance and exercises underneath. No calories or heart rate for now.

**A design point that affects all of I1:** today the app keeps one workout per person per day. A
yoga class in the morning and lifting in the evening must both fit, so sessions sit inside the day's
log alongside any lifting rather than replacing it. Nothing existing changes for lifters.

---

### I1.1 Exercises know how they're measured

> **As** someone who trains in more ways than lifting, **I want** each exercise to know how it's
> measured, **so that** the logger asks me for the right numbers.

Acceptance criteria
- Every exercise has one of four kinds: weight and reps · reps only · time · distance and time.
- Every existing library and custom exercise keeps working exactly as today (weight and reps, or
  reps only for bodyweight moves that are logged without weight).
- Library cardio and holds (e.g. plank, wall sit, rowing, running) get the right kind.
- Creating a custom exercise asks "How do you measure it?", defaulting to weight and reps.
- Changing the kind of a custom exercise that already has logged sets isn't allowed; the app says
  why and suggests making a new exercise.
- Search and filters can show "timed" and "distance" exercises.

Edge cases: an exercise used in a trainer's program keeps its kind; old offline-queued logs still
save.

Notes: additive database change (a new column with a safe default). Privacy page: no change.

---

### I1.2 Log timed sets

> **As** someone doing planks, holds or intervals, **I want** to log how long each set lasted,
> **so that** I can see my holds getting longer.

Acceptance criteria
- For a timed exercise, each set asks for a duration (minutes and seconds) instead of weight and
  reps.
- Last time's duration shows beside each set, as weights do today.
- "Same as last time" copies durations; the rest timer works as it does today.
- A set with no duration isn't counted as done.
- Works offline and syncs later, like other sets.

Edge cases: durations over 2 hours are rejected with a clear message; switching an exercise
mid-workout (swap) to one of a different kind starts its sets fresh.

---

### I1.3 Log distance and time

> **As** someone who runs, rows, rides or walks, **I want** to log distance and time, **so that** I
> can see my pace improve.

Acceptance criteria
- For a distance exercise, each entry asks for distance and time; pace is shown (per km, or per
  mile if the entry is in miles).
- km or miles can be chosen per entry and is remembered next time, like kg and lb.
- Last time's distance and pace show beside the entry.
- Works offline.

Edge cases: distance without time is allowed (no pace shown); time without distance is a timed set
instead.

---

### I1.4 Log a class or session as one entry

> **As** someone who goes to a Zumba or yoga class, **I want** to log it in a few seconds, **so
> that** it counts without me listing every move.

Acceptance criteria
- From Today and from any calendar day: "Log a session".
- Choose an activity from a short list (Zumba, yoga, Pilates, dance, spin, HIIT, run, walk, swim,
  sport) or type your own; your own appear first next time.
- Duration is required (1 minute to 10 hours). Effort 1–10 is asked but can be skipped. Notes and
  distance are optional.
- A day can have several sessions and a lifting workout at the same time; each shows separately.
- Sessions can be edited or deleted later, like workouts.
- Works offline.

Edge cases: a session logged for a future date isn't allowed; deleting the only session on a
planned day marks it as not done again.

---

### I1.5 Add exercises under a session

> **As** someone who wants detail (yoga poses, a circuit), **I want** to add exercises under a
> session, **so that** I can record what I did inside it.

Acceptance criteria
- A session has "Add exercises (optional)"; leaving it empty is fine.
- Added exercises are logged with their own kind (e.g. a pose with hold time).
- Records from these exercises count like any others (e.g. longest hold).

Edge cases: removing all exercises leaves the session itself in place.

---

### I1.6 Sessions count everywhere

> **As** someone who mostly does classes, **I want** my sessions to count like workouts, **so
> that** my streak, calendar and trainer see my real training.

Acceptance criteria
- A day with only a session shows as trained on the calendar, streaks and adherence.
- History lists sessions with activity, duration and effort.
- "Training days this week" on Today includes sessions.
- A trainer's client view shows a session day as Done, and can open its details.
- A gym's "workouts this week" count includes sessions (still counts only, never details).
- Coach can use sessions as evidence ("You did 3 Zumba sessions this week, 135 minutes").
- The share image works for a session (activity, duration, effort).

Edge cases: a planned lifting day where only a session was done counts as trained (not missed).

---

### I1.7 Progress and records for time and distance

> **As** someone doing timed or distance work, **I want** to see my progress and records, **so
> that** I know I'm improving.

Acceptance criteria
- Records: longest hold for timed exercises; longest distance and best pace for distance ones.
- A new record is celebrated in the logger, as weight records are today.
- Progress shows a chart for timed and distance exercises.
- A "minutes per week" chart by activity, including sessions.

Edge cases: records ignore entries with missing time or distance.

---

### I2.1 Yoga, mobility, stretching, cardio and dance in the library

> **As** someone who doesn't lift, **I want** to find the moves I do, **so that** I can plan and
> log them.

Acceptance criteria
- At least 150 new exercises across yoga, mobility, stretching, cardio and dance, each with the
  right kind (I1.1) and how-to text. We write them (decision D2); Vijay reviews the list and the
  wording before release.
- Text only for now: no pictures until we have ones we own or have rights to (pictures come later).
- A filter by type of training (lifting, yoga, mobility, cardio, dance).

Edge cases: names that clash with existing exercises are merged, not duplicated.

---

### I2.2 Plan a class or session ahead

> **As** someone with a weekly class, **I want** to put it on my plan, **so that** I see it on the
> day and get reminded.

Acceptance criteria
- When planning a day, choose "Session" with an activity and planned duration.
- Planned sessions show on Today and the calendar; logging one is one tap from Today.
- Workout reminders cover planned sessions.
- Trainers can plan sessions for their clients the same way.
- Templates and multi-week programs can include sessions.

Edge cases: a planned session not logged by the end of the day shows as missed, like workouts.

---

### I2.3 Say how you train at sign-up

> **As** a new member who does yoga, **I want** the app to know that, **so that** what it suggests
> fits me.

Acceptance criteria
- Onboarding asks: lifting, yoga, dance, cardio, or a mix (more than one allowed). Can be changed in
  Profile.
- Today's empty state, quick sessions and exercise library order follow the answer.
- Existing members default to "lifting" and see no change until they edit it.

---

### I2.4 Short sessions for non-lifters

> **As** someone with nothing planned today, **I want** a short session that fits how I train,
> **so that** I still do something.

Acceptance criteria
- At least six short sessions for non-lifters (mobility, stretching, yoga flow, cardio intervals),
  10–30 minutes.
- Offered where lifting quick workouts are offered today, matched to I2.3 and where they train.

---

### I2.5 The front door shows non-lifting training

> **As** a yoga or Zumba follower arriving from a creator's post, **I want** to see the app is for
> me too, **so that** I sign up.

Acceptance criteria
- The home page and demo show at least one session and one timed or distance example.
- Every claim matches what the app does once I1 and I2 are live.

---

### I3.1 Set a goal

> **As** someone training towards something, **I want** to set a goal with a target and an
> optional date, **so that** I know what I'm aiming for.

Acceptance criteria
- Goal types: lift a weight for reps (e.g. squat 100 kg × 5), body weight, sessions per week,
  minutes per week, distance (e.g. run 10 km), hold time (e.g. 2-minute plank).
- Optional target date; up to three active goals at once.
- Edit or delete a goal at any time.
- The existing goal label (build muscle, lose fat …) stays as it is.

Edge cases: a goal already met when set is marked reached straight away.

---

### I3.2 See progress towards each goal

> **As** someone with a goal, **I want** to see how close I am, **so that** I stay motivated.

Acceptance criteria
- Today shows each active goal with progress (e.g. 85 of 100 kg) and the trend.
- With a date: "on track" or "behind", worked out from the trend.
- Progress comes only from the person's own logs.

---

### I3.3 Reaching or missing a goal

> **As** someone who just hit a goal, **I want** it noticed, **so that** it feels like an
> achievement.

Acceptance criteria
- Reaching a goal is celebrated once and moves it to "Reached", with the date.
- Missing a dated goal offers: extend the date, change the target, or let it go.

---

### I3.4 Your trainer sees your goals

> **As** a client, **I want** my trainer to see my goals, **so that** they plan towards them.

Acceptance criteria
- A trainer the client has accepted sees their goals and progress.
- The "trainer will see" list on invites and the privacy page say so before anyone accepts.
- Existing clients are told once that their trainer can now see goals.

---

### I3.5 Ask Coach whether you're on track

> **As** someone with a goal, **I want** to ask Coach if I'm on track, **so that** I know what to
> change.

Acceptance criteria
- Coach answers from the person's own records and shows the numbers it used.
- No medical claims, as today.

---

## 5. Decisions only Vijay can make

Each is needed before the story that uses it starts.

| # | Decision | Needed before | Options |
| --- | --- | --- | --- |
| D1 | How a class is logged | I1.4 | **Decided 6 Nov 2026:** one entry (activity, duration, effort), optional notes, distance and exercises underneath; no calories or heart rate for now |
| D2 | Where yoga and dance content comes from | I2.1 | **Decided 6 Nov 2026:** we write the library's yoga, mobility, stretching, cardio and dance moves, so every move exists once and every user has the basics from day one. Trainers keep adding their own custom exercises for their clients, as they can today. Creators don't publish content to GymJourno (they're a way in, not a platform). |
| D3 | Where photos are stored | I6, T3.2 | Privately by us · on the phone only |
| D4 | Nutrition | I7 | Build a food log · connect an existing nutrition app · leave it out |
| D5 | Public profiles and a social feed | Any social work | Stay private-only · opt-in public profiles |
| D6 | Prices | B1 | Who pays is decided (trainers, then gyms, then optional individual premium; core free). Still open: per trainer or per client; per gym branch or per member |
| D7 | Payment provider | B1, B2 | Razorpay (India) · Stripe · both |
| D8 | Native app approach | Native work | Wrap the web app · build native apps |

---

## 6. Risks and how we handle them

| Risk | What we do |
| --- | --- |
| Building what users don't want | Talk to users before R1; every release ends with real users trying it; the backlog reorders on what they say. |
| Building for gyms or chains before one asks | R4 and R6 start only when a real gym or chain is ready to pilot. |
| New features making the app harder for beginners | Every check-in includes a quick "new user" walk-through. |
| The front door promising more than the app does | The home, trainer, gym and demo pages are checked against the app at every release. |
| Health and personal data | Consent before anyone else sees anything; privacy page updated with each change; no tracking cookies. |
| Payments | Legal review and the provider's test mode before anything takes real money. |
| Pace slower than forecast | Re-forecast every four weeks from real pace; move scope before cutting quality. |
