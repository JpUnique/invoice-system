"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, Copy, Download, Loader2, Stamp } from "lucide-react";
import { Protected } from "@/components/protected";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError, API_URL, Invoice } from "@/lib/api";
import { formatMoney, formatDate } from "@/lib/format";
import { statusTone } from "@/lib/status";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { PageLoading } from "@/components/ui/spinner";

export default function InvoiceDetailPage() {
  return (
    <Protected>
      <AppShell>
        <InvoiceDetailContent />
      </AppShell>
    </Protected>
  );
}

const INVOICE_STATUSES = ["draft", "sent", "paid", "void"] as const;

// Absolute URL API_URL falls back to the current origin when the app sits
// behind Caddy's same-origin reverse proxy (NEXT_PUBLIC_API_URL is "" there
// — see .env.example) — a relative path wouldn't work once copied elsewhere.
function publicInvoiceURL(token: string) {
  const base = API_URL || (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/api/v1/public/invoices/${token}`;
}

function InvoiceDetailContent() {
  const { token, user } = useAuth();
  const params = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [sealing, setSealing] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const canManage = user?.role === "admin" || user?.role === "gm";

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

  async function handleSeal() {
    if (!token || !invoice) return;
    setSealing(true);
    try {
      const updated = await api.sealInvoice(token, invoice.id);
      setInvoice((prev) => (prev ? { ...prev, sealed_at: updated.sealed_at } : prev));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not seal invoice");
    } finally {
      setSealing(false);
    }
  }

  async function handleUnseal() {
    if (!token || !invoice) return;
    setSealing(true);
    try {
      const updated = await api.unsealInvoice(token, invoice.id);
      setInvoice((prev) => (prev ? { ...prev, sealed_at: updated.sealed_at } : prev));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not unseal invoice");
    } finally {
      setSealing(false);
    }
  }

  async function handleCopyLink() {
    if (!invoice) return;
    try {
      await navigator.clipboard.writeText(publicInvoiceURL(invoice.public_token));
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      setError("Could not copy link");
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

  if (error && !invoice) {
    return (
      <main className="mx-auto w-full max-w-3xl p-8">
        <Alert>{error}</Alert>
      </main>
    );
  }

  if (!invoice) {
    return <PageLoading />;
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8">
      <Link
        href="/invoices"
        className="flex w-fit items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-800 dark:hover:text-zinc-200"
      >
        <ArrowLeft size={14} /> Invoices
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {invoice.invoice_no}
          </h1>
          <div className="mt-1.5 flex items-center gap-2 text-sm capitalize text-zinc-500">
            <span>{invoice.type} invoice</span>
            <span className="text-zinc-300">&middot;</span>
            {canManage ? (
              <Select
                value={invoice.status}
                disabled={updatingStatus}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="w-auto py-1 text-xs capitalize"
              >
                {INVOICE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            ) : (
              <Badge tone={statusTone(invoice.status)}>{invoice.status}</Badge>
            )}
            {invoice.sealed_at && (
              <Badge tone="green">
                <Stamp size={11} /> Sealed
              </Badge>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="text-right text-sm text-zinc-500">
            <p>Date: {formatDate(invoice.invoice_date)}</p>
            <p>Due: {invoice.due_date || "—"}</p>
            {invoice.contract_no && <p>Contract: {invoice.contract_no}</p>}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={handleCopyLink} title="Copy shareable link">
              {linkCopied ? <Check size={15} /> : <Copy size={15} />}
              {linkCopied ? "Copied" : "Copy Link"}
            </Button>
            {canManage &&
              (invoice.sealed_at ? (
                <Button variant="secondary" onClick={handleUnseal} disabled={sealing}>
                  {sealing ? <Loader2 size={15} className="animate-spin" /> : <Stamp size={15} />}
                  Unseal
                </Button>
              ) : (
                <Button variant="secondary" onClick={handleSeal} disabled={sealing}>
                  {sealing ? <Loader2 size={15} className="animate-spin" /> : <Stamp size={15} />}
                  Seal Invoice
                </Button>
              ))}
            <Button onClick={handleDownload} disabled={downloading}>
              {downloading ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Download size={15} />
              )}
              {downloading ? "Generating..." : "Download PDF"}
            </Button>
          </div>
        </div>
      </div>

      {error && <Alert>{error}</Alert>}

      {invoice.sections.map((section) => (
        <Card key={section.id} className="overflow-hidden">
          {section.title && (
            <div className="border-b border-zinc-100 bg-zinc-50 px-5 py-2.5 text-sm font-medium text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
              {section.title}
            </div>
          )}
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              <tr>
                <th className="px-5 py-2.5 font-medium">Description</th>
                <th className="px-5 py-2.5 text-right font-medium">Qty</th>
                <th className="px-5 py-2.5 text-right font-medium">Rate</th>
                <th className="px-5 py-2.5 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {section.line_items.map((li) => (
                <tr key={li.id}>
                  <td className="px-5 py-2.5 text-zinc-900 dark:text-zinc-50">
                    {li.description}
                  </td>
                  <td className="px-5 py-2.5 text-right text-zinc-500">
                    {li.quantity ? li.quantity : ""}
                  </td>
                  <td className="px-5 py-2.5 text-right text-zinc-500">
                    {li.rate ? formatMoney(li.rate, invoice.currency) : ""}
                  </td>
                  <td className="px-5 py-2.5 text-right font-medium text-zinc-900 dark:text-zinc-50">
                    {formatMoney(li.amount, invoice.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ))}

      <div className="ml-auto flex w-72 flex-col gap-1.5 text-sm">
        <div className="flex justify-between text-zinc-500">
          <span>Subtotal</span>
          <span>{formatMoney(invoice.subtotal, invoice.currency)}</span>
        </div>
        <div className="flex justify-between text-zinc-500">
          <span>Discount</span>
          <span>&minus;{formatMoney(invoice.discount_amount, invoice.currency)}</span>
        </div>
        <div className="flex justify-between text-zinc-500">
          <span>VAT ({invoice.vat_rate}%)</span>
          <span>{formatMoney(invoice.vat_amount, invoice.currency)}</span>
        </div>
        <div className="flex justify-between border-t border-zinc-200 pt-1.5 text-base font-semibold text-zinc-900 dark:border-zinc-800 dark:text-zinc-50">
          <span>Grand Total</span>
          <span>{formatMoney(invoice.grand_total, invoice.currency)}</span>
        </div>
      </div>

      <p className="text-sm italic text-zinc-500">{invoice.amount_in_words}</p>

      {invoice.notes && (
        <Card className="px-4 py-3">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{invoice.notes}</p>
        </Card>
      )}
    </main>
  );
}
