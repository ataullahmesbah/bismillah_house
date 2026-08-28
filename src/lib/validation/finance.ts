import { z } from "zod";

import { idSchema, optionalIdSchema, optionalText } from "./common";

/** What the finance forms accept. */

export const transactionSchema = z.object({
  id: optionalIdSchema,
  kind: z.enum(["INCOME", "EXPENSE"]),
  categoryId: optionalIdSchema,
  accountId: optionalIdSchema,
  /**
   * Taka, converted to minor units by the action. Always positive — `kind`
   * carries the direction, so a negative income cannot masquerade as an
   * expense and quietly cancel a sale.
   */
  amount: z.coerce.number().positive("Enter an amount greater than zero.").max(100_000_000),
  description: z.string().trim().min(2, "Describe what this is for.").max(500),
  occurredAt: z.string().trim().min(1, "When did this happen?"),
  paymentMethod: optionalText(40),
  vendorName: optionalText(160),
  employeeId: optionalIdSchema,
  attachmentUrl: optionalText(500),
  note: optionalText(500),
});

export const voidTransactionSchema = z.object({
  id: idSchema,
  reason: z.string().trim().min(5, "Say why this is being voided — at least a few words."),
});

export const financeAccountSchema = z.object({
  id: optionalIdSchema,
  name: z.string().trim().min(2, "Give the account a name.").max(120),
  code: z
    .string()
    .trim()
    .min(2)
    .max(30)
    .regex(/^[a-zA-Z0-9-]+$/, "Use letters, numbers and hyphens only."),
  type: z.enum(["CASH", "BANK", "MOBILE_WALLET", "COURIER_RECEIVABLE", "OTHER"]),
  openingBalance: z.coerce.number().min(-100_000_000).max(100_000_000).default(0),
  accountNumber: optionalText(60),
  note: optionalText(300),
});

export const expenseCategorySchema = z.object({
  id: optionalIdSchema,
  name: z.string().trim().min(2, "Give the category a name.").max(120),
  kind: z.enum(["INCOME", "EXPENSE"]),
});

export type TransactionInput = z.infer<typeof transactionSchema>;
export type FinanceAccountInput = z.infer<typeof financeAccountSchema>;
