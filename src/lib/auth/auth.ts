import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db/prisma";
import { authConfig } from "@/lib/auth/auth.config";
import type { RoleKey } from "@prisma/client";

// NOTE: Auth.js does not support the "database" session strategy together
// with the Credentials provider (Credentials sign-in never creates an
// adapter session row) — it requires "jwt". We still get real user/role
// persistence via Prisma; DeviceSession rows (for the future Settings >
// Security device list) are written separately in the Credentials
// `authorize()` callback below, independent of the session strategy.
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user, trigger }) {
      // On initial sign-in, populate roles + onboarding status into the JWT.
      if (user?.id) {
        token.userId = user.id;
        const userRoles = await prisma.userRole.findMany({
          where: { userId: user.id },
          include: { role: true },
        });
        token.roles = userRoles.map((ur) => ur.role.key);

        const profile = await prisma.profile.findUnique({ where: { userId: user.id } });
        token.onboardingCompleted = Boolean(profile?.onboardingCompletedAt);
      }

      // A JWT session is only re-populated from `user` at sign-in — without
      // this, onboardingCompleted stays permanently false in the token even
      // after the DB is updated, and middleware bounces the user back to
      // /onboarding forever. The onboarding form calls useSession().update()
      // on success specifically to trigger this refresh before redirecting.
      if (trigger === "update" && token.userId) {
        const profile = await prisma.profile.findUnique({ where: { userId: token.userId as string } });
        token.onboardingCompleted = Boolean(profile?.onboardingCompletedAt);
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId as string;
        session.user.roles = (token.roles as RoleKey[]) ?? [];
        session.user.onboardingCompleted = Boolean(token.onboardingCompleted);
      }
      return session;
    },
  },
});
