import type { RoleKey } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      roles: RoleKey[];
      onboardingCompleted: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    roles?: RoleKey[];
    onboardingCompleted?: boolean;
  }
}
