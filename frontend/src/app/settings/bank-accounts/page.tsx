"use client";

import { useEffect, useState, FormEvent } from "react";
import { Landmark, Pencil, Plus, Trash2, X } from "lucide-react";
import { Protected } from "@/components/protected";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError, BankAccount, BankAccountInput } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { PageLoading } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";

export default function BankAccountsPage() {
  return (
    <Protected>
      <AppShell>
        <BankAccountsContent />
      </AppShell>
    </Protected>
  );
}

function emptyForm(): BankAccountInput {
  return {
    bank_name: "",
    account_name: "",
    account_number: "",
    swift_code: "",
    correspondent_bank: "",
    correspondent_account_number: "",
    currency: "USD",
    is_default: false,
  };
}

function BankAccountsContent() {
  const { token, user } = useAuth();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);

  async function refresh() {
    if (!token) return;
    setLoading(true);
    try {
      setAccounts(await api.listBankAccounts(token));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load bank accounts");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function load() {
      await refresh();
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Backend allows admin AND gm to manage bank accounts (see main.go's
  // admin+gm route group) — keep this gate in sync with that.
  if (user && user.role !== "admin" && user.role !== "gm") {
    return (
      <main className="mx-auto w-full max-w-3xl p-8">
        <Alert>Only administrators and GMs can manage bank accounts.</Alert>
      </main>
    );
  }

  async function handleDelete(id: string) {
    if (!token) return;
    setError(null);
    try {
      await api.deleteBankAccount(token, id);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete bank account");
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8">
      <PageHeader
        title="Bank Accounts"
        description="Scoped per currency. Invoices auto-select the default account for their currency."
        actions={
          <Button onClick={() => setShowForm((v) => !v)} variant={showForm ? "secondary" : "primary"}>
            {showForm ? (
              <>
                <X size={15} /> Cancel
              </>
            ) : (
              <>
                <Plus size={15} /> New Bank Account
              </>
            )}
          </Button>
        }
      />

      {error && <Alert>{error}</Alert>}

      {showForm && (
        <Card>
          <BankAccountForm
            token={token!}
            onSaved={() => {
              setShowForm(false);
              refresh();
            }}
          />
        </Card>
      )}

      {editingAccount && (
        <Modal title={`Edit ${editingAccount.bank_name}`} onClose={() => setEditingAccount(null)}>
          <BankAccountForm
            token={token!}
            account={editingAccount}
            onSaved={() => {
              setEditingAccount(null);
              refresh();
            }}
          />
        </Modal>
      )}

      {loading ? (
        <PageLoading />
      ) : accounts.length === 0 ? (
        <EmptyState icon={Landmark} title="No bank accounts yet" />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th className="px-5 py-3 font-medium">Bank</th>
                <th className="px-5 py-3 font-medium">Account No.</th>
                <th className="px-5 py-3 font-medium">Currency</th>
                <th className="px-5 py-3 font-medium">Default</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {accounts.map((a) => (
                <tr key={a.id} className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                  <td className="px-5 py-3">
                    <p className="font-medium text-zinc-900 dark:text-zinc-50">{a.bank_name}</p>
                    <p className="text-xs text-zinc-500">{a.account_name}</p>
                  </td>
                  <td className="px-5 py-3 text-zinc-500">{a.account_number}</td>
                  <td className="px-5 py-3 text-zinc-500">{a.currency}</td>
                  <td className="px-5 py-3">{a.is_default && <Badge tone="green">Default</Badge>}</td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setEditingAccount(a)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-primary-50 hover:text-primary-600 dark:hover:bg-primary-950"
                        title="Edit"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(a.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </main>
  );
}

function BankAccountForm({
  token,
  account,
  onSaved,
}: {
  token: string;
  account?: BankAccount;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<BankAccountInput>(
    account
      ? {
          bank_name: account.bank_name,
          account_name: account.account_name,
          account_number: account.account_number,
          swift_code: account.swift_code,
          correspondent_bank: account.correspondent_bank,
          correspondent_account_number: account.correspondent_account_number,
          currency: account.currency,
          is_default: account.is_default,
        }
      : emptyForm()
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError(null);
    setSubmitting(true);
    try {
      if (account) {
        await api.updateBankAccount(token, account.id, form);
      } else {
        await api.createBankAccount(token, form);
      }
      onSaved();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : `Could not ${account ? "update" : "create"} bank account`
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
      {error && (
        <div className="col-span-full">
          <Alert>{error}</Alert>
        </div>
      )}
      <Label>
        Bank Name
        <Input
          value={form.bank_name}
          onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
          required
        />
      </Label>
      <Label>
        Account Name
        <Input
          value={form.account_name}
          onChange={(e) => setForm({ ...form, account_name: e.target.value })}
          required
        />
      </Label>
      <Label>
        Account Number
        <Input
          value={form.account_number}
          onChange={(e) => setForm({ ...form, account_number: e.target.value })}
          required
        />
      </Label>
      <Label>
        SWIFT Code
        <Input
          value={form.swift_code}
          onChange={(e) => setForm({ ...form, swift_code: e.target.value })}
        />
      </Label>
      <Label>
        Correspondent Bank
        <Input
          value={form.correspondent_bank}
          onChange={(e) => setForm({ ...form, correspondent_bank: e.target.value })}
        />
      </Label>
      <Label>
        Correspondent Account No.
        <Input
          value={form.correspondent_account_number}
          onChange={(e) =>
            setForm({ ...form, correspondent_account_number: e.target.value })
          }
        />
      </Label>
      <Label>
        Currency
        <Input
          value={form.currency}
          onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
          placeholder="USD"
          required
        />
      </Label>
      <label className="flex items-center gap-2 self-end pb-2.5 text-sm text-zinc-700 dark:text-zinc-300">
        <input
          type="checkbox"
          checked={form.is_default}
          onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
          className="h-4 w-4 rounded border-zinc-300 text-primary-600 focus:ring-primary-500"
        />
        Default for this currency
      </label>
      <div className="col-span-full flex justify-end">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : account ? "Save changes" : "Save bank account"}
        </Button>
      </div>
    </form>
  );
}
