import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(rawCredentials, request) {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
        });

        if (!user || !user.passwordHash || !user.isActive) return null;

        const passwordValid = await bcrypt.compare(password, user.passwordHash);
        if (!passwordValid) return null;

        // Best-effort device-session bookkeeping so Settings > Security has
        // real rows to display later, even though no management UI ships
        // this phase. Never blocks login on failure.
        try {
          await prisma.deviceSession.create({
            data: {
              userId: user.id,
              userAgent: request?.headers?.get("user-agent") ?? undefined,
              ipAddress:
                request?.headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
            },
          });
        } catch {
          // non-fatal
        }

        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
    // Google login only registers when credentials are configured, so the
    // app runs fully without any Google Cloud setup.
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
  ],
};
