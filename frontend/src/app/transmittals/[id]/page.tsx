"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Protected } from "@/components/protected";
import { Nav } from "@/components/nav";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError, Transmittal } from "@/lib/api";
import { formatDate } from "@/lib/format";

export default function TransmittalDetailPage() {
  return (
    <Protected>
      <Nav />
      <TransmittalDetailContent />
    </Protected>
  );
}

const TRANSMITTAL_STATUSES = ["draft", "dispatched", "acknowledged"] as const;

function TransmittalDetailContent() {
  const { token, user } = useAuth();
  const params = useParams<{ id: string }>();
  const [transmittal, setTransmittal] = useState<Transmittal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const canChangeStatus = user?.role === "admin" || user?.role === "gm";

  useEffect(() => {
    async function load() {
      if (!token) return;
      try {
        setTransmittal(await api.getTransmittal(token, params.id));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Could not load transmittal");
      }
    }
    load();
  }, [token, params.id]);

  async function handleStatusChange(status: string) {
    if (!token || !transmittal) return;
    setUpdatingStatus(true);
    try {
      // The status endpoint returns transmittal header fields only (no
      // items), so merge just the status rather than replacing the whole
      // object — otherwise the item table below would render against
      // undefined data.
      const updated = await api.updateTransmittalStatus(token, transmittal.id, status);
      setTransmittal((prev) => (prev ? { ...prev, status: updated.status } : prev));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update status");
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function handleDownload() {
    if (!token || !transmittal) return;
    setDownloading(true);
    try {
      const blob = await api.getTransmittalPdfBlob(token, transmittal.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${transmittal.transmittal_no.replace(/\//g, "-")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not download PDF");
    } finally {
      setDownloading(false);
    }
  }

  if (error) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      </main>
    );
  }

  if (!transmittal) {
    return <main className="p-6 text-zinc-500">Loading...</main>;
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            {transmittal.transmittal_no}
          </h1>
          {canChangeStatus ? (
            <select
              value={transmittal.status}
              disabled={updatingStatus}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="rounded border border-zinc-300 bg-transparent px-2 py-0.5 text-sm capitalize dark:border-zinc-700"
            >
              {TRANSMITTAL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-sm capitalize text-zinc-500">{transmittal.status}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="text-right text-sm text-zinc-500">
            <p>Date: {formatDate(transmittal.transmittal_date)}</p>
            <p>Dispatch: {transmittal.mode_of_dispatch || "—"}</p>
          </div>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {downloading ? "Generating..." : "Download PDF"}
          </button>
        </div>
      </div>

      {transmittal.purpose && (
        <p className="rounded bg-zinc-50 px-3 py-2 text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
          {transmittal.purpose}
        </p>
      )}

      <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead className="text-zinc-500 dark:text-zinc-400">
            <tr>
              <th className="px-4 py-2">Description</th>
              <th className="px-4 py-2">Format/Medium</th>
              <th className="px-4 py-2 text-right">Qty</th>
              <th className="px-4 py-2">Remarks</th>
            </tr>
          </thead>
          <tbody>
            {transmittal.items.map((it) => (
              <tr key={it.id} className="border-t border-zinc-100 dark:border-zinc-800">
                <td className="px-4 py-2 text-zinc-900 dark:text-zinc-50">
                  {it.description}
                </td>
                <td className="px-4 py-2 text-zinc-500">{it.format_medium}</td>
                <td className="px-4 py-2 text-right text-zinc-500">{it.quantity}</td>
                <td className="px-4 py-2 text-zinc-500">{it.remarks}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm text-zinc-500">
        <div>
          <p className="font-medium text-zinc-700 dark:text-zinc-300">Dispatched By</p>
          <p>{transmittal.dispatched_by_name || "—"}</p>
        </div>
        <div>
          <p className="font-medium text-zinc-700 dark:text-zinc-300">Received By</p>
          <p>{transmittal.received_by_name || "—"}</p>
        </div>
      </div>

      {transmittal.remarks && (
        <p className="rounded bg-zinc-50 px-3 py-2 text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
          {transmittal.remarks}
        </p>
      )}
    </main>
  );
}
