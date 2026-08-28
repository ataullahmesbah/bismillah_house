import "server-only";

import { errors } from "@/lib/api";
import { getSettingGroup } from "@/lib/settings";

/**
 * Bot check on the sign-in and registration forms.
 *
 * Cloudflare Turnstile, which is free and — unlike reCAPTCHA — usually
 * resolves without making the visitor pick out traffic lights.
 *
 * Two things have to be true for a challenge to run: the keys are present in
 * the environment, and the owner has switched it on in dashboard settings.
 * Either missing means every check passes, so the widget's absence is never a
 * silent hole to reason about — it is either plainly on or plainly off.
 *
 * The toggle is read on the server in `assertCaptcha`, not only where the
 * widget is rendered. Hiding a widget stops nothing; skipping the check would.
 */

const VERIFY_ENDPOINT = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function turnstileSiteKey(): string {
  return process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
}

/** Keys present. Says nothing about whether the shop wants it on. */
export function isCaptchaConfigured(): boolean {
  return Boolean(turnstileSiteKey()) && Boolean(process.env.TURNSTILE_SECRET_KEY);
}

export type CaptchaSurface = "login" | "register";

/**
 * Whether a challenge actually applies to this form right now.
 *
 * A shop can protect sign-up (where the bots are) without adding friction to
 * sign-in, so the two are separate switches.
 */
export async function isCaptchaActive(surface: CaptchaSurface): Promise<boolean> {
  if (!isCaptchaConfigured()) return false;
  const security = await getSettingGroup("security");
  if (!security.turnstileEnabled) return false;
  return surface === "login" ? security.turnstileOnLogin : security.turnstileOnRegister;
}

/** The site key to render with, or "" when the challenge does not apply. */
export async function activeCaptchaSiteKey(surface: CaptchaSurface): Promise<string> {
  return (await isCaptchaActive(surface)) ? turnstileSiteKey() : "";
}

/**
 * Throws when the challenge is missing or rejected.
 *
 * A network failure reaching Cloudflare is treated as a pass: a captcha
 * outage must not take sign-in down with it, and the rate limits are the
 * real defence against a determined attacker anyway.
 */
export async function assertCaptcha(
  token: string | null | undefined,
  remoteIp?: string | null,
  surface: CaptchaSurface = "login",
): Promise<void> {
  // Re-checked here rather than trusted from the page: a request can be posted
  // without ever loading the form the widget lives on.
  if (!(await isCaptchaActive(surface))) return;

  if (!token) {
    throw errors.validation("Please complete the verification and try again.", {
      captcha: "Verification required.",
    });
  }

  let outcome: { success?: boolean } = {};
  try {
    const response = await fetch(VERIFY_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: process.env.TURNSTILE_SECRET_KEY ?? "",
        response: token,
        ...(remoteIp ? { remoteip: remoteIp } : {}),
      }),
      signal: AbortSignal.timeout(8_000),
    });
    outcome = (await response.json()) as { success?: boolean };
  } catch (error) {
    console.error("[trust-mart] Turnstile verification unreachable:", error);
    return;
  }

  if (!outcome.success) {
    throw errors.validation("That verification did not pass. Please try again.", {
      captcha: "Verification failed.",
    });
  }
}
