import type { Metadata } from "next";
import { Suspense } from "react";

import { ForgotPasswordForm } from "@/components/site/auth-forms";
import { getSettings } from "@/lib/settings";
import { buildMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return buildMetadata(settings.seo, { title: "Forgot password", path: "/forgot-password", noIndex: true });
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<div className="skeleton h-72" />}>
      <ForgotPasswordForm />
    </Suspense>
  );
}
