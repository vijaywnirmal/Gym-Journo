# GymJourno — Product Charter

**Version 1.2 · 6 November 2026 · Approved by Vijay (product owner)**

The approved baseline: its decisions stand unless new evidence justifies changing them, and any
change is recorded in the change log. It sets why GymJourno exists, who it's for and what each of them gets, what's
decided, what we're not building, and how we'll know it's working. How and when we build it lives
in [`delivery-plan.md`](delivery-plan.md). Together, these two documents are the source of truth.

---

## 1. Where we are today

- **A live web app** at gymjourno.fit, built for phones and installable from the browser.
- **For individuals:** planning by day, templates and multi-week programs; set-by-set logging with
  records, rest timer and offline use; progress charts; body weight;
  rest days and days off that don't count as failures; ~730 exercises with pictures; an AI Coach
  that only answers from the person's own records (off until they turn it on, with a daily limit);
  workout reminders.
- **For trainers:** invite clients by link, plan their days, see their logs and body weight, track
  fees. A client sees exactly what a trainer will see before accepting, and can remove them at any
  time.
- **For gyms:** members join with a QR code; the gym sees activity counts (never workouts),
  suggests trainers, and tracks fees. Members can leave at any time.
- **Already designed for what follows:** one activity framework, where a class is a simple entry
  with optional detail underneath (decision D1); people keep their records when a trainer or gym
  leaves; accounts can be paused or deleted.
- **A public front door:** home page, pages for trainers and gyms, a demo, and invite welcome
  pages.
- **No real users yet.** Every account on 6 November 2026 is a test account. No payments.
- **The biggest gap:** only lifting can be logged properly. Release 1 fixes that.
- **One relationship of each kind:** today a person can have one trainer and one gym at a time.
  Several of each is planned (section 6).

## 2. Aim, vision and mission

| | |
| --- | --- |
| **Aim** (why GymJourno exists) | Make fitness accessible, understandable and sustainable for every individual, regardless of where they start or how they choose to exercise. |
| **Vision** (what it wants to become) | A world where every individual can manage and progress through their entire fitness journey through one connected platform. |
| **Mission** (what it does every day) | Help individuals plan, record and improve their fitness through accessible tools, intelligent guidance and connections with fitness professionals and businesses. |
| **Tagline** | *Your fitness journey. Your goals. Your way.* |

## 3. Who it's for, and what each gets

| | |
| --- | --- |
| **Primary user** (the central beneficiary) | Individuals who train, in any way: lifting, yoga, Zumba, running, mobility, sport, at home, in a gym or in a class |
| **Primary customer** (pays first) | Trainers, then gyms |
| **Order of focus** | Individuals → trainers (including creators who coach) → gyms → chains, only when one asks |
| **Market** | India first, built so other languages and regions can follow |

**Positioning.** GymJourno is a complete personal fitness platform for people in India: it helps
them plan, train, track and improve in any kind of exercise, on their own or with the trainers and
gyms they choose, and their history always stays theirs.

### What the individual gets

- A genuinely useful free experience, complete on its own: no trainer or gym needed, ever.
- Ownership of their fitness records, including after leaving a trainer or gym.
- No forced gym affiliation or tie to one provider.
- Control over who sees what, and over whether AI is used at all.

### What the trainer gets (why they pay)

- Easier client management: plans, logs and fees in one place instead of WhatsApp and spreadsheets.
- Less admin: reusable programs, planning for a client's week in minutes.
- Better client engagement and retention: they see who trained, who missed, and who's slipping.
- Visibility into client progress, with the client's permission.

### What the gym gets (later, once one is using it)

- Members who keep training between visits, and early warning when someone goes quiet.
- Trainers and members in one place, with fees tracked.
- A member experience that doesn't depend on owning the member's data.

**Why they'd choose it**

| Instead of … | GymJourno gives them … |
| --- | --- |
| Workout apps built for lifting only | Every kind of training in one history, and a link to a real trainer or gym |
| Trainers coaching over WhatsApp and spreadsheets | Plans, logs and fees in one place, with the client's consent built in |
| Gym software that treats members as the gym's records | A journal the member owns, which the gym can support but never takes over |

## 4. What's free, and what could be paid

The core is free for individuals. Trainers, then gyms, pay; their subscriptions must be worth
enough to sustain the free individual experience. An optional premium for individuals may come
later, but never for the things below marked "always free".

