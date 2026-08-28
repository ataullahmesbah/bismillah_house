import Link from "next/link";
import Image from "next/image";

import { EmptyState, PageHeader, Pagination, StatusPill } from "@/components/ui";
import { QuickActionForm } from "@/components/dashboard/action-form";
import { archiveProductAction, setProductStatusAction } from "@/app/actions/dashboard/catalog";
import { prisma } from "@/lib/db";
import type { Prisma, ProductStatus } from "@/generated/prisma/client";
import { requirePermissionPage } from "@/lib/auth/guards";
import { userHasPermission } from "@/lib/auth/rbac";
import { PAGE_SIZES, PERMISSIONS, PRODUCT_TABS } from "@/lib/constants";
import { formatMoney } from "@/lib/money";
import { buildQuery, formatDate, parsePositiveInt } from "@/lib/utils";
import { optimizedImage } from "@/lib/cloudinary";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function DashboardProductsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requirePermissionPage(PERMISSIONS.PRODUCT_VIEW);
  const params = await searchParams;

  const single = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const q = single("q")?.trim() ?? "";
  const status = single("status") ?? "";
  const categoryId = single("category") ?? "";
  const stockFilter = single("stock") ?? "";
  const page = parsePositiveInt(single("page"), 1, 1000);

  const tab = PRODUCT_TABS.find((entry) => entry.key === (single("tab") ?? "all")) ?? PRODUCT_TABS[0];

  const where: Prisma.ProductWhereInput = {
    deletedAt: null,
    // The dropdown is the finer control, so it wins over the tab.
    ...(status
      ? { status: status as ProductStatus }
      : tab.statuses.length > 0
        ? { status: { in: [...tab.statuses] } }
        : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(stockFilter === "out" ? { stock: 0 } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { sku: { contains: q, mode: "insensitive" } },
            { slug: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  /*
   * Counts per tab, from the same filters as the list. The draft count is the
   * one that matters day to day: it is how an admin knows work is waiting.
   */
  const statusCounts = await prisma.product.groupBy({
    by: ["status"],
    where: { ...where, status: undefined },
    _count: { _all: true },
  });

  const tabCounts = new Map(
    PRODUCT_TABS.map((entry) => [
      entry.key,
      entry.statuses.length === 0
        ? statusCounts.reduce((sum, row) => sum + row._count._all, 0)
        : statusCounts
            .filter((row) => (entry.statuses as readonly string[]).includes(row.status))
            .reduce((sum, row) => sum + row._count._all, 0),
    ]),
  );

  const [products, total, categories, canCreate, canDelete] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * PAGE_SIZES.dashboard,
      take: PAGE_SIZES.dashboard,
      select: {
        id: true, name: true, slug: true, sku: true, price: true, stock: true, status: true,
        hasVariants: true, isFeatured: true, lowStockThreshold: true, updatedAt: true,
        category: { select: { name: true } },
        images: { take: 1, orderBy: [{ isPrimary: "desc" }, { position: "asc" }], select: { url: true } },
        _count: { select: { variants: true } },
      },
    }),
    prisma.product.count({ where }),
    prisma.category.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    userHasPermission(user, PERMISSIONS.PRODUCT_CREATE),
    userHasPermission(user, PERMISSIONS.PRODUCT_DELETE),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZES.dashboard));

  return (
    <>
      <PageHeader
        title="Products"
        description={`${total} product${total === 1 ? "" : "s"} in the catalogue.`}
        action={canCreate ? <Link href="/dashboard/products/new" className="btn-primary">Add product</Link> : undefined}
      />

      <nav className="tabs mb-4" aria-label="Product status">
        {PRODUCT_TABS.map((entry) => {
          const count = tabCounts.get(entry.key) ?? 0;
          // A waiting draft is work for an admin, so it is called out rather
          // than sitting in the same muted grey as the rest.
          const urgent = entry.key === "draft" && count > 0;
          return (
            <Link
              key={entry.key}
              href={`/dashboard/products${buildQuery({ q: q || undefined, category: categoryId || undefined, stock: stockFilter || undefined, tab: entry.key })}`}
              className={entry.key === tab.key ? "tab tab-active" : "tab"}
              aria-current={entry.key === tab.key ? "page" : undefined}
            >
              {entry.label}
              <span className={urgent ? "tab-count tab-count-alert" : count > 0 ? "tab-count" : "tab-count tab-count-empty"}>
                {count}
              </span>
            </Link>
          );
        })}
      </nav>

      <form className="filter-bar" method="get">
        <input type="hidden" name="tab" value={tab.key} />
        <div className="field min-w-52 flex-1">
          <label className="label" htmlFor="q">Search</label>
          <input id="q" name="q" className="input" defaultValue={q} placeholder="Name, SKU or slug" />
        </div>
        <div className="field">
          <label className="label" htmlFor="status">Status</label>
          <select id="status" name="status" className="select" defaultValue={status}>
            <option value="">All</option>
            <option value="PUBLISHED">Published</option>
            <option value="DRAFT">Draft</option>
            <option value="UNPUBLISHED">Unpublished</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>
        <div className="field">
          <label className="label" htmlFor="category">Category</label>
          <select id="category" name="category" className="select" defaultValue={categoryId}>
            <option value="">All</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="label" htmlFor="stock">Stock</label>
          <select id="stock" name="stock" className="select" defaultValue={stockFilter}>
            <option value="">Any</option>
            <option value="out">Out of stock</option>
          </select>
        </div>
        <button type="submit" className="btn-secondary">Filter</button>
        <Link href="/dashboard/products" className="btn-ghost">Reset</Link>
      </form>

      {products.length === 0 ? (
        <EmptyState
          title="No products found"
          description="Try a different filter, or add your first product."
          action={canCreate ? <Link href="/dashboard/products/new" className="btn-primary">Add product</Link> : undefined}
        />
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th className="text-right">Price</th>
                  <th className="text-right">Stock</th>
                  <th>Status</th>
                  <th>Updated</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded border border-line bg-white">
                          {product.images[0] ? (
                            <Image
                              src={optimizedImage(product.images[0].url, 80) ?? product.images[0].url}
                              alt=""
                              fill
                              sizes="40px"
                              className="object-contain"
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0">
                          <Link href={`/dashboard/products/${product.id}`} className="clamp-1 font-semibold hover:underline">
                            {product.name}
                          </Link>
                          <p className="muted-xs">
                            {product.sku ? <span className="mono">{product.sku}</span> : "No SKU"}
                            {product.hasVariants ? ` · ${product._count.variants} variants` : ""}
                            {product.isFeatured ? " · Featured" : ""}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="text-xs">{product.category?.name ?? "—"}</td>
                    <td className="td-num">{formatMoney(product.price)}</td>
                    <td className="td-num">
                      <span className={product.stock === 0 ? "stock-out" : product.stock <= product.lowStockThreshold ? "stock-low" : ""}>
                        {product.stock}
                      </span>
                    </td>
                    <td><StatusPill status={product.status} /></td>
                    <td className="text-xs">{formatDate(product.updatedAt)}</td>
                    <td className="td-actions">
                      <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                        <Link href={`/dashboard/products/${product.id}`} className="btn-secondary btn-xs">Edit</Link>
                        {product.status !== "PUBLISHED" ? (
                          <QuickActionForm
                            action={setProductStatusAction}
                            values={{ id: product.id, status: "PUBLISHED" }}
                            label="Publish"
                            className="btn-success btn-xs"
                          />
                        ) : (
                          <QuickActionForm
                            action={setProductStatusAction}
                            values={{ id: product.id, status: "DRAFT" }}
                            label="Unpublish"
                            className="btn-ghost btn-xs"
                          />
                        )}
                        {canDelete ? (
                          <QuickActionForm
                            action={archiveProductAction}
                            values={{ id: product.id }}
                            label="Archive"
                            className="btn-danger-soft btn-xs"
                            confirm={`Archive “${product.name}”? It stays linked to past orders but disappears from the shop.`}
                          />
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={page}
            totalPages={totalPages}
            buildHref={(next) =>
              `/dashboard/products${buildQuery({ q, status, category: categoryId, stock: stockFilter, page: next > 1 ? next : undefined })}`
            }
          />
        </>
      )}
    </>
  );
}
