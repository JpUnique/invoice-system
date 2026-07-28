"use client";

import { useEffect, useState, FormEvent } from "react";
import { Protected } from "@/components/protected";
import { Nav } from "@/components/nav";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError, BankAccount } from "@/lib/api";

export default function BankAccountsPage() {
  return (
    <Protected>
      <Nav />
      <BankAccountsContent />
    </Protected>
  );
}

function emptyForm() {
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
  const [form, setForm] = useState(emptyForm());
  const [submitting, setSubmitting] = useState(false);

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

  if (user && user.role !== "admin") {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          Only administrators can manage bank accounts.
        </p>
      </main>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError(null);
    setSubmitting(true);
    try {
      await api.createBankAccount(token, form);
      setForm(emptyForm());
      setShowForm(false);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create bank account");
    } finally {
      setSubmitting(false);
    }
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
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Bank Accounts
        </h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded bg-zinc-900 px-3 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          {showForm ? "Cancel" : "New Bank Account"}
        </button>
      </div>

      {error && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 gap-3 rounded-lg border border-zinc-200 p-4 sm:grid-cols-2 dark:border-zinc-800"
        >
          <Field label="Bank Name" value={form.bank_name} onChange={(v) => setForm({ ...form, bank_name: v })} required />
          <Field label="Account Name" value={form.account_name} onChange={(v) => setForm({ ...form, account_name: v })} required />
          <Field label="Account Number" value={form.account_number} onChange={(v) => setForm({ ...form, account_number: v })} required />
          <Field label="SWIFT Code" value={form.swift_code} onChange={(v) => setForm({ ...form, swift_code: v })} />
          <Field label="Correspondent Bank" value={form.correspondent_bank} onChange={(v) => setForm({ ...form, correspondent_bank: v })} />
          <Field label="Correspondent Account No." value={form.correspondent_account_number} onChange={(v) => setForm({ ...form, correspondent_account_number: v })} />
          <Field label="Currency" value={form.currency} onChange={(v) => setForm({ ...form, currency: v.toUpperCase() })} placeholder="USD" required />
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={form.is_default}
              onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
            />
            Default for this currency
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="col-span-full mt-2 rounded bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {submitting ? "Saving..." : "Save bank account"}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-zinc-500">Loading...</p>
      ) : accounts.length === 0 ? (
        <p className="text-zinc-500">No bank accounts yet.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-2">Bank</th>
                <th className="px-4 py-2">Account No.</th>
                <th className="px-4 py-2">Currency</th>
                <th className="px-4 py-2">Default</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="px-4 py-2 text-zinc-900 dark:text-zinc-50">
                    {a.bank_name}
                    <p className="text-xs text-zinc-500">{a.account_name}</p>
                  </td>
                  <td className="px-4 py-2 text-zinc-500">{a.account_number}</td>
                  <td className="px-4 py-2 text-zinc-500">{a.currency}</td>
                  <td className="px-4 py-2 text-zinc-500">{a.is_default ? "Yes" : ""}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => handleDelete(a.id)}
                      className="text-xs text-red-600 hover:underline dark:text-red-400"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
      />
    </label>
  );
}
