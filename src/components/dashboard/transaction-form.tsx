"use client";

import { useState } from "react";

import { ActionForm, SubmitButton } from "@/components/dashboard/action-form";
import { ContextFieldError } from "@/components/dashboard/action-form-context";
import { Field } from "@/components/ui";
import { saveTransactionAction } from "@/app/actions/dashboard/finance";

export type FinanceOption = { id: string; name: string; kind?: string };

export type TransactionDraft = {
  id: string;
  kind: "INCOME" | "EXPENSE";
  categoryId: string | null;
  accountId: string | null;
  amount: number;
  description: string;
  occurredAt: string;
  paymentMethod: string | null;
  vendorName: string | null;
  employeeId: string | null;
  attachmentUrl: string | null;
  note: string | null;
};

/**
 * Records one money movement.
 *
 * Income and expense share this form because they share every field; only the
 * category list differs, and filtering it in the browser keeps the two sides
 * from being mixed up by accident. The server checks the pairing again.
 */
export function TransactionForm({
  categories,
  accounts,
  employees,
  draft,
  defaultKind = "EXPENSE",
  today,
}: {
  categories: FinanceOption[];
  accounts: FinanceOption[];
  employees: FinanceOption[];
  draft?: TransactionDraft | null;
  defaultKind?: "INCOME" | "EXPENSE";
  /** Passed in from the server so the default date does not differ per client. */
  today: string;
}) {
  const [kind, setKind] = useState<"INCOME" | "EXPENSE">(draft?.kind ?? defaultKind);
  const relevant = categories.filter((category) => category.kind === kind);

  return (
    <ActionForm action={saveTransactionAction} className="card-body space-y-4" successRedirect={false}>
      <input type="hidden" name="id" value={draft?.id ?? ""} />

      <div className="field">
        <span className="label">Direction</span>
        <div className="grid grid-cols-2 gap-2">
          <label className={kind === "EXPENSE" ? "check-row check-row-active" : "check-row"}>
            <input
              type="radio"
              name="kind"
              value="EXPENSE"
              className="radio mt-0.5"
              checked={kind === "EXPENSE"}
              onChange={() => setKind("EXPENSE")}
            />
            <span>Money out</span>
          </label>
          <label className={kind === "INCOME" ? "check-row check-row-active" : "check-row"}>
            <input
              type="radio"
              name="kind"
              value="INCOME"
              className="radio mt-0.5"
              checked={kind === "INCOME"}
              onChange={() => setKind("INCOME")}
            />
            <span>Money in</span>
          </label>
        </div>
      </div>

      <div className="grid-form-2">
        <Field label="Amount" htmlFor="txn-amount" required>
          <input
            id="txn-amount"
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            className="input"
            defaultValue={draft ? draft.amount / 100 : ""}
            required
          />
          <ContextFieldError name="amount" />
        </Field>

        <Field label="Date" htmlFor="txn-date" required>
          <input
            id="txn-date"
            name="occurredAt"
            type="date"
            className="input"
            defaultValue={draft?.occurredAt ?? today}
            required
          />
          <ContextFieldError name="occurredAt" />
        </Field>
      </div>

      <Field label="Description" htmlFor="txn-description" required>
        <input
          id="txn-description"
          name="description"
          className="input"
          defaultValue={draft?.description ?? ""}
          required
          maxLength={500}
          placeholder={kind === "EXPENSE" ? "e.g. staff lunch, Friday" : "e.g. wholesale order"}
        />
        <ContextFieldError name="description" />
      </Field>

      <div className="grid-form-2">
        <Field label="Category" htmlFor="txn-category">
          <select id="txn-category" name="categoryId" className="select" defaultValue={draft?.categoryId ?? ""}>
            <option value="">Uncategorised</option>
            {relevant.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
          <ContextFieldError name="categoryId" />
        </Field>

        <Field label="Paid from / into" htmlFor="txn-account">
          <select id="txn-account" name="accountId" className="select" defaultValue={draft?.accountId ?? ""}>
            <option value="">Not tracked</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>{account.name}</option>
            ))}
          </select>
        </Field>

        <Field label="Payment method" htmlFor="txn-method">
          <input
            id="txn-method"
            name="paymentMethod"
            className="input"
            defaultValue={draft?.paymentMethod ?? ""}
            maxLength={40}
            placeholder="Cash, bKash, bank transfer"
          />
        </Field>

        <Field label="Vendor / payee" htmlFor="txn-vendor">
          <input
            id="txn-vendor"
            name="vendorName"
            className="input"
            defaultValue={draft?.vendorName ?? ""}
            maxLength={160}
          />
        </Field>

        {employees.length > 0 ? (
          <Field label="Staff member" htmlFor="txn-employee" hint="For salary, bonus, travel or reimbursements.">
            <select id="txn-employee" name="employeeId" className="select" defaultValue={draft?.employeeId ?? ""}>
              <option value="">Not related to a person</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>{employee.name}</option>
              ))}
            </select>
          </Field>
        ) : null}

        <Field label="Receipt URL" htmlFor="txn-attachment" hint="Link to a scan or photo of the receipt.">
          <input
            id="txn-attachment"
            name="attachmentUrl"
            className="input"
            defaultValue={draft?.attachmentUrl ?? ""}
            maxLength={500}
          />
        </Field>
      </div>

      <Field label="Note" htmlFor="txn-note">
        <textarea id="txn-note" name="note" rows={2} className="textarea" defaultValue={draft?.note ?? ""} maxLength={500} />
      </Field>

      <SubmitButton>{draft ? "Save changes" : kind === "EXPENSE" ? "Record expense" : "Record income"}</SubmitButton>
    </ActionForm>
  );
}
