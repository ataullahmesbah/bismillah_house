import type { Metadata } from "next";

import { PageHeader } from "@/components/ui";
import { ProfileForm } from "@/components/site/account-forms";
import { requireUser } from "@/lib/auth/guards";
import { getSettings } from "@/lib/settings";
import { buildMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return buildMetadata(settings.seo, { title: "Profile", path: "/account/profile", noIndex: true });
}

export default async function ProfilePage() {
  const user = await requireUser();
  return (
    <>
      <PageHeader title="Profile" description="Keep your contact details up to date so we can reach you about orders." />
      <ProfileForm user={{ name: user.name, email: user.email, phone: user.phone }} />
    </>
  );
}
