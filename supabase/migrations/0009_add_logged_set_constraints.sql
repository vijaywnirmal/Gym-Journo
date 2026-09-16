-- Phase 6: reject obviously invalid set values at the database layer (belt-and-suspenders
-- alongside server-action validation — the RPC in 0010 is the actual write path).
alter table logged_sets
  add constraint logged_sets_reps_nonnegative check (reps is null or reps >= 0);
alter table logged_sets
  add constraint logged_sets_weight_nonnegative check (weight is null or weight >= 0);
