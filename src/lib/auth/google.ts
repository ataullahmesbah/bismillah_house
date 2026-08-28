import "server-only";

import { createHash, randomBytes } from "node:crypto";

/**
 * Google sign-in.
 *
 * Configured entirely through the environment, so the shop can turn it on
 * without a code change and the buttons simply do not render until it is set
 * up. Uses the authorization-code flow with PKCE and a signed state value:
 * the code alone is useless to anyone who intercepts the redirect.
 */

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";

export const GOOGLE_STATE_COOKIE = "tm_google_state";
export const GOOGLE_VERIFIER_COOKIE = "tm_google_verifier";

export function googleConfig() {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    /** Must match the redirect URI registered in the Google console. */
    redirectUri:
      process.env.GOOGLE_REDIRECT_URI ??
      `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/auth/google/callback`,
  };
}

/** OAuth credentials present. Says nothing about whether the shop wants it on. */
export function isGoogleSignInConfigured(): boolean {
  const { clientId, clientSecret } = googleConfig();
  return Boolean(clientId) && Boolean(clientSecret);
}

/**
 * Whether "Continue with Google" is available right now.
 *
 * Both the credentials and the dashboard switch have to agree. Checked in the
 * route that starts the flow as well as where the button is rendered — hiding
 * a button does not stop anyone visiting the URL it points at.
 */
export async function isGoogleSignInActive(): Promise<boolean> {
  if (!isGoogleSignInConfigured()) return false;
  const { getSettingGroup } = await import("@/lib/settings");
  return (await getSettingGroup("security")).googleAuthEnabled;
}

function base64Url(input: Buffer): string {
  return input.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** PKCE pair: the verifier stays in a cookie, only its hash goes to Google. */
export function createPkcePair() {
  const verifier = base64Url(randomBytes(32));
  const challenge = base64Url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

export function createState(): string {
  return base64Url(randomBytes(24));
}

export function buildAuthorizationUrl(state: string, challenge: string, next?: string | null): string {
  const { clientId, redirectUri } = googleConfig();

  const url = new URL(AUTH_ENDPOINT);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  // The state carries where to land afterwards, and is checked against the
  // cookie on the way back, so it cannot be used to redirect somewhere else.
  url.searchParams.set("state", next ? `${state}|${next}` : state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

export type GoogleProfile = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture: string | null;
};

/** Exchanges the code for tokens and returns the profile Google reports. */
export async function exchangeCodeForProfile(code: string, verifier: string): Promise<GoogleProfile> {
  const { clientId, clientSecret, redirectUri } = googleConfig();

  const tokenResponse = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!tokenResponse.ok) {
    throw new Error(`Google token exchange failed (${tokenResponse.status})`);
  }

  const tokens = (await tokenResponse.json()) as { access_token?: string };
  if (!tokens.access_token) throw new Error("Google did not return an access token.");

  const profileResponse = await fetch(USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
    signal: AbortSignal.timeout(10_000),
  });

  if (!profileResponse.ok) {
    throw new Error(`Google profile lookup failed (${profileResponse.status})`);
  }

  const profile = (await profileResponse.json()) as {
    sub?: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
  };

  if (!profile.sub || !profile.email) throw new Error("Google returned an incomplete profile.");

  return {
    sub: profile.sub,
    email: profile.email.toLowerCase(),
    emailVerified: profile.email_verified === true,
    name: profile.name?.trim() || profile.email.split("@")[0],
    picture: profile.picture ?? null,
  };
}
