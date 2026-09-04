import Link from "next/link";

import { EmptyState, PageHeader, Pagination } from "@/components/ui";
import { requireAnyPermissionPage } from "@/lib/auth/guards";
import { PAGE_SIZES, PERMISSIONS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { InventoryMovementType } from "@/generated/prisma/enums";
import { MOVEMENT_TYPE_LABELS } from "@/lib/services/inventory.shared";
import { buildQuery, formatDateTime, parsePositiveInt } from "@/lib/utils";

import { InventoryTabs } from "../nav";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const TYPES = Object.keys(MOVEMENT_TYPE_LABELS) as InventoryMovementType[];

export default async function MovementsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAnyPermissionPage([PERMISSIONS.INVENTORY_VIEW, PERMISSIONS.INVENTORY_MANAGE]);
  const params = await searchParams;
  const single = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const q = single("q")?.trim() ?? "";
  const rawType = single("type") ?? "";
  // Only a type we recognise reaches the query; anything else means "all".
  const type = TYPES.includes(rawType as InventoryMovementType) ? (rawType as InventoryMovementType) : "";
  const page = parsePositiveInt(single("page"), 1, 1000);
  const perPage = PAGE_SIZES.dashboard;

  const where: Prisma.InventoryMovementWhereInput = {
    ...(type ? { type } : {}),
    ...(q
      ? {
          product: {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { sku: { contains: q, mode: "insensitive" } },
            ],
          },
        }
      : {}),
  };

  const [movements, total] = await Promise.all([
    prisma.inventoryMovement.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        id: true, type: true, quantityChange: true, quantityAfter: true, reason: true, createdAt: true,
        referenceType: true, referenceId: true, actorName: true,
        product: { select: { id: true, name: true } },
        variant: { select: { name: true } },
        warehouse: { select: { name: true } },
      },
    }),
    prisma.inventoryMovement.count({ where }),
  ]);

  return (
    <>
      <PageHeader
        title="Stock movements"
        description="Every change to stock, whoever or whatever caused it. This is the audit trail."
      />
      <InventoryTabs active="/dashboard/inventory/movements" />

      <form method="get" className="card mb-4">
        <div className="card-body flex flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1">
            <label className="label" htmlFor="movement-q">Product</label>
            <input id="movement-q" name="q" defaultValue={q} className="input" placeholder="Name or SKU" />
          </div>
          <div className="min-w-40">
            <label className="label" htmlFor="movement-type">Type</label>
            <select id="movement-type" name="type" defaultValue={type} className="select">
              <option value="">All types</option>
              {TYPES.map((value) => (
                <option key={value} value={value}>{MOVEMENT_TYPE_LABELS[value]}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-primary">Filter</button>
          <Link href="/api/dashboard/inventory/export?scope=movements" className="btn-secondary">Export CSV</Link>
        </div>
      </form>

      {movements.length === 0 ? (
        <div className="card"><div className="card-body">
          <EmptyState title="No movements match" description="Try a different product or type." />
        </div></div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>When</th><th>Product</th><th>Type</th>
                <th className="text-right">Change</th><th className="text-right">After</th>
                <th>Reference</th><th>By</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((movement) => (
                <tr key={movement.id}>
                  <td className="text-xs whitespace-nowrap">{formatDateTime(movement.createdAt)}</td>
                  <td>
                    <Link href={`/dashboard/products/${movement.product.id}`} className="clamp-1 hover:underline">
                      {movement.product.name}
                    </Link>
                    {movement.variant ? <span className="muted-xs block">{movement.variant.name}</span> : null}
                    {movement.warehouse ? <span className="muted-xs block">{movement.warehouse.name}</span> : null}
                  </td>
                  <td>
                    <span className="badge-outline">{MOVEMENT_TYPE_LABELS[movement.type]}</span>
                    {movement.reason ? <span className="muted-xs block clamp-2">{movement.reason}</span> : null}
                  </td>
                  <td className={`td-num ${movement.quantityChange < 0 ? "text-danger-600" : "text-success-700"}`}>
                    {movement.quantityChange > 0 ? "+" : ""}{movement.quantityChange}
                  </td>
                  <td className="td-num">{movement.quantityAfter}</td>
                  <td className="text-xs">
                    {movement.referenceType === "order" && movement.referenceId ? (
                      <Link href={`/dashboard/orders/${movement.referenceId}`} className="hover:underline">Order</Link>
                    ) : (
                      movement.referenceType ?? "—"
                    )}
                  </td>
                  <td className="text-xs">{movement.actorName ?? "System"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        page={page}
        totalPages={Math.max(1, Math.ceil(total / perPage))}
        buildHref={(next) =>
          `/dashboard/inventory/movements${buildQuery({ q, type, page: next > 1 ? next : undefined })}`
        }
      />
    </>
  );
}
