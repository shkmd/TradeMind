import { redirect } from "next/navigation";
import type { RoleKey } from "@prisma/client";
import { auth } from "@/lib/auth/auth";

/** Coarse gate: any authenticated user. Redirects to /login otherwise. */
export async function requireSession() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session;
}

/**
 * Fine-grained per-page gate. Middleware only checks "is authenticated" +
 * onboarding status; individual pages (e.g. Billing → Administrator only)
 * call this to enforce role restrictions.
 */
export async function requireRole(allowed: RoleKey[]) {
  const session = await requireSession();
  const hasRole = session.user.roles.some((role) => allowed.includes(role));
  if (!hasRole) redirect("/dashboard");
  return session;
}
