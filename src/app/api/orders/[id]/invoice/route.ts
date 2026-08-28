import { NextRequest, NextResponse } from "next/server";

import { errors, jsonError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { userHasPermission } from "@/lib/auth/rbac";
import { PERMISSIONS, isStaffRole } from "@/lib/constants";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit";
import { getSettings } from "@/lib/settings";
import { getInvoice, type InvoiceSnapshot } from "@/lib/services/orders";
import { renderInvoicePdf } from "@/lib/services/invoice-pdf";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Invoice PDF download.
 *
 * `[id]` accepts either the order id or the order's non-guessable public token.
 *  - public token  → the token *is* the credential (guest tracking);
 *  - order id      → the caller must own the order, or be staff holding
 *                    `order.invoice`.
 * Changing an id in the URL therefore cannot expose another customer's
 * invoice (PRD update §7).
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;

    const order = await prisma.order.findFirst({
      where: { deletedAt: null, OR: [{ id }, { publicToken: id }] },
      select: { id: true, userId: true, publicToken: true, orderNumber: true },
    });
    if (!order) throw errors.notFound("Invoice not found.");

    const viaPublicToken = order.publicToken === id;
    const user = await getCurrentUser();

    if (!viaPublicToken) {
      if (!user) throw errors.unauthorized("Sign in to download this invoice.");
      const isOwner = order.userId !== null && order.userId === user.id;
      const isAuthorisedStaff =
        isStaffRole(user.role) && (await userHasPermission(user, PERMISSIONS.ORDER_INVOICE));
      if (!isOwner && !isAuthorisedStaff) throw errors.forbidden();
    }

    const [invoice, settings] = await Promise.all([getInvoice(order.id, user?.id), getSettings()]);
    const snapshot = invoice.snapshot as unknown as InvoiceSnapshot;

    const pdf = await renderInvoicePdf(snapshot, {
      shopName: settings.site.siteName,
      addressLines: [settings.contact.address],
      phone: settings.contact.phone,
      email: settings.contact.supportEmail || settings.contact.email,
      website: env.appUrl.replace(/^https?:\/\//, ""),
      footerNote: "Thank you for shopping with us. Keep this invoice for warranty and returns.",
    });

    if (user && isStaffRole(user.role)) {
      await recordAudit({
        actor: user,
        action: AUDIT_ACTIONS.INVOICE_DOWNLOADED,
        entityType: "invoice",
        entityId: invoice.id,
        summary: `Invoice ${invoice.invoiceNumber} downloaded for order ${order.orderNumber}`,
      });
    }

    return new NextResponse(pdf as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${invoice.invoiceNumber}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return jsonError(error, "invoicePdf");
  }
}
