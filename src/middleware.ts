import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";

const PUBLIC_PATHS = ["/login", "/register"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PATHS.some((path) => pathname.startsWith(path));
  const isAuthenticated = Boolean(req.auth?.user);

  if (!isAuthenticated && !isPublic) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthenticated && isPublic) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl.origin));
  }

  if (
    isAuthenticated &&
    !req.auth?.user.onboardingCompleted &&
    pathname !== "/onboarding" &&
    !pathname.startsWith("/api")
  ) {
    return NextResponse.redirect(new URL("/onboarding", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
  // Node.js runtime, not Edge: auth.ts pulls in the Prisma client and
  // bcryptjs, neither of which run on the Edge runtime.
  runtime: "nodejs",
};
