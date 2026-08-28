import { NextRequest } from "next/server";

import { requireAnyPermission } from "@/lib/auth/guards";
import { userHasPermission } from "@/lib/auth/rbac";
import { PERMISSIONS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { csvResponse, exportFilename, toCsv } from "@/lib/export";
import { fromMinor } from "@/lib/money";
import { listProductStock, listVariantStock, type StockRow } from "@/lib/services/inventory";
import { MOVEMENT_TYPE_LABELS } from "@/lib/services/inventory.shared";
import { jsonError } from "@/lib/api";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit";

/**
 * Inventory exports.
 *
 * Guarded exactly like the pages that link to it — a download URL is as much
 * an API as anything else, and "the button is hidden" is not a permission
 * check. Row counts are capped so a large catalogue cannot be turned into an
 * accidental denial of service by holding down F5.
 */

const MAX_ROWS = 5_000;

export async function GET(request: NextRequest) {
  try {
    const user = await requireAnyPermission([PERMISSIONS.INVENTORY_VIEW, PERMISSIONS.INVENTORY_MANAGE]);
    const scope = request.nextUrl.searchParams.get("scope") ?? "products";

    // The stock table hides cost prices from staff who only hold
    // `inventory.view`. The export has to apply the SAME check — a download URL
    // is an API, and a column left out of a page is not a permission.
    const showCost = await userHasPermission(user, PERMISSIONS.INVENTORY_MANAGE);

    if (scope === "movements") {
      const movements = await prisma.inventoryMovement.findMany({
        orderBy: { createdAt: "desc" },
        take: MAX_ROWS,
        select: {
          createdAt: true, type: true, quantityChange: true, quantityAfter: true, reason: true,
          referenceType: true, actorName: true, unitCost: true,
          product: { select: { name: true, sku: true } },
          variant: { select: { name: true } },
          warehouse: { select: { name: true } },
        },
      });

      const csv = toCsv(movements, [
        { header: "Date", value: (row) => row.createdAt.toISOString() },
        { header: "Product", value: (row) => row.product.name },
        { header: "Variant", value: (row) => row.variant?.name ?? "" },
        { header: "SKU", value: (row) => row.product.sku ?? "" },
        { header: "Warehouse", value: (row) => row.warehouse?.name ?? "" },
        { header: "Type", value: (row) => MOVEMENT_TYPE_LABELS[row.type] },
        { header: "Change", value: (row) => row.quantityChange },
        { header: "Stock after", value: (row) => row.quantityAfter },
        { header: "Reason", value: (row) => row.reason ?? "" },
        { header: "Reference", value: (row) => row.referenceType ?? "" },
        ...(showCost
          ? [{ header: "Unit cost", value: (row: (typeof movements)[number]) => (row.unitCost != null ? fromMinor(row.unitCost) : "") }]
          : []),
        { header: "By", value: (row) => row.actorName ?? "System" },
      ]);

      await recordAudit({
        actor: user,
        action: AUDIT_ACTIONS.INVENTORY_ADJUSTED,
        entityType: "export",
        summary: `Exported ${movements.length} stock movements`,
      });
      return csvResponse(csv, exportFilename("stock-movements"));
    }

    const { rows } =
      scope === "variants"
        ? await listVariantStock({ take: MAX_ROWS })
        : await listProductStock({ filter: scope === "low" ? "low" : scope === "out" ? "out" : "all", take: MAX_ROWS });

    const csv = toCsv(rows, [
      { header: "Product", value: (row) => row.name },
      { header: "Variant", value: (row) => row.variantName ?? "" },
      { header: "SKU", value: (row) => row.sku ?? "" },
      { header: "Category", value: (row) => row.categoryName ?? "" },
      { header: "On hand", value: (row) => row.onHand },
      { header: "Reserved", value: (row) => row.reserved },
      { header: "Available", value: (row) => row.available },
      { header: "Damaged", value: (row) => row.damaged },
      { header: "Incoming", value: (row) => row.incoming },
      { header: "Low stock threshold", value: (row) => row.lowStockThreshold },
      { header: "Reorder level", value: (row) => row.reorderLevel },
      { header: "Selling price", value: (row) => fromMinor(row.price) },
      ...(showCost
        ? [
            { header: "Cost price", value: (row: StockRow) => (row.costPrice != null ? fromMinor(row.costPrice) : "") },
            { header: "Stock value at cost", value: (row: StockRow) => fromMinor(row.available * (row.costPrice ?? 0)) },
          ]
        : []),
      { header: "Last restocked", value: (row) => row.lastRestockedAt?.toISOString() ?? "" },
    ]);

    await recordAudit({
      actor: user,
      action: AUDIT_ACTIONS.INVENTORY_ADJUSTED,
      entityType: "export",
      summary: `Exported ${rows.length} inventory rows (${scope})${showCost ? " with cost prices" : ""}`,
    });
    return csvResponse(csv, exportFilename(`inventory-${scope}`));
  } catch (error) {
    return jsonError(error, "inventoryExport");
  }
}
