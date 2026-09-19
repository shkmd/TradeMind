import { getCsrfToken } from "next-auth/react";

/**
 * Forces Auth.js to re-run the `jwt` callback with `trigger: "update"` and
 * write a fresh session cookie — without requiring a global <SessionProvider>
 * (this app doesn't have one; login/register already call signIn()/getCsrfToken()
 * standalone the same way). This is exactly what useSession().update() does
 * internally (see next-auth/react's client.js fetchData("session", ...)),
 * replicated directly so pages don't need the provider just for this.
 *
 * Needed after any server action that changes something the JWT caches
 * (e.g. Profile.onboardingCompletedAt) — middleware reads the JWT, not the
 * DB, so without this the user gets bounced back by a stale token.
 */
export async function refreshSessionToken(): Promise<void> {
  const csrfToken = await getCsrfToken();
  await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ csrfToken }),
  });
}
