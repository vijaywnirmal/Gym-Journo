// Rolling 24 hours, counted from saved exchanges that got an answer back from the model (accepted or
// rejected by verification). Blocked questions and model calls that failed outright (provider down,
// out of credit, timed out) cost the person nothing, so they don't use up the allowance. Rolling
// rather than "since midnight" so it doesn't depend on a timezone.
export const COACH_LIMIT_PER_DAY = 10;

// Backstop over ALL attempts that reached the model, failed ones included, so a failing call can't be
// retried without bound (a timeout may still be billed).
export const COACH_ATTEMPT_CEILING_PER_DAY = 40;
export const COACH_WINDOW_MS = 24 * 60 * 60 * 1000;
