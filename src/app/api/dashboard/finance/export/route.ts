import { NextRequest } from "next/server";

import { jsonError } from "@/lib/api";
import { requirePermission } from "@/lib/auth/guards";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit";
import { PERMISSIONS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { csvResponse, exportFilename, toCsv } from "@/lib/export";
import { fromMinor } from "@/lib/money";
import { getCashFlow, getCategoryTotals, getFinanceSummary } from "@/lib/services/finance";
import { parseRange } from "@/lib/services/reports";

/**
 * Financial exports.
 *
 * Gated on `finance.export` rather than `finance.view`, because a screen
 * someone can read is not the same as a file they can carry out of the
 * building. Every download is audited with the row count.
 */

const MAX_ROWS = 10_000;

export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission(PERMISSIONS.FINANCE_EXPORT);
    const searchParams = request.nextUrl.searchParams;
    const scope = searchParams.get("scope") ?? "transactions";
    const range = parseRange(searchParams.get("from") ?? undefined, searchParams.get("to") ?? undefined, 90);

    if (scope === "cash-flow") {
      const flow = await getCashFlow(range);
      const csv = toCsv(flow, [
        { header: "Date", value: (row) => row.date },
        { header: "Money in", value: (row) => fromMinor(row.income) },
        { header: "Money out", value: (row) => fromMinor(row.expense) },
        { header: "Net", value: (row) => fromMinor(row.net) },
      ]);
      await audit(user, `cash flow, ${flow.length} days`);
      return csvResponse(csv, exportFilename("cash-flow"));
    }

    if (scope === "profit-loss") {
      const [summary, income, expense] = await Promise.all([
        getFinanceSummary(range),
        getCategoryTotals(range, "INCOME"),
        getCategoryTotals(range, "EXPENSE"),
      ]);

      const rows = [
        ...income.map((row) => ({ section: "Income", name: row.name, amount: row.total, count: row.count })),
        { section: "Income", name: "Total income", amount: summary.income, count: 0 },
        ...expense.map((row) => ({ section: "Costs", name: row.name, amount: row.total, count: row.count })),
        { section: "Costs", name: "Total costs", amount: summary.expense, count: 0 },
        { section: "Result", name: "Net profit", amount: summary.netProfit, count: 0 },
        { section: "Result", name: "Gross profit", amount: summary.grossProfit, count: 0 },
        { section: "Receivable", name: "Held by couriers", amount: summary.courierReceivable, count: 0 },
        { section: "Receivable", name: "COD not collected", amount: summary.pendingCod, count: 0 },
      ];

      const csv = toCsv(rows, [
        { header: "Section", value: (row) => row.section },
        { header: "Line", value: (row) => row.name },
        { header: "Amount", value: (row) => fromMinor(row.amount) },
        { header: "Entries", value: (row) => (row.count > 0 ? row.count : "") },
      ]);
      await audit(user, `profit & loss for ${range.from.toISOString().slice(0, 10)}–${range.to.toISOString().slice(0, 10)}`);
      return csvResponse(csv, exportFilename("profit-loss"));
    }

    const includeVoided = searchParams.get("voided") === "1";
    const transactions = await prisma.financeTransaction.findMany({
      where: {
        occurredAt: { gte: range.from, lte: range.to },
        ...(includeVoided ? {} : { voidedAt: null }),
      },
      orderBy: { occurredAt: "desc" },
      take: MAX_ROWS,
      select: {
        reference: true, kind: true, amount: true, description: true, occurredAt: true,
        paymentMethod: true, vendorName: true, isAutomatic: true, voidedAt: true, voidReason: true,
        category: { select: { name: true } },
        account: { select: { name: true } },
        employee: { select: { name: true } },
        order: { select: { orderNumber: true } },
        createdBy: { select: { name: true } },
      },
    });

    const csv = toCsv(transactions, [
      { header: "Reference", value: (row) => row.reference },
      { header: "Date", value: (row) => row.occurredAt.toISOString().slice(0, 10) },
      { header: "Direction", value: (row) => (row.kind === "INCOME" ? "Money in" : "Money out") },
      { header: "Amount", value: (row) => fromMinor(row.amount) },
      { header: "Description", value: (row) => row.description },
      { header: "Category", value: (row) => row.category?.name ?? "" },
      { header: "Account", value: (row) => row.account?.name ?? "" },
      { header: "Payment method", value: (row) => row.paymentMethod ?? "" },
      { header: "Vendor / payee", value: (row) => row.vendorName ?? "" },
      { header: "Staff member", value: (row) => row.employee?.name ?? "" },
      { header: "Order", value: (row) => row.order?.orderNumber ?? "" },
      { header: "Recorded by", value: (row) => (row.isAutomatic ? "Automatic" : row.createdBy?.name ?? "") },
      { header: "Voided", value: (row) => (row.voidedAt ? "Yes" : "") },
      { header: "Void reason", value: (row) => row.voidReason ?? "" },
    ]);

    await audit(user, `${transactions.length} transactions`);
    return csvResponse(csv, exportFilename("finance-transactions"));
  } catch (error) {
    return jsonError(error, "financeExport");
  }
}

async function audit(user: Parameters<typeof recordAudit>[0]["actor"], what: string): Promise<void> {
  await recordAudit({
    actor: user,
    action: AUDIT_ACTIONS.FINANCE_UPDATED,
    entityType: "export",
    summary: `Exported ${what}`,
    severity: "WARNING",
  });
}
