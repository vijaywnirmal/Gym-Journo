# Gym-Journo — Milestones

The path from "solid personal logger" to something that competes with Strong, Hevy and Fitbod.
Work top to bottom: one milestone at a time, each finished, tested and bug-free before the next starts.

Each milestone is done when: typecheck, lint and tests pass; new logic has unit tests; existing
behaviour has no regressions.

## Tier 1 — Parity with market leaders

- [x] **M1. Personal records (PRs)** — detect new bests (heaviest weight, best estimated 1RM, best
      session volume) against all earlier sessions of the exercise, and celebrate them in the logger
      while you train.
- [x] **M2. Rest timer** — a countdown that starts when a set is completed, with presets per
      exercise, vibration/sound at zero, and it survives switching exercises.
- [x] **M3. "Same as last time" pre-fill** — one tap copies the previous session's sets into the
      current exercise, plus a plate calculator for barbell lifts.
- [x] **M4. Richer set data** — RPE/RIR effort, set types (warm-up, working, drop, failure),
      per-exercise notes; warm-ups excluded from PRs and volume.
- [x] **M5. Installable offline app (PWA)** — manifest, icons, service worker, offline logging
      queue that syncs when back online.
- [x] **M6. Bigger exercise library** — equipment tags, instructions, search and filters.

## Tier 2 — Differentiate

- [x] **M7. Weekly muscle analytics** — working sets per muscle group per week against a target
      range; streaks and plan adherence on the Today screen.
- [x] **M8. PR history & records page** — every PR over time, per exercise, shown on Progress.
- [x] **M9. Multi-week programs** — pick a program (PPL, 5/3/1, GZCLP…) and auto-schedule it onto
      the calendar from templates.
- [x] **M10. Coach "Adapt" stage** — evidence-cited progressive-overload suggestions (next weight,
      deload), still validated against the person's own records.
- [ ] **M11. Health integrations** — body weight and workouts with Apple Health / Health Connect.
      *Blocked on M15: neither has a web API; both need a native app shell.*

## Tier 3 — Growth & revenue

- [x] **M12. Sharing** — shareable workout summary cards (private image via the device share sheet;
      no public links).
- [ ] **M12b. Follow / feed** — *needs a product decision: public profiles would change the app's
      private-by-default stance.*
- [ ] **M13. Structured nutrition** — macro logging, or integration with a nutrition app.
      *Needs a decision: build a food database or integrate an existing app.*
- [ ] **M14. Pro tier** — subscription gating for Coach Adapt, programs and advanced analytics.
      *Needs a decision: payment provider, prices and what is free vs paid.*
- [ ] **M15. Native wrapper & watch** — Capacitor/Expo shell, push reminders, watch set logging.
      *Needs a decision: Capacitor vs Expo, and Apple/Google developer accounts.*
