-- Coach (stage C1, explain-only): an auditable record of each exchange.
--
-- Stores exactly what the model was given (the evidence snapshot, plain JSON built by
-- buildTrainingEvidence), the question, what the model returned, the reply that survived
-- verification (null when it was rejected or blocked), and the verification issues — so any answer
-- can be replayed and any bad one diagnosed. It is history, not configuration: rows are never
-- edited after insert. It deliberately holds no plan changes; recommendations and their approval
-- ledger belong to a later stage.
create table coach_replies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question text not null,
  evidence jsonb not null,
  status text not null,
  reply jsonb,
  raw_reply text,
  issues jsonb not null default '[]'::jsonb,
  model text,
  created_at timestamptz not null default now(),
  constraint coach_replies_status_valid check (status in ('accepted', 'rejected', 'blocked'))
);

alter table coach_replies enable row level security;

create policy "coach_replies own" on coach_replies
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create index coach_replies_user_created_idx on coach_replies (user_id, created_at desc);
