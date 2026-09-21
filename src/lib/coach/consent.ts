// Consent for sending training evidence to Coach's external model. Consent is opt-in, recorded as
// a timestamp on the profile (0014_add_coach_consent.sql), enforced on the server for every Coach
// request, and withdrawable at any time.

export function hasCoachConsent(profile: { coach_consent_at?: string | null } | null): boolean {
  return !!profile?.coach_consent_at;
}

// Shown in Profile where consent is given. States what is sent, what is not, who receives it, what
// is kept, and what withdrawing does — kept here so the wording has one home and is tested against
// what the evidence actually contains.
export const COACH_CONSENT = {
  summary:
    "Coach explains what your training records show. To do that, your training data is sent to Google's Gemini model when you ask a question.",
  shared: [
    "Your goal settings: goal, experience level, training days per week, and target weight",
    "How many days you trained recently and in each of the last weeks",
    "Recent sets, reps and weights for exercises you've performed lately, with exercise names",
    "Your body-weight measurements and their dates",
    "The question you type",
  ],
  notShared: [
    "Your name, email, date of birth, height, or gender",
    "Workout notes, body-measurement notes, and nutrition entries",
  ],
  kept:
    "Each question, the data sent, and the reply are saved in your account. They are deleted if you delete your account.",
  withdraw:
    "You can withdraw at any time. Coach then stops sending your data. Exchanges already saved stay in your account until you delete it.",
  limits: "Coach doesn't give advice, and it can't help with pain or injuries.",
} as const;
