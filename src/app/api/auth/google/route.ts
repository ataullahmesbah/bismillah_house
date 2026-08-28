import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import {
  buildAuthorizationUrl, createPkcePair, createState,
  GOOGLE_STATE_COOKIE, GOOGLE_VERIFIER_COOKIE, isGoogleSignInActive,
} from "@/lib/auth/google";
import { safeRedirectPath } from "@/lib/utils";

/** Starts Google sign-in. */
export async function GET(request: NextRequest) {
  if (!(await isGoogleSignInActive())) {
    return NextResponse.redirect(new URL("/login?error=google-unavailable", request.url));
  }

  const state = createState();
  const { verifier, challenge } = createPkcePair();

  // Only ever an in-app path, so the callback cannot be talked into sending
  // the freshly signed-in visitor to another site.
  const next = safeRedirectPath(request.nextUrl.searchParams.get("next"), "");

  const jar = await cookies();
  const secure = request.nextUrl.protocol === "https:";
  const options = {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 10 * 60,
  };

  jar.set(GOOGLE_STATE_COOKIE, state, options);
  jar.set(GOOGLE_VERIFIER_COOKIE, verifier, options);

  return NextResponse.redirect(buildAuthorizationUrl(state, challenge, next || null));
}
