import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { RegisterForm } from "@/components/site/auth-forms";
import { getCurrentUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings";
import { isGoogleSignInActive } from "@/lib/auth/google";
import { activeCaptchaSiteKey } from "@/lib/auth/captcha";
import { buildMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return buildMetadata(settings.seo, { title: "Create an account", path: "/register", noIndex: true });
}

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect("/account");

  return (
    <Suspense fallback={<div className="skeleton h-[32rem]" />}>
      <RegisterForm googleEnabled={await isGoogleSignInActive()} captchaSiteKey={await activeCaptchaSiteKey("register")} />
    </Suspense>
  );
}
