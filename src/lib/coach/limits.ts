// Rolling 24 hours, counted from saved exchanges that actually called the model (accepted or
// rejected — blocked questions cost nothing). Rolling rather than "since midnight" so it doesn't
// depend on a timezone.
export const COACH_LIMIT_PER_DAY = 10;
export const COACH_WINDOW_MS = 24 * 60 * 60 * 1000;
