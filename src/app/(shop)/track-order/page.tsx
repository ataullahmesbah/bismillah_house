import type { Metadata } from "next";

import { Breadcrumb } from "@/components/ui";
import { TrackOrderForm } from "@/components/site/track-order-form";
import { getSettings } from "@/lib/settings";
import { buildMetadata } from "@/lib/seo";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return buildMetadata(settings.seo, {
    title: "Track your order",
    description: "Enter your order number and mobile number to see live delivery status.",
    path: "/track-order",
  });
}

export default async function TrackOrderPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const reference = typeof params.ref === "string" ? params.ref : undefined;

  return (
    <div className="tm-container section">
      <div className="mx-auto max-w-3xl">
        <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Track order" }]} />
        <h1 className="page-title mt-3">Track your order</h1>
        <p className="page-desc mb-6">
          For your security we ask for both the order number and the mobile number used on the order.
        </p>
        <TrackOrderForm defaultReference={reference} />
      </div>
    </div>
  );
}
