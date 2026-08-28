import Link from "next/link";

import { getSettings } from "@/lib/settings";

/**
 * Split layout for sign-in and registration.
 *
 * The form sits on the right; the left panel says what the shop actually
 * offers — cash on delivery, nationwide delivery, easy returns. On a phone
 * the panel collapses to a short header so the form stays above the fold,
 * which is where most sign-ins happen.
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();

  const highlights = [
    {
      title: "Cash on delivery",
      body: "Pay when the parcel reaches you. No card needed.",
      icon: "৳",
    },
    {
      title: "All 64 districts",
      body: "Nationwide delivery with a charge you see before you order.",
      icon: "◎",
    },
    {
      title: "Easy returns",
      body: "Seven days to report a problem with anything you receive.",
      icon: "↩",
    },
  ];

  return (
    <div className="min-h-dvh bg-surface-muted lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <aside className="relative hidden overflow-hidden bg-brand-950 text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, #fff 0, transparent 45%), radial-gradient(circle at 80% 70%, #fff 0, transparent 40%)",
          }}
          aria-hidden="true"
        />

        <Link href="/" className="relative text-xl font-extrabold tracking-tight">
          {settings.site.siteName}
        </Link>

        <div className="relative max-w-md">
          <h2 className="text-3xl font-extrabold leading-tight text-white">
            {settings.site.tagline}
          </h2>

          <ul className="mt-8 space-y-5">
            {highlights.map((item) => (
              <li key={item.title} className="flex gap-3.5">
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-base font-bold"
                  aria-hidden="true"
                >
                  {item.icon}
                </span>
                <span>
                  <span className="block font-semibold">{item.title}</span>
                  <span className="block text-sm text-brand-300">{item.body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-brand-400">{settings.site.copyright}</p>
      </aside>

      {/* Form side */}
      <div className="flex min-h-dvh flex-col">
        <header className="border-b border-line bg-white lg:border-none lg:bg-transparent">
          <div className="tm-container flex h-16 items-center justify-between lg:px-8">
            <Link href="/" className="text-lg font-extrabold tracking-tight text-brand-950 lg:hidden">
              {settings.site.siteName}
            </Link>
            <Link href="/shop" className="btn-ghost btn-sm ml-auto">
              Continue shopping
            </Link>
          </div>
        </header>

        <main id="main-content" className="flex flex-1 items-center justify-center p-4 sm:p-8">
          <div className="w-full max-w-md">{children}</div>
        </main>

        <footer className="p-4 sm:p-8">
          <p className="flex flex-wrap justify-center gap-3 text-xs text-brand-500">
            <Link href="/terms" className="hover:text-brand-900">Terms</Link>
            <Link href="/privacy" className="hover:text-brand-900">Privacy</Link>
            <Link href="/help" className="hover:text-brand-900">Help</Link>
          </p>
        </footer>
      </div>
    </div>
  );
}
