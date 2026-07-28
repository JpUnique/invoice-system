"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Protected } from "@/components/protected";
import { Nav } from "@/components/nav";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError, TransmittalListRow } from "@/lib/api";
import { formatDate } from "@/lib/format";

const statusStyles: Record<string, string> = {
  draft: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  dispatched: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  acknowledged: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300",
};

export default function TransmittalsPage() {
  return (
    <Protected>
      <Nav />
      <TransmittalsContent />
    </Protected>
  );
}

function TransmittalsContent() {
  const { token } = useAuth();
  const [transmittals, setTransmittals] = useState<TransmittalListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [clientFilter, setClientFilter] = useState("");

  useEffect(() => {
    async function load() {
      if (!token) return;
      setLoading(true);
      try {
        setTransmittals(await api.listTransmittals(token));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Could not load transmittals");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  const clientNames = Array.from(new Set(transmittals.map((t) => t.client_name))).sort();

  const filtered = transmittals.filter((t) => {
    if (statusFilter && t.status !== statusFilter) return false;
    if (clientFilter && t.client_name !== clientFilter) return false;
    return true;
  });

  return (
    <main className="mx-auto flex max-w-5xl flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Transmittals
        </h1>
        <Link
          href="/transmittals/new"
          className="rounded bg-zinc-900 px-3 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          New Transmittal
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="dispatched">Dispatched</option>
          <option value="acknowledged">Acknowledged</option>
        </select>
        <select
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
          className="rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
        >
          <option value="">All clients</option>
          {clientNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-zinc-500">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="text-zinc-500">
          {transmittals.length === 0 ? "No transmittals yet." : "No transmittals match these filters."}
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-2">Transmittal No</th>
                <th className="px-4 py-2">Client</th>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Reference Invoice</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="px-4 py-2">
                    <Link
                      href={`/transmittals/${t.id}`}
                      className="font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                    >
                      {t.transmittal_no}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-zinc-500">{t.client_name}</td>
                  <td className="px-4 py-2 text-zinc-500">{formatDate(t.transmittal_date)}</td>
                  <td className="px-4 py-2 text-zinc-500">{t.related_invoice_no || "—"}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium capitalize ${
                        statusStyles[t.status] ?? statusStyles.draft
                      }`}
                    >
                      {t.status}
                    </span>
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
