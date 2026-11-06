// The front door: pages anyone can open without an account, laid out full width with their own
// header instead of the app's navigation. "/" is the public home page only when signed out; signed
// in, it's Today.
const PUBLIC_PATHS = ["/trainers", "/gyms", "/demo"];

export function isPublicPage(pathname: string, signedIn: boolean): boolean {
  if (pathname === "/") return !signedIn;
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

// Open to signed-out visitors in the proxy: the pages above, and the link-preview images that
// WhatsApp, Instagram and others fetch without cookies.
export function isOpenToSignedOut(pathname: string): boolean {
  return isPublicPage(pathname, false) || /(^|\/)(opengraph|twitter)-image(-[\w-]+)?$/.test(pathname);
}

// "Start free" on the front door: the sign-up form.
export const SIGN_UP_HREF = "/login?signup=1";
