import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { LoginForm } from "@/components/site/auth-forms";
import { getCurrentUser } from "@/lib/auth/session";
import { isStaffRole } from "@/lib/constants";
import { getSettings } from "@/lib/settings";
import { isGoogleSignInActive } from "@/lib/auth/google";
import { activeCaptchaSiteKey } from "@/lib/auth/captcha";
import { buildMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return buildMetadata(settings.seo, { title: "Sign in", path: "/login", noIndex: true });
}

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(isStaffRole(user.role) ? "/dashboard" : "/account");

  return (
    <Suspense fallback={<div className="skeleton h-96" />}>
      <LoginForm googleEnabled={await isGoogleSignInActive()} captchaSiteKey={await activeCaptchaSiteKey("login")} />
    </Suspense>
  );
}
