import { prisma, safeQuery } from "@/lib/db";

/**
 * Development-only nudge for a shop with no data in it.
 *
 * An unseeded database is not an error — every query simply returns nothing —
 * so the storefront renders a perfectly valid empty shop: no products, no
 * menu, no footer links. That looks like a broken build rather than a missing
 * step, so in development say plainly what is going on. Returns nothing in
 * production, and nothing once the shop has any published product.
 */
export async function SetupNotice() {
  if (process.env.NODE_ENV === "production") return null;

  // -1 marks "could not ask", which means the database is unreachable rather
  // than empty — a different problem, with a different fix.
  const productCount = await safeQuery(
    () => prisma.product.count({ where: { status: "PUBLISHED" } }),
    -1,
    "setup notice",
  );

  if (productCount > 0) return null;

  const unreachable = productCount < 0;

  return (
    <div className="tm-container py-4">
      <div className="alert-warning" role="status">
        <div>
          <p className="font-semibold">
            {unreachable ? "The database is not reachable" : "This shop has no data yet"}
          </p>
          <p className="mt-1 text-sm">
            {unreachable ? (
              <>
                Check that PostgreSQL is running and that <code>DATABASE_URL</code> in your{" "}
                <code>.env</code> is correct, then reload.
              </>
            ) : (
              <>
                The tables exist but nothing has been added, so the menu, footer and product
                grids are empty. Load the demo catalogue with{" "}
                <code>npm run prisma:migrate</code> followed by <code>npm run db:seed</code>.
              </>
            )}
          </p>
          <p className="muted-xs mt-2">
            Shown only in development — this notice never appears in a production build.
          </p>
        </div>
      </div>
    </div>
  );
}
