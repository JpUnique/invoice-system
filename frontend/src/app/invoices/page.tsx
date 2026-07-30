"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, FileText, Loader2, Plus, Search } from "lucide-react";
import { Protected } from "@/components/protected";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError, InvoiceListRow } from "@/lib/api";
import { formatMoney, formatDate } from "@/lib/format";
import { statusTone } from "@/lib/status";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
import { PageLoading } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";

export default function InvoicesPage() {
  return (
    <Protected>
      <AppShell>
        <InvoicesContent />
      </AppShell>
    </Protected>
  );
}

function InvoicesContent() {
  const { token } = useAuth();
  const [invoices, setInvoices] = useState<InvoiceListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [search, setSearch] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  async function handleDownload(inv: InvoiceListRow) {
    if (!token) return;
    setDownloadingId(inv.id);
    try {
      const blob = await api.getInvoicePdfBlob(token, inv.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${inv.invoice_no.replace(/\//g, "-")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Could not download PDF");
    } finally {
      setDownloadingId(null);
    }
  }

  useEffect(() => {
    async function load() {
      if (!token) return;
      setLoading(true);
      try {
        setInvoices(await api.listInvoices(token));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Could not load invoices");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  const clientNames = Array.from(new Set(invoices.map((i) => i.client_name))).sort();

  const filtered = invoices.filter((inv) => {
    if (statusFilter && inv.status !== statusFilter) return false;
    if (clientFilter && inv.client_name !== clientFilter) return false;
    if (search && !inv.invoice_no.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-8">
      <PageHeader
        title="Invoices"
        description="Standard and client co-branded proforma invoices."
        actions={
          <Button href="/invoices/new">
            <Plus size={15} /> New Invoice
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2">
        <div className="relative">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search invoice no..."
            className="w-56 pl-8"
          />
        </div>
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-40"
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="paid">Paid</option>
          <option value="void">Void</option>
        </Select>
        <Select
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
          className="w-48"
        >
          <option value="">All clients</option>
          {clientNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </Select>
      </div>

      {error && <Alert>{error}</Alert>}

      {loading ? (
        <PageLoading />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={invoices.length === 0 ? "No invoices yet" : "No matches"}
          description={
            invoices.length === 0
              ? "Create your first invoice to get started."
              : "No invoices match these filters."
          }
          action={
            invoices.length === 0 && (
              <Button size="sm" href="/invoices/new">
                <Plus size={15} /> New Invoice
              </Button>
            )
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th className="px-5 py-3 font-medium">Invoice No</th>
                <th className="px-5 py-3 font-medium">Client</th>
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 text-right font-medium">Total</th>
                <th className="w-10 px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filtered.map((inv) => (
                <tr
                  key={inv.id}
                  className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                >
                  <td className="px-5 py-3">
                    <Link
                      href={`/invoices/${inv.id}`}
                      className="font-medium text-zinc-900 hover:text-primary-600 dark:text-zinc-50"
                    >
                      {inv.invoice_no}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-zinc-500">{inv.client_name}</td>
                  <td className="px-5 py-3 text-zinc-500">{formatDate(inv.invoice_date)}</td>
                  <td className="px-5 py-3">
                    <Badge tone={statusTone(inv.status)}>{inv.status}</Badge>
                  </td>
                  <td className="px-5 py-3 text-right font-medium text-zinc-900 dark:text-zinc-50">
                    {formatMoney(inv.grand_total, inv.currency)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleDownload(inv)}
                      disabled={downloadingId === inv.id}
                      title="Download PDF"
                      className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-primary-50 hover:text-primary-600 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-primary-950"
                    >
                      {downloadingId === inv.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Download size={14} />
                      )}
                    </button>
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
