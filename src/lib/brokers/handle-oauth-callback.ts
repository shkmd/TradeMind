import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth/auth";
import { completeLiveConnect, PENDING_CONNECTION_COOKIE } from "@/server/services/broker-connect.service";
import { prisma } from "@/lib/db/prisma";

/**
 * Shared by every redirect-login broker's callback route
 * (zerodha/dhan/upstox) — only the query-param name carrying the one-time
 * token/code differs per broker's own redirect convention, which each
 * route.ts passes in as `tokenParam`.
 */
export async function handleOAuthCallback(
  request: NextRequest,
  brokerLabel: string,
  tokenParam: string,
  isFailure: (params: URLSearchParams) => boolean
): Promise<NextResponse> {
  const params = request.nextUrl.searchParams;
  const token = params.get(tokenParam);

  const cookieStore = await cookies();
  const connectionId = cookieStore.get(PENDING_CONNECTION_COOKIE)?.value;
  cookieStore.delete(PENDING_CONNECTION_COOKIE);

  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", request.nextUrl.origin));
  }

  if (!connectionId) {
    return NextResponse.redirect(
      new URL(
        "/broker-accounts?connectError=" + encodeURIComponent("Connection session expired — try again."),
        request.nextUrl.origin
      )
    );
  }

  const connection = await prisma.brokerConnection.findUnique({
    where: { id: connectionId },
    include: { brokerAccount: true },
  });

  // Only the account's own owner can complete this connection.
  if (!connection || connection.brokerAccount.userId !== session.user.id) {
    return NextResponse.redirect(new URL("/broker-accounts", request.nextUrl.origin));
  }

  const redirectTo = new URL(`/broker-accounts/${connection.brokerAccountId}`, request.nextUrl.origin);

  if (isFailure(params) || !token) {
    await prisma.brokerConnection.update({ where: { id: connectionId }, data: { status: "REVOKED" } });
    redirectTo.searchParams.set("connectError", `${brokerLabel} login was cancelled or failed.`);
    return NextResponse.redirect(redirectTo);
  }

  try {
    await completeLiveConnect(connectionId, token);
    redirectTo.searchParams.set("connected", "1");
  } catch (error) {
    await prisma.brokerConnection.update({ where: { id: connectionId }, data: { status: "REVOKED" } });
    redirectTo.searchParams.set(
      "connectError",
      error instanceof Error ? error.message : `Could not complete the ${brokerLabel} connection.`
    );
  }

  return NextResponse.redirect(redirectTo);
}
