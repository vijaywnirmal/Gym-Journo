// Supabase Auth errors in the app's own words, for the sign-in and sign-up forms. Unknown errors
// get a general message rather than Supabase's technical one. Pure.

const MESSAGES: Record<string, string> = {
  invalid_credentials: "That email and password don't match. Check them, or reset your password.",
  over_email_send_rate_limit: "Too many emails sent just now. Wait a few minutes and try again.",
  over_request_rate_limit: "Too many attempts just now. Wait a few minutes and try again.",
  same_password: "Choose a password different from your current one.",
  weak_password: "Choose a stronger password: at least 8 characters, not a common one.",
  email_address_invalid: "Enter a valid email address.",
  signup_disabled: "New accounts can't be created right now. Please try again later.",
};

export const GENERIC_AUTH_ERROR = "Something went wrong. Please try again.";

export function friendlyAuthError(error: { code?: string; message?: string }): string {
  return (error.code && MESSAGES[error.code]) || GENERIC_AUTH_ERROR;
}
