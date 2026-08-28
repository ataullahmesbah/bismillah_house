import { ActionForm, SubmitButton } from "@/components/dashboard/action-form";
import { ContextFieldError } from "@/components/dashboard/action-form-context";
import { EmptyState, Field, PageHeader, StatCard } from "@/components/ui";
import { saveFinanceAccountAction } from "@/app/actions/dashboard/finance";
import { requirePermissionPage } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { formatMoney, fromMinor } from "@/lib/money";
import { humanizeEnum } from "@/lib/utils";
import { getAccountBalances } from "@/lib/services/finance";

import { FinanceTabs } from "../nav";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const ACCOUNT_TYPES = ["CASH", "BANK", "MOBILE_WALLET", "COURIER_RECEIVABLE", "OTHER"] as const;

export default async function AccountsPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePermissionPage(PERMISSIONS.FINANCE_MANAGE);
  const params = await searchParams;
  const editId = Array.isArray(params.edit) ? params.edit[0] : params.edit;

  const [balances, editing] = await Promise.all([
    getAccountBalances(),
    editId ? prisma.financeAccount.findUnique({ where: { id: editId } }) : Promise.resolve(null),
  ]);

  const total = balances.reduce((sum, account) => sum + account.balance, 0);

  return (
    <>
      <PageHeader
        title="Accounts"
        description="Where the money sits. Balances are opening balance plus every live transaction — never a stored running total."
      />
      <FinanceTabs active="/dashboard/finance/accounts" />

      <div className="stat-grid mb-4">
        <StatCard label="Total across accounts" value={formatMoney(total)} />
        <StatCard label="Accounts" value={balances.length} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
        <section className="card self-start">
          <div className="card-header">
            <h2 className="card-title">{editing ? "Edit account" : "Add account"}</h2>
          </div>
          <ActionForm action={saveFinanceAccountAction} className="card-body space-y-4" successRedirect={false}>
            <input type="hidden" name="id" value={editing?.id ?? ""} />

            <Field label="Name" htmlFor="acc-name" required>
              <input id="acc-name" name="name" className="input" defaultValue={editing?.name ?? ""} required maxLength={120} />
              <ContextFieldError name="name" />
            </Field>

            <Field label="Code" htmlFor="acc-code" required hint="Short and unique, used by automatic postings.">
              <input id="acc-code" name="code" className="input" defaultValue={editing?.code ?? ""} required maxLength={30} />
              <ContextFieldError name="code" />
            </Field>

            <Field label="Type" htmlFor="acc-type">
              <select id="acc-type" name="type" className="select" defaultValue={editing?.type ?? "CASH"}>
                {ACCOUNT_TYPES.map((type) => (
                  <option key={type} value={type}>{humanizeEnum(type)}</option>
                ))}
              </select>
            </Field>

            <Field
              label="Opening balance"
              htmlFor="acc-opening"
              hint="What was in this account before Trust Mart started keeping its books."
            >
              <input
                id="acc-opening"
                name="openingBalance"
                type="number"
                step="0.01"
                className="input"
                defaultValue={fromMinor(editing?.openingBalance ?? 0)}
              />
            </Field>

            <Field label="Account number" htmlFor="acc-number">
              <input id="acc-number" name="accountNumber" className="input" defaultValue={editing?.accountNumber ?? ""} maxLength={60} />
            </Field>

            <Field label="Note" htmlFor="acc-note">
              <textarea id="acc-note" name="note" rows={2} className="textarea" defaultValue={editing?.note ?? ""} maxLength={300} />
            </Field>

            <SubmitButton>{editing ? "Save account" : "Add account"}</SubmitButton>
          </ActionForm>
        </section>

        <section className="card">
          <div className="card-header"><h2 className="card-title">Balances</h2></div>
          {balances.length === 0 ? (
            <div className="card-body">
              <EmptyState title="No accounts yet" description="Add the till, the bank account and any mobile wallets." />
            </div>
          ) : (
            <div className="table-wrap border-0">
              <table className="table">
                <thead><tr><th>Account</th><th>Type</th><th className="text-right">Balance</th><th></th></tr></thead>
                <tbody>
                  {balances.map((account) => (
                    <tr key={account.id}>
                      <td>
                        <span className="font-semibold">{account.name}</span>
                        <span className="muted-xs block mono">{account.code}</span>
                      </td>
                      <td className="text-xs">{humanizeEnum(account.type)}</td>
                      <td className={`td-num font-bold ${account.balance < 0 ? "text-danger-600" : ""}`}>
                        {formatMoney(account.balance)}
                      </td>
                      <td className="text-right">
                        <a href={`/dashboard/finance/accounts?edit=${account.id}`} className="btn-secondary btn-xs">Edit</a>
                      </td>
                    </tr>
                  ))}
                  <tr className="font-bold">
                    <td colSpan={2}>Total</td>
                    <td className="td-num">{formatMoney(total)}</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
