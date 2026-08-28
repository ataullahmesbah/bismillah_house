import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface-muted p-6">
      <div className="card max-w-md p-8 text-center">
        <p className="text-5xl font-extrabold tracking-tight text-brand-300">404</p>
        <h1 className="mt-3 text-xl font-bold">We couldn’t find that page</h1>
        <p className="mt-2 text-sm text-brand-600">
          The link may be broken, or the page may have been moved or removed.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link href="/" className="btn-primary">Back to home</Link>
          <Link href="/shop" className="btn-secondary">Browse products</Link>
          <Link href="/help" className="btn-ghost">Help centre</Link>
        </div>
      </div>
    </div>
  );
}
