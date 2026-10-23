# Trainer pilot checklist

1 trainer, 5–10 clients, 4 weeks, free. The week 0 session is day 1 of week 1.

## Before week 0

- [ ] Everything is merged to `master` and deployed: Vercel's production deployment is the latest
      `master` commit, and the **Production E2E** run for it passed (GitHub → Actions).
- [ ] Migrations are applied: the latest **Migrate production database** run passed, and in
      Supabase → SQL Editor `select max(version) from supabase_migrations.schema_migrations;`
      returns `0035` or later.
- [ ] Push notification keys are set in Vercel → Settings → Environment Variables (Production):
      `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`,
      `SUPABASE_SERVICE_ROLE_KEY`, then redeploy. GitHub has the variable `APP_URL` and the secret
      `CRON_SECRET`; a manual run of **Send workout reminders** passes. (README → Deploying.)
- [ ] Vercel error alerts are on (needs Pro with Observability Plus):
  1. Vercel → team **Settings → Alerts → Add Alert Rule**.
  2. Under **Triggers**, pick **Error anomaly**, keep **5xx**, click **Next**.
  3. Name it, scope it to this project, click **Create Alert Rule**.
  4. Under **Configure notifications**, tick Low, Medium and High, add **Your Notifications**
     (email and push), click **Done**.

  Alerts start 24 hours after Observability Plus is on, and pilot traffic may be too low to set
  them off, so also look at the project's **Logs** for errors at each check-in.
- [ ] The trainer flow works on production, with throwaway accounts (one trainer, one client, in
      two browsers):
  - [ ] `/login` → **I'm a trainer** → create the account, confirm the email, fill in the trainer
        details.
  - [ ] **Invite** → **Share on WhatsApp** sends the link; the client opens it, signs up, finishes
        onboarding and joins.
  - [ ] The trainer plans two of the client's days, one of them today; the client sees them.
  - [ ] The client logs a set today; the trainer's **Clients** shows it done.
  - [ ] On an iPhone: add the app to the Home Screen, turn on **Workout reminders** in Profile, and
        a reminder arrives at the chosen time on a planned day.
  - [ ] Delete both accounts (Profile → Delete account).

## Week 0 session (30 minutes, with the trainer)

- [ ] 0–5: the trainer signs up at gymjourno.fit → **I'm a trainer**, and fills in name, gym, city
      and WhatsApp number.
- [ ] 5–10: the trainer sends the invite link on WhatsApp to one client who is there or reachable;
      that client joins.
- [ ] 10–20: plan that client's week together on the trainer's phone.
- [ ] 20–25: the trainer sends the link to the other clients.
- [ ] 25–30: every client who is there adds the app to the Home Screen (iPhone: Safari → Share →
      Add to Home Screen; Android: Chrome → menu → Add to Home screen) and turns on reminders in
      Profile. Ask the trainer to check the others do the same.
- [ ] Write down today's date (the pilot start) and agree a time for the weekly check-in.

## Weekly check-in (10 minutes, weeks 1–4)

- [ ] Run `pilot_metrics.sql` beforehand. Look at this week's line: clients logging 3+ days, and
      how many the trainer planned for.
- [ ] Ask: what annoyed you most this week? What did you still do on WhatsApp or in the notebook?
- [ ] Pick the top annoyance and fix it before the next check-in.
- [ ] Check Vercel alerts and Logs for errors.
- [ ] Join links last 14 days: from week 2, clients who haven't joined need a new one
      (**Invite → Make a new link**, which cancels the old link).
- [ ] If the trainer has stopped planning by week 2, talk to them before building anything more.

## End of week 4

- [ ] Run `pilot_metrics.sql`.
- [ ] 20 minutes with the trainer:
  - Did this save you time compared with WhatsApp and notebooks?
  - What would you pay a month for all your clients: nothing, ₹299, ₹499 or ₹999?
- [ ] WhatsApp poll for the clients, 3 questions:
  1. Did having the plan in the app make you train more? (More / Same / Less)
  2. Would you keep using it if your trainer stopped? (Yes / Maybe / No)
  3. What helped most? (The plan / Reminders / Logging sets / My trainer seeing my workouts)
- [ ] Decide: keep going, change course or stop.

| Metric | Good sign at week 4 | `pilot_metrics.sql` line |
| --- | --- | --- |
| Invites accepted | 70%+ | Clients who accepted ÷ clients the trainer sent the link to |
| Clients logging 3+ sessions a week | Half of them, most weeks | Weeks half the clients or more logged 3+ days |
| Clients still logging in week 4 | 6 of 10, or the same share | Clients logging in week 4 |
| Weeks the trainer planned for most clients | All 4 | Weeks the trainer planned for half the clients or more |
| Trainer plans clients edited | Some | Trainer plans clients edited |

**Go to a second trainer, with a first price,** if the trainer planned every week, wants to keep
it, and most clients still log in week 4. **If the trainer stopped planning by week 2,** talk to
them before building more.

## Running `pilot_metrics.sql`

[`supabase/queries/pilot_metrics.sql`](../supabase/queries/pilot_metrics.sql) only reads.

1. Get the trainer's user id: Supabase → Authentication → Users → search their email → copy the
   UID (or run `select user_id, display_name from trainer_profiles;`).
2. In the file's `params`, set `trainer_id` to it and `pilot_start` to the week 0 session date.
3. Paste the whole file into Supabase → SQL Editor and run it, or send it as `query` to the
   Management API's `POST /v1/projects/<ref>/database/query`.
4. The summary comes first (`result` column), then one line per client per week with workout days,
   days planned, days the trainer planned, and the trainer's plans the client edited. The first
   line names the trainer: `NOT FOUND` means the id is wrong.

"Invites sent" isn't stored, because the link goes out on WhatsApp: ask the trainer how many
clients they sent it to.
