# GymJourno — Product Strategy and Discovery

> **Method changed on 6 November 2026 (Vijay's decision):** discovery runs as a survey people fill in themselves (Google Form built by [`discovery-survey.gs`](discovery-survey.gs)), not one-to-one chats. They choose their role and answer that role's questions about what they actually did. Survey answers are weaker evidence than watching someone, so the strongest evidence now comes from the follow-ups with people who agree to try the app. The hypotheses and pass criteria below still apply; read "chat" as "survey response or follow-up".

**Version 0.1 · 6 November 2026 · Working draft: hypotheses to test** (updated after review)

Phase 2, following the approved [Product Charter v1.0](product-charter.md). The charter says what
we've decided; this document says what we **believe but haven't proven**, and how we'll find out.

Everything here is a hypothesis. Each one has an ID (H1, H2 …), a test, and what would count as
"true". The chats are exploratory (about eight people), not a representative survey of the Indian
fitness market: they find problems and test guesses; real use after each release confirms them. After the user chats ([guide](user-interviews-r1.md)), this document is rewritten from what
people actually said, and the [delivery plan](delivery-plan.md) is adjusted to match.

**Status key:** *Assumed* (not tested yet) · *Supported* (evidence says yes) · *Rejected* (evidence
says no) · *Changed* (true in a different form).

---

## 1. Personas

Four groups, from the charter's order of focus. Individuals are split into the four situations we
expect to matter most; the chats will tell us which are real and which are the biggest.

### Individuals (the primary user)

| Persona | Who they are | Status |
| --- | --- | --- |
| **The class-goer** | Goes to Zumba, dance, yoga or spin 2–4 times a week; may also walk or run. Doesn't think of it as "training" and has never logged it | Assumed |
| **The lifter** | Trains in a gym 3–5 times a week, cares about getting stronger, may have tried a lifting app | Assumed |
| **The beginner** | Wants to start but doesn't know what to do or where; often at home first | Assumed |
| **The busy person** | Trained before, now fits it around work or family; trains irregularly | Assumed |

### Trainers (the first paying customer)

| Persona | Who they are | Status |
| --- | --- | --- |
| **The independent trainer** | Coaches 5–30 clients, in a gym, at clients' homes or online; runs everything on WhatsApp, notes and memory | Assumed |
| **The creator-trainer** | Has an Instagram following and coaches some followers for a fee; wants a smooth way from "DM me" to coaching | Assumed |

### Gyms (the second paying customer)

| Persona | Who they are | Status |
| --- | --- | --- |
| **The gym owner** | Runs one independent gym with a few trainers and 100–500 members; tracks fees in a register or spreadsheet | Assumed |

---

## 2. Problems and jobs to be done

What each persona is trying to get done, and what gets in the way today.

| Persona | Job to be done | Problem today | ID |
| --- | --- | --- | --- |
| Class-goer | "Help me see that I'm being consistent, without effort" | Nothing records classes simply; fitness apps assume gym lifting | H1 |
| Lifter | "Help me know what to lift next and see that I'm getting stronger" | Notebooks and memory; apps that don't connect to their trainer | H2 |
| Beginner | "Tell me what to do and help me make it a habit" | Too much conflicting advice; no simple starting plan | H3 |
| Busy person | "Help me keep going when life gets in the way, and not feel I've failed" | Plans fall apart after a missed week; apps punish missed days | H4 |
| Independent trainer | "Help me keep every client on track without chasing them on WhatsApp" | Plans, check-ins and payments scattered across chats, notes and memory | H5 |
| Creator-trainer | "Turn followers who want coaching into paying clients I can actually manage" | Coaching happens in DMs; nothing scales past a handful of clients | H6 |
| Gym owner | "Keep members coming back and know who's paid" | Members quietly stop coming; fees tracked by hand | H7 |

---

## 3. Value propositions and alternatives

Why each would choose GymJourno over what they use now.

| Persona | What they use now (assumed) | Why GymJourno instead | ID |
| --- | --- | --- | --- |
| Class-goer | Nothing, a fitness watch, or a notes app | Log a class in seconds; every kind of training counts in one history | H8 |
| Lifter | A notebook, or a lifting app | Lifting tools as good as dedicated apps, plus their trainer in the same place | H9 |
| Beginner | YouTube and Instagram videos | A simple plan to start, and a real trainer when they want one | H10 |
| Busy person | Nothing consistent | Short sessions when nothing's planned; breaks without penalty | H11 |
| Independent trainer | WhatsApp, spreadsheets, sometimes a coaching app | Plans, logs, progress and fees in one place, with clients who actually use it because it's free for them | H12 |
| Creator-trainer | Instagram DMs, Google Forms, WhatsApp groups | One link in their bio that takes followers straight into coaching | H13 |
| Gym owner | Paper register, spreadsheet, or gym software | Members who keep training between visits, early warning when one goes quiet, fees tracked; members own their data, so they trust it | H14 |

---

## 4. User journeys

How each key journey works today, and what's still missing. "Built" means it works on the live app
now.

| Journey | Today | Gap to close | Release |
| --- | --- | --- | --- |
| **Discover** | Home page, trainer and gym pages, demo; invite links with previews | No way for the general public to find it yet (no marketing); unknown which channel works | Discovery |
| **Sign up** | Email and password or magic link; onboarding asks goal, experience, days | Doesn't ask how they train (lifting, yoga, dance…) | R1 (I2.3) |
| **Start training** | Plan a day or a program; short workouts when nothing's planned | Only lifting; nothing for classes, cardio or yoga | R1 (I1, I2) |
| **Track progress** | Records, charts, weekly volume, streaks | Nothing for time, distance or sessions; no measurable goals | R1 (I1.7, I3) |
| **Connect with a trainer** | Trainer's invite link, welcome page, consent list, accept | Only one trainer at a time; no permanent bio link | R3 (T3, T4) |
| **Change providers** | Remove a trainer or leave a gym; records stay with the person | No data download; access permissions not adjustable per trainer | R2 (I5), R3 (T4) |
| **Leave** | Pause or delete the account | The full journey (download, revoke, delete) hasn't been tested end to end | Before R2 |

---

## 5. Business model hypotheses

From the charter: the core is free for individuals; trainers pay first, then gyms, then an optional
premium for individuals.

| ID | Hypothesis | Status |
| --- | --- | --- |
| H15 | Independent trainers will pay a monthly subscription for client management | Assumed |
| H16 | Trainers prefer a price that grows with their number of clients over a flat fee | Assumed |
| H17 | Trainers will move their clients onto GymJourno *because* it's free for clients | Assumed |
| H18 | Creator-trainers will pay more than independent trainers, because they have more clients | Assumed |
| H19 | Gyms will pay once members already use GymJourno with a trainer there | Assumed |
| H20 | Some individuals will later pay for advanced programs or analytics, but not enough to fund the free core | Assumed |

Price points are deliberately not set here. The trainer chats ask what they spend on tools today and
what would feel too cheap or too expensive; prices follow from the answers (decision D6).

---

## 6. Validation plan

How each hypothesis is tested, and what counts as "true". Chats first (cheap and fast), then real
use once Release 1 is live.

**What counts as evidence.** Past behaviour, not opinions. A positive reaction to a mock-up is
useful feedback, not proof of a recurring need. Strong evidence is: they already track it somehow;
they've tried before and stopped for a reason; they have a specific reason to look back; they
describe a real problem with a real example; they've spent time or money on it; or they agree to try
GymJourno for something specific, with a date.

Every hypothesis is recorded as **evidence** (what they said or did), **interpretation** (what it
suggests) and **decision** (Supported, Rejected, Changed), in the discovery workbook.

| ID(s) | Test | Counts as supported if … | When |
| --- | --- | --- | --- |
| H1, H8 | Chats with 2 class-goers; then show the session-logging mock-up | Both show real behaviour: they track classes somehow now, or tried and stopped, or have a specific reason to look back; and at least one agrees to try it for an actual upcoming class | Before R1 |
| H2, H9 | Chat with 1 lifter; they plan and log a workout on the live app | They describe a real, recent gap in how they track or connect to a trainer, and complete the task without help | Before R1 |
| H3, H4, H10, H11 | Chat with 1 beginner or busy person | They describe a real time they dropped off, and what would have kept them going matches a short plan or breaks without penalty | Before R1 |
| H5, H12, H15–H17 | Chats with 2 independent trainers (including the pilot trainer); they make an invite link on the live app | Both walk through a real, recent follow-up with a missed client and how long it took; at least one names a price range; at least one agrees to invite a real client, with a date | Before R1 |
| H6, H13, H18 | Chat with 1 creator-trainer | They'd put a GymJourno link in their bio and describe what followers should see | Before R3 |
| H7, H14, H19 | Chat with 1 gym owner | They describe members going quiet as a real problem and would try GymJourno with one trainer | Before R4 |
| H1–H4 (use) | Release 1 live with real users | Main measure: people training at least weekly; week-2 and week-4 return; share logging non-lifting | 4 weeks after R1 |
| H20 | Individuals asked what fitness apps, programmes or subscriptions they've paid for before | Real past spending on something like advanced programs or analytics (not "I'd pay for that") | Before R1 (evidence only; no premium work until after trainers and gyms pay) |
| H15–H17 (payment) | Before building payments, offer a paid plan to the trainers using it | At least 3 trainers agree to pay at a stated price. This payment gate is separate from the Release 1 gate | Before R5 |

**Rule:** a hypothesis that's rejected changes the plan before we build on it. Two in particular
would change a lot:

- **H17 rejected** (clients won't join even when free): the trainer side needs rethinking before
  any payment work.
- **H1 rejected** (class-goers don't want to log): Release 1's emphasis on classes shrinks, and
  the library content (I2.1) waits.

---

## 7. What happens next

Three checkpoints, recorded in the discovery workbook (`GymJourno_Discovery_Workbook.xlsx`):

| Checkpoint | Chats | Output |
| --- | --- | --- |
| 1. Release 1 gate | 2 class-goers, 1 lifter, 1 beginner or busy person, 2 independent trainers | Evidence on H1–H5, H8–H12, H15–H17, H20; Release 1 stories adjusted |
| 2. Remaining chats | 1 creator-trainer, 1 gym owner | Evidence on H6, H7, H13, H14, H18, H19 |
| 3. Consolidate | — | This document rewritten as v0.2 with all 20 hypotheses classified; delivery priorities revised and approved |

Release 1 stories that depend on these answers (class logging, the yoga and dance library,
how-you-train at sign-up, goals) don't start until checkpoint 1 is done and its findings are in
those stories. Stories needed whatever the chats say (I1.1–I1.3, I5.1 and the leave-journey test) are built in parallel.
