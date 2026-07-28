"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Protected } from "@/components/protected";
import { Nav } from "@/components/nav";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError, Invoice } from "@/lib/api";
import { formatMoney, formatDate } from "@/lib/format";

export default function InvoiceDetailPage() {
  return (
    <Protected>
      <Nav />
      <InvoiceDetailContent />
    </Protected>
  );
}

const INVOICE_STATUSES = ["draft", "sent", "paid", "void"] as const;

function InvoiceDetailContent() {
  const { token, user } = useAuth();
  const params = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const canChangeStatus = user?.role === "admin" || user?.role === "gm";

  useEffect(() => {
    async function load() {
      if (!token) return;
      try {
        setInvoice(await api.getInvoice(token, params.id));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Could not load invoice");
      }
    }
    load();
  }, [token, params.id]);

  async function handleStatusChange(status: string) {
    if (!token || !invoice) return;
    setUpdatingStatus(true);
    try {
      // The status endpoint returns invoice header fields only (no
      // sections/line items), so merge just the status rather than
      // replacing the whole object — otherwise the line-item tables
      // below would be rendered against undefined data.
      const updated = await api.updateInvoiceStatus(token, invoice.id, status);
      setInvoice((prev) => (prev ? { ...prev, status: updated.status } : prev));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update status");
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function handleDownload() {
    if (!token || !invoice) return;
    setDownloading(true);
    try {
      const blob = await api.getInvoicePdfBlob(token, invoice.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${invoice.invoice_no.replace(/\//g, "-")}.pdf`;
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

  if (!invoice) {
    return <main className="p-6 text-zinc-500">Loading...</main>;
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            {invoice.invoice_no}
          </h1>
          <div className="flex items-center gap-2 text-sm capitalize text-zinc-500">
            <span>{invoice.type} invoice &middot;</span>
            {canChangeStatus ? (
              <select
                value={invoice.status}
                disabled={updatingStatus}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="rounded border border-zinc-300 bg-transparent px-2 py-0.5 text-sm capitalize dark:border-zinc-700"
              >
                {INVOICE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            ) : (
              <span>{invoice.status}</span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="text-right text-sm text-zinc-500">
            <p>Date: {formatDate(invoice.invoice_date)}</p>
            <p>Due: {invoice.due_date || "—"}</p>
            {invoice.contract_no && <p>Contract: {invoice.contract_no}</p>}
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

      {invoice.sections.map((section) => (
        <div
          key={section.id}
          className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800"
        >
          {section.title && (
            <div className="bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
              {section.title}
            </div>
          )}
          <table className="w-full text-left text-sm">
            <thead className="text-zinc-500 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-2">Description</th>
                <th className="px-4 py-2 text-right">Qty</th>
                <th className="px-4 py-2 text-right">Rate</th>
                <th className="px-4 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {section.line_items.map((li) => (
                <tr key={li.id} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="px-4 py-2 text-zinc-900 dark:text-zinc-50">
                    {li.description}
                  </td>
                  <td className="px-4 py-2 text-right text-zinc-500">
                    {li.quantity ? li.quantity : ""}
                  </td>
                  <td className="px-4 py-2 text-right text-zinc-500">
                    {li.rate ? formatMoney(li.rate, invoice.currency) : ""}
                  </td>
                  <td className="px-4 py-2 text-right text-zinc-900 dark:text-zinc-50">
                    {formatMoney(li.amount, invoice.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      <div className="ml-auto flex w-64 flex-col gap-1 text-sm">
        <div className="flex justify-between text-zinc-500">
          <span>Subtotal</span>
          <span>{formatMoney(invoice.subtotal, invoice.currency)}</span>
        </div>
        <div className="flex justify-between text-zinc-500">
          <span>VAT ({invoice.vat_rate}%)</span>
          <span>{formatMoney(invoice.vat_amount, invoice.currency)}</span>
        </div>
        <div className="flex justify-between border-t border-zinc-200 pt-1 text-base font-semibold text-zinc-900 dark:border-zinc-800 dark:text-zinc-50">
          <span>Grand Total</span>
          <span>{formatMoney(invoice.grand_total, invoice.currency)}</span>
        </div>
      </div>

      <p className="text-sm italic text-zinc-500">{invoice.amount_in_words}</p>

      {invoice.notes && (
        <p className="rounded bg-zinc-50 px-3 py-2 text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
          {invoice.notes}
        </p>
      )}
    </main>
  );
}
