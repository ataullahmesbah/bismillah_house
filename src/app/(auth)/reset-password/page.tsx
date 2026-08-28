import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ResetPasswordForm } from "@/components/site/auth-forms";
import { getSettings } from "@/lib/settings";
import { buildMetadata } from "@/lib/seo";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return buildMetadata(settings.seo, { title: "Reset password", path: "/reset-password", noIndex: true });
}

export default async function ResetPasswordPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";

  if (!token) {
    return (
      <div className="card">
        <div className="card-body text-center">
          <h1 className="text-xl font-bold">Reset link missing</h1>
          <p className="mt-2 text-sm text-brand-600">
            This page needs a valid reset link. Request a new one to continue.
          </p>
          <Link href="/forgot-password" className="btn-primary mt-5">Request a new link</Link>
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={<div className="skeleton h-80" />}>
      <ResetPasswordForm token={token} />
    </Suspense>
  );
}