| Capability | Free for individuals | Could be premium later |
| --- | --- | --- |
| Logging workouts and activities | Always free | — |
| Personal history (everything they've logged) | Always free; never paywalled | — |
| Downloading their data | Always free | — |
| Connecting to a trainer or gym | Always free for the individual | — |
| Exercise library | Free | Advanced or specialised programs |
| Planning, templates, programs | Free | Advanced customisation, if validated |
| Progress tracking and records | Free | Advanced analytics |
| AI Coach | A daily allowance, free | Higher usage or advanced capabilities |

**Sustainability assumption to validate:** enough trainers (then gyms) pay that the free core is
affordable. Release 5 tests this; until then, nothing is charged.

## 5. Principles

1. **Individual-centred, not gym-centred.** The person's goals and history are the foundation. No
   trainer or gym owns their fitness identity.
2. **Your history is yours.** People keep their full history when they change trainers or gyms,
   can download it, can revoke access they've granted, and can delete their account. Sharing is
   always by permission and shows exactly what's shared first.
3. **The core is free for individuals,** as defined in section 4.
4. **Complete on its own.** Someone who never joins a trainer or gym gets a full product.
5. **Useful without AI.** Planning, logging, progress and everything else work fully with AI turned
   off. AI improves the experience; it's never required.
6. **AI and people work together.** AI explains itself from the person's own records, admits what
   it doesn't know, makes no medical claims, and never replaces the option of a real trainer.
7. **Every kind of fitness counts.** No assumption that everyone wants bodybuilding, a gym, weight
   loss or one body ideal. People can have more than one goal, and goals can change.
8. **Progress over perfection.** Life happens: busy weeks, travel, illness, breaks, changing
   interests. People can pause, adapt and come back without losing their history or being made to
   feel they failed.
9. **Privacy and safety by design.** Collect only what has a clear purpose, explain it, and protect
   it. No tracking or advertising cookies; we don't sell data or show ads.
10. **Validate before expanding.** Real users try each release before the next is locked in (a
    formal gate, section 9). Don't build a marketplace or business suite on a guess.

## 6. Decisions made

| Decision | Date |
| --- | --- |
| The product is called **GymJourno** | 6 Nov 2026 |
| **Positioning:** a complete personal fitness platform (plan, train, track, improve, connect), not only a journal, and not yet a wellness or nutrition platform | 6 Nov 2026 |
| **Individuals can use GymJourno fully on their own,** never needing a trainer or gym | 6 Nov 2026 |
| **Individuals first**, then trainers, then gyms; chains only when one asks | 6 Nov 2026 |
| **India first** | 6 Nov 2026 |
| **Creators are a way in, not a platform:** a creator who coaches is a trainer with an audience, linking followers from their Instagram bio. No creator content, feeds or payouts | 6 Nov 2026 |
| **Trainers connect by invitation**, not through a marketplace | 6 Nov 2026 |
| **Several trainers and gyms per person,** each with its own permissions, is the target design. Built as its own epic when needed (planned for Release 3); until then, one of each | 6 Nov 2026 |
| **Who pays:** trainers first, then gyms, then an optional premium for individuals; the core stays free (section 4) | 6 Nov 2026 |
| **Launch activity scope is full, built in layers** (section 7) | 6 Nov 2026 |
| **A class is logged as one entry** (activity, duration, effort), with optional notes, distance and exercises underneath | 6 Nov 2026 |
| **Main measure of success:** people who train on GymJourno at least once a week (section 8) | 6 Nov 2026 |
| **Marketplace and community:** long-term only, and only if validated | 6 Nov 2026 |
| **Web app first**; native Android and iPhone apps later | Before Nov 2026 |

## 7. Activity scope, in layers

"Full" doesn't mean everything at once. Every activity shares one framework, and each category gets
up to three layers of support:

1. **Journal entry:** activity, duration, effort, notes (and distance where it applies).
2. **Structured tracking:** the parts inside it, such as sets, holds, poses or intervals.
3. **Guided content:** programs, instructions and demonstrations.

Minimum at launch (Release 1):

| Category | Journal entry | Structured tracking | Guided content |
| --- | --- | --- | --- |
| Strength | Yes | Yes: sets, reps, weight, effort, records | Yes: library with pictures, programs |
| Cardio (run, ride, row, walk, swim) | Yes | Yes: distance, time, pace | Library text |
| Yoga, mobility, stretching | Yes | Yes: poses and holds, optional | Library text (no pictures yet) |
| Classes (Zumba, dance, spin, HIIT, Pilates) | Yes | Optional: exercises underneath | Library text for common moves |
| Sport and other | Yes | — | — |

Each layer is added per category only when users show they want it.

## 8. Measuring success

**Main measure:** people who train on GymJourno at least once a week.

- **A qualifying account** is a real account (created on or after 7 November 2026, not a test
  account) that has finished sign-up and isn't paused.
- **Training** means at least one logged activity in the week: a workout with a performed set, a
  timed or distance entry, or a session.

**Three supporting dimensions** (tracked from the start so the main measure isn't read alone):

| Dimension | Question | Early measure |
| --- | --- | --- |
| Engagement | Are people recording consistently? | Weeks trained out of the last four |
| Progress | Are people moving towards their goals? | Share of people with a goal who are on track or reached it |
| Retention | Do people keep using it? | Return in week 2 and week 4 after sign-up |

Over time, the aim is to measure **weekly active fitness journeys that show sustained engagement and
real progress**, not just activity. Targets are set after four weeks of real users. Numbers come from
`supabase/queries/baseline_metrics.sql`.

## 9. Validation gates

Validation is a gate, not a nice-to-have. A release isn't considered done, and the next one isn't
locked in, until:

| Before … | Gate |
| --- | --- |
| Release 1 stories that depend on the discovery survey start | Enough survey responses: at least 20 from individuals (5 or more who take classes) and 5 from trainers, plus follow-ups with those who agree to try the app (numbers proposed, for Vijay to confirm); and those stories adjusted to what was learned. Stories needed whatever the chats say (measured kinds, timed and distance logging, data download, testing the leave journey) can be built in parallel |
| Each release is called done | Real people outside the team have used it, and their main issues are fixed or logged |
| Trainers are charged | At least a few trainers say they'd pay, at a stated price |
| Gym work starts | A real gym is ready to pilot |

## 10. Objectives

| # | Objective | How we'll see it |
| --- | --- | --- |
| O1 | **Every kind of training counts.** Lifting, cardio, yoga, Zumba, mobility and sport in one history | Share of weekly trainers who log something other than lifting |
| O2 | **Easy to start, easy to keep going.** A realistic first plan, reminders, flexible rescheduling, breaks without penalty | New people who log in week 1, and return in weeks 2 and 4 |
| O3 | **Progress people understand.** Records, trends and goals, not vanity numbers | People with a goal who are on track; people who look at progress |
| O4 | **Guidance by choice.** On your own, with AI, or with a trainer | Active clients per trainer; how useful people rate Coach |
| O5 | **A business trainers, then gyms, pay for** | Paying trainers, then paying gyms, and whether they stay |
| O6 | **Trust and control.** People see and control who has their data, and can take it with them | Data downloads that work; access revoked and honoured at once; zero sharing errors |
| O7 | **Reliable.** It works when someone is in the gym | Workouts saved without loss (including offline); reminders delivered; live-site checks passing |

## 11. What we're not doing

| Not doing | Until |
| --- | --- |
| A creator platform (hosting content, followers, feeds, selling programs, payouts) | Never: Instagram already does this |
| Charging individuals for anything marked "always free" in section 4 | Never |
| A marketplace to find and book trainers, gyms and classes, with reviews | Real demand, and a plan to bring enough trainers and gyms on board first |
| Community, challenges and a social feed | Real demand; private by default until then |
| Nutrition, recovery and lifestyle as a wellness platform | Validated (nutrition is a Release 2 decision) |
| Equipment, inventory and advanced gym finance | A gym asks for it |
| Native apps and Apple Health / Google Fit sync | The web app proves out |

## 12. Risks

| Risk | What we do about it |
| --- | --- |
| **No real users yet.** Everything so far is a guess | Validation gates (section 9) |
| **Doing too much at once** | One focus at a time in the order above; gyms and chains only when one asks |
| **Trainers may not pay enough to sustain the free core** | Ask trainers about price before building payments; Release 5 tests it |
| **Fitness advice can hurt people** | Coach answers from the person's records only, no medical claims, and points to a real trainer |
| **Trainer claims and qualifications** | Before trainer pages go public (Release 3), decide how qualifications and experience are shown, and whether any are verified |
| **Data ownership.** One person may have several trainers and gyms | Personal records, trainer-made records and shared access kept separate; permissions per relationship |
| **Gyms may want to own their members** | The individual keeps their history; written into terms with gyms |
| **Payments and memberships are complex** | Legal review and the provider's test mode before taking real money |
| **Health-adjacent personal data** | Consent first; privacy page kept current; India's data protection law reviewed before payments and before chains |

## 13. Open questions

| Question | Who decides | Needed by |
| --- | --- | --- |
| Prices for trainers, then gyms (D6) | Vijay, after asking trainers | Before Release 5 |
| Payment provider (D7); Razorpay is the natural fit for India | Vijay | Before Release 5 |
| How trainer qualifications are shown or verified | Vijay | Before Release 3 trainer pages |
| Where progress photos are stored (D3) | Vijay | Before Release 2 |
| Nutrition: build, connect or leave out (D4) | Vijay, after a short comparison | Release 2 |
| Native app approach (D8) | Vijay | Before native work |
| What individuals would pay for in a premium tier | Learn from real usage | After trainers and gyms pay |

---

## Change log

### Version 1.1 → 1.2 (Vijay's decision, 6 November 2026)

Discovery is a survey people fill in themselves, not one-to-one chats: they choose their role (individual, trainer, creator-trainer, gym owner) and answer that role's questions, mostly multiple choice about what they actually did. People who agree are followed up to try the app. The Release 1 gate (section 9) now waits for enough survey responses instead of six chats.

### Version 1.0 → 1.1 (approved by Vijay, 6 November 2026)

The Release 1 gate (section 9) now holds back only the stories that depend on the chats (class
logging, the yoga and dance library, how-you-train at sign-up, goals). Stories needed whatever the
chats say are built in parallel: exercises knowing how they're measured, timed and distance
logging, downloading your data, and testing the full leave journey. Everything stays local until
Vijay says.

### Version 0.3 → 1.0

Approved as the baseline product charter on 6 November 2026, with no content changes. Items the
review flagged for discovery, not the charter: primary and secondary goals with different progress
measures; testing the whole data-portability journey (download, leave a trainer, revoke access,
delete an account); how trainer qualifications and verification are shown.

### Version 0.2 → 0.3 (from the product-owner review)

| Change | Where |
| --- | --- |
| Aim reinstated, with vision and mission reworded as reviewed | Section 2 |
| Positioning set to "a complete personal fitness platform" (decision Q1) | Sections 3, 6 |
| Separate value propositions for individuals, trainers and gyms | Section 3 |
| "Free always" replaced by a defined free core; personal history and data download never paywalled; sustainability assumption stated | Section 4 |
| New principles: complete on its own (Q2), useful without AI; history principle covers download, revoking access and deletion; multiple and changing goals; life events | Section 5 |
| Several trainers and gyms per person as the target design (Q3) | Sections 1, 6 |
| "Full" activity scope defined as three layers, with the launch minimum per category | Section 7 |
| Qualifying account and logged activity defined; engagement, progress and retention added | Section 8 |
| Validation made a formal gate | Section 9 |
| Objectives O6 (trust and control) and O7 (reliability) added | Section 10 |
| Trainer qualifications added as a risk and open question; "trainers may not pay enough" added | Sections 12, 13 |
| Word file: header and footer corrected to this version | — |

### Version 0.1 → 0.2

| Version 0.1 section | What happened |
| --- | --- |
| Executive summary | **Changed:** replaced by "Where we are today" |
| Category and positioning | **Changed:** one positioning sentence plus "why they'd choose it" |
| Brand promise and tagline | **Changed:** kept "Your fitness journey. Your goals. Your way." |
| Aim, vision, mission | **Changed** in 0.2 (merged), **reinstated** in 0.3 |
| Objectives O1–O9 | **Changed:** combined, then extended to seven in 0.3 |
| Target audiences | **Approved** in spirit; summarised as primary user, primary customer and order of focus |
| Principles | **Approved,** with additions |
| Ecosystem boundaries | **Changed:** near-term ones live in the delivery plan; marketplace and community deferred |
| Measures of success | **Changed:** one main measure plus supporting dimensions; "no arbitrary targets yet" **approved** |
| Risks | **Approved,** with additions; mention of minors removed (GymJourno is for adults) |
| Decisions to finalise | **Decided:** all seven |
| What this charter doesn't decide | **Changed:** epics, stories and dates are in the delivery plan; architecture builds on the existing app |
| Recommended next step | **Changed:** user chats before Release 1 |
