"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Protected } from "@/components/protected";
import { Nav } from "@/components/nav";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError, DashboardSummary } from "@/lib/api";
import { formatMoney } from "@/lib/format";

export default function Home() {
  return (
    <Protected>
      <Nav />
      <DashboardContent />
    </Protected>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{value}</p>
    </div>
  );
}

function DashboardContent() {
  const { token } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!token) return;
      try {
        setSummary(await api.getDashboardSummary(token));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Could not load dashboard");
      }
    }
    load();
  }, [token]);

  if (error) {
    return (
      <main className="mx-auto max-w-5xl p-6">
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      </main>
    );
  }

  if (!summary) {
    return <main className="p-6 text-zinc-500">Loading...</main>;
  }

  const outstandingEntries = Object.entries(summary.outstanding_by_currency);

  return (
    <main className="mx-auto flex max-w-5xl flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Dashboard</h1>
        <div className="flex gap-2">
          <Link
            href="/invoices/new"
            className="rounded bg-zinc-900 px-3 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            New Invoice
          </Link>
          <Link
            href="/transmittals/new"
            className="rounded border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            New Transmittal
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Draft Invoices" value={summary.invoice_counts.draft ?? 0} />
        <StatCard label="Sent Invoices" value={summary.invoice_counts.sent ?? 0} />
        <StatCard label="Paid Invoices" value={summary.invoice_counts.paid ?? 0} />
        <StatCard label="Clients" value={summary.total_clients} />
      </div>

      <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Outstanding (Sent, Unpaid)
        </p>
        {outstandingEntries.length === 0 ? (
          <p className="mt-1 text-sm text-zinc-500">Nothing outstanding.</p>
        ) : (
          <div className="mt-1 flex gap-4">
            {outstandingEntries.map(([currency, amount]) => (
              <p key={currency} className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                {formatMoney(amount, currency)}
              </p>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              Recent Invoices
            </h2>
            <Link href="/invoices" className="text-xs text-zinc-500 hover:underline">
              View all
            </Link>
          </div>
          {summary.recent_invoices.length === 0 ? (
            <p className="text-sm text-zinc-500">No invoices yet.</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-left text-sm">
                <tbody>
                  {summary.recent_invoices.map((inv) => (
                    <tr key={inv.id} className="border-t border-zinc-100 first:border-t-0 dark:border-zinc-800">
                      <td className="px-3 py-2">
                        <Link href={`/invoices/${inv.id}`} className="hover:underline">
                          {inv.invoice_no}
                        </Link>
                        <p className="text-xs text-zinc-500">{inv.client_name}</p>
                      </td>
                      <td className="px-3 py-2 text-right text-zinc-500">
                        {formatMoney(inv.grand_total, inv.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              Recent Transmittals
            </h2>
            <Link href="/transmittals" className="text-xs text-zinc-500 hover:underline">
              View all
            </Link>
          </div>
          {summary.recent_transmittals.length === 0 ? (
            <p className="text-sm text-zinc-500">No transmittals yet.</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-left text-sm">
                <tbody>
                  {summary.recent_transmittals.map((t) => (
                    <tr key={t.id} className="border-t border-zinc-100 first:border-t-0 dark:border-zinc-800">
                      <td className="px-3 py-2">
                        <Link href={`/transmittals/${t.id}`} className="hover:underline">
                          {t.transmittal_no}
                        </Link>
                        <p className="text-xs text-zinc-500">{t.client_name}</p>
                      </td>
                      <td className="px-3 py-2 text-right text-zinc-500 capitalize">{t.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
