"use server";

import { revalidatePath } from "next/cache";

import { actionFailure, actionSuccess, errors, type ActionState } from "@/lib/api";
import { requirePermission } from "@/lib/auth/guards";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit";
import { PERMISSIONS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { postTransaction, updateTransaction, voidTransaction } from "@/lib/services/finance";
import { toMinor } from "@/lib/money";
import { slugify } from "@/lib/utils";
import {
  expenseCategorySchema,
  financeAccountSchema,
  transactionSchema,
  voidTransactionSchema,
} from "@/lib/validation/finance";
import { formDataToObject } from "@/lib/validation/common";

function refreshFinance() {
  revalidatePath("/dashboard/finance", "layout");
}

/**
 * Records money in or out.
 *
 * The same action handles a new entry and an edit, because the two differ only
 * in whether an id came along — and an edit writes a revision rather than
 * overwriting silently.
 */
export async function saveTransactionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.FINANCE_MANAGE);
    const input = transactionSchema.parse(formDataToObject(formData));

    const occurredAt = new Date(input.occurredAt);
    if (Number.isNaN(occurredAt.getTime())) throw errors.validation("That date is not valid.");

    const actor = { id: user.id, name: user.name, role: user.role };

    if (input.id) {
      await updateTransaction({
        id: input.id,
        categoryId: input.categoryId,
        accountId: input.accountId,
        amount: toMinor(input.amount),
        description: input.description,
        occurredAt,
        paymentMethod: input.paymentMethod,
        vendorName: input.vendorName,
        employeeId: input.employeeId,
        attachmentUrl: input.attachmentUrl,
        note: input.note,
        actor,
      });

      await recordAudit({
        actor: user,
        action: AUDIT_ACTIONS.FINANCE_UPDATED,
        entityType: "finance_transaction",
        entityId: input.id,
        summary: `${input.kind} ${input.amount} — ${input.description}`,
        severity: "WARNING",
      });

      refreshFinance();
      return actionSuccess("Transaction updated. The previous version is kept in its history.");
    }

    const id = await postTransaction({
      kind: input.kind,
      categoryId: input.categoryId ?? undefined,
      accountId: input.accountId ?? undefined,
      amount: toMinor(input.amount),
      description: input.description,
      occurredAt,
      paymentMethod: input.paymentMethod,
      vendorName: input.vendorName,
      employeeId: input.employeeId,
      attachmentUrl: input.attachmentUrl,
      note: input.note,
      actor,
    });

    await recordAudit({
      actor: user,
      action: AUDIT_ACTIONS.FINANCE_CREATED,
      entityType: "finance_transaction",
      entityId: id,
      summary: `${input.kind} ${input.amount} — ${input.description}`,
    });

    refreshFinance();
    return actionSuccess("Recorded.");
  } catch (error) {
    return actionFailure(error, "saveTransaction");
  }
}

/** Cancels a transaction, keeping the row and the reason. */
export async function voidTransactionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.FINANCE_VOID);
    const input = voidTransactionSchema.parse(formDataToObject(formData));

    await voidTransaction(input.id, input.reason, { id: user.id, name: user.name, role: user.role });

    await recordAudit({
      actor: user,
      action: AUDIT_ACTIONS.FINANCE_VOIDED,
      entityType: "finance_transaction",
      entityId: input.id,
      summary: input.reason,
      severity: "CRITICAL",
    });

    refreshFinance();
    return actionSuccess("Voided. The entry stays in the books, marked and explained.");
  } catch (error) {
    return actionFailure(error, "voidTransaction");
  }
}

export async function saveFinanceAccountAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.FINANCE_MANAGE);
    const input = financeAccountSchema.parse(formDataToObject(formData));

    const data = {
      name: input.name,
      code: input.code.toLowerCase(),
      type: input.type,
      openingBalance: toMinor(input.openingBalance),
      accountNumber: input.accountNumber || null,
      note: input.note || null,
    };

    const account = input.id
      ? await prisma.financeAccount.update({ where: { id: input.id }, data })
      : await prisma.financeAccount.create({ data });

    await recordAudit({
      actor: user,
      action: AUDIT_ACTIONS.SETTINGS_CHANGED,
      entityType: "finance_account",
      entityId: account.id,
      summary: `Account ${account.name} ${input.id ? "updated" : "created"}`,
      severity: "WARNING",
    });

    refreshFinance();
    return actionSuccess(input.id ? "Account updated." : "Account created.");
  } catch (error) {
    return actionFailure(error, "saveFinanceAccount");
  }
}

export async function saveExpenseCategoryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.FINANCE_MANAGE);
    const input = expenseCategorySchema.parse(formDataToObject(formData));

    if (input.id) {
      // A system category is wired to automatic postings by slug, so its name
      // may change but its slug and side of the books may not.
      const existing = await prisma.expenseCategory.findUnique({
        where: { id: input.id },
        select: { isSystem: true },
      });
      await prisma.expenseCategory.update({
        where: { id: input.id },
        data: { name: input.name, ...(existing?.isSystem ? {} : { kind: input.kind }) },
      });
    } else {
      await prisma.expenseCategory.create({
        data: { name: input.name, slug: slugify(input.name), kind: input.kind },
      });
    }

    await recordAudit({
      actor: user,
      action: AUDIT_ACTIONS.SETTINGS_CHANGED,
      entityType: "expense_category",
      entityId: input.id ?? input.name,
      summary: `Category ${input.name} ${input.id ? "updated" : "created"}`,
    });

    refreshFinance();
    return actionSuccess(input.id ? "Category updated." : "Category added.");
  } catch (error) {
    return actionFailure(error, "saveExpenseCategory");
  }
}

/**
 * Retires a category rather than deleting it.
 *
 * Deleting one would orphan every transaction filed under it, and a report
 * that silently loses last year's expenses is worse than a tidy list.
 */
export async function archiveExpenseCategoryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const user = await requirePermission(PERMISSIONS.FINANCE_MANAGE);
    const id = String(formData.get("id") ?? "");
    if (!id) throw errors.validation("Which category?");

    const category = await prisma.expenseCategory.findUnique({
      where: { id },
      select: { isSystem: true, name: true, isActive: true },
    });
    if (!category) throw errors.notFound("That category no longer exists.");
    if (category.isSystem) {
      throw errors.validation(`"${category.name}" is used by automatic postings and cannot be retired.`);
    }

    await prisma.expenseCategory.update({ where: { id }, data: { isActive: !category.isActive } });

    await recordAudit({
      actor: user,
      action: AUDIT_ACTIONS.SETTINGS_CHANGED,
      entityType: "expense_category",
      entityId: id,
      summary: `Category ${category.name} ${category.isActive ? "retired" : "restored"}`,
    });

    refreshFinance();
    return actionSuccess(category.isActive ? "Category retired." : "Category restored.");
  } catch (error) {
    return actionFailure(error, "archiveExpenseCategory");
  }
}
