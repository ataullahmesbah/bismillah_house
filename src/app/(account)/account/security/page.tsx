import type { Metadata } from "next";

import { PageHeader } from "@/components/ui";
import { ChangePasswordForm, SignOutEverywhereForm } from "@/components/site/account-forms";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { getSettings } from "@/lib/settings";
import { buildMetadata } from "@/lib/seo";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return buildMetadata(settings.seo, { title: "Security", path: "/account/security", noIndex: true });
}

export default async function SecurityPage() {
  const user = await requireUser();

  const sessions = await prisma.session.findMany({
    where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastSeenAt: "desc" },
    take: 10,
    select: { id: true, ipAddress: true, userAgent: true, createdAt: true, lastSeenAt: true },
  });

  return (
    <>
      <PageHeader title="Security" description="Manage your password and signed-in devices." />

      <div className="stack">
        <ChangePasswordForm />

        <section className="card">
          <div className="card-header"><h2 className="card-title">Signed-in devices</h2></div>
          <div className="table-wrap border-0">
            <table className="table table-compact">
              <thead>
                <tr><th>Device</th><th>IP</th><th>Signed in</th><th>Last active</th></tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr key={session.id}>
                    <td className="max-w-xs truncate text-xs">{session.userAgent ?? "Unknown device"}</td>
                    <td className="mono text-xs">{session.ipAddress ?? "—"}</td>
                    <td className="text-xs">{formatDateTime(session.createdAt)}</td>
                    <td className="text-xs">{formatDateTime(session.lastSeenAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <SignOutEverywhereForm />
      </div>
    </>
  );
}
