-- ai_plans and coach_replies are what the daily AI limits count (src/app/ai-plan/actions.ts,
-- src/app/coach/actions.ts). Their "own" policies were FOR ALL, so anyone could delete or rewrite
-- their own rows through the public REST API to reset a limit and run up unlimited Gemini calls,
-- and could erase Coach's audit record. People can now only read and add their own rows. The rows
-- still go with the account: ON DELETE CASCADE from auth.users, and deleteAccount removes them with
-- the service role.
drop policy "ai_plans own" on ai_plans;
create policy "ai_plans read own" on ai_plans for select using (user_id = auth.uid());
create policy "ai_plans add own" on ai_plans for insert with check (user_id = auth.uid());

drop policy "coach_replies own" on coach_replies;
create policy "coach_replies read own" on coach_replies for select using (user_id = auth.uid());
create policy "coach_replies add own" on coach_replies for insert with check (user_id = auth.uid());
