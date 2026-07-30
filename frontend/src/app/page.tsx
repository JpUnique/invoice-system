"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Send, FileClock, CheckCircle2, Building2, Wallet, ArrowRight } from "lucide-react";
import { Protected } from "@/components/protected";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError, DashboardSummary } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
import { PageLoading } from "@/components/ui/spinner";
import { statusTone } from "@/lib/status";

export default function Home() {
  return (
    <Protected>
      <AppShell>
        <DashboardContent />
      </AppShell>
    </Protected>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  icon: typeof FileClock;
  tone: "zinc" | "blue" | "green" | "primary";
}) {
  const toneClasses = {
    zinc: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300",
    green: "bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-300",
    primary: "bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-300",
  }[tone];

  return (
    <Card>
      <CardBody className="flex items-center gap-4">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${toneClasses}`}>
          <Icon size={20} strokeWidth={2} />
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {label}
          </p>
          <p className="mt-0.5 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            {value}
          </p>
        </div>
      </CardBody>
    </Card>
  );
}

// Horizontal bar chart of revenue (billed = sent + paid invoices) per
// client. Bars are normalized against the max *within their own currency*
// (not globally) since a $ bar and a ₦ bar aren't comparable by raw length.
function RevenueByClientChart({ data }: { data: DashboardSummary["billed_by_client"] }) {
  if (data.length === 0) {
    return (
      <CardBody>
        <p className="text-sm text-zinc-500">
          No invoices sent yet — revenue by client will show up here.
        </p>
      </CardBody>
    );
  }

  const maxByCurrency = data.reduce<Record<string, number>>((acc, b) => {
    acc[b.currency] = Math.max(acc[b.currency] ?? 0, b.total_billed);
    return acc;
  }, {});

  return (
    <CardBody className="flex flex-col gap-4">
      {data.map((b) => {
        const max = maxByCurrency[b.currency] || 1;
        const pct = Math.max((b.total_billed / max) * 100, 3);
        return (
          <div
            key={`${b.client_id}-${b.currency}`}
            className="stagger-item"
            title={`${b.client_name}: ${formatMoney(b.total_billed, b.currency)} across ${b.invoice_count} invoice${b.invoice_count === 1 ? "" : "s"}`}
          >
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <span className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">
                {b.client_name}
              </span>
              <span className="shrink-0 text-xs text-zinc-400">
                {b.invoice_count} invoice{b.invoice_count === 1 ? "" : "s"}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-2.5 flex-1 bg-zinc-100 dark:bg-zinc-800">
                <div
                  className="h-2.5 rounded-r-[4px] bg-primary-600 transition-[width] duration-300 ease-[var(--ease-out)]"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-28 shrink-0 text-right text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                {formatMoney(b.total_billed, b.currency)}
              </span>
            </div>
          </div>
        );
      })}
    </CardBody>
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
      <main className="mx-auto w-full max-w-6xl p-8">
        <Alert>{error}</Alert>
      </main>
    );
  }

  if (!summary) {
    return <PageLoading label="Loading dashboard..." />;
  }

  const outstandingEntries = Object.entries(summary.outstanding_by_currency);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-8">
      <PageHeader
        title="Dashboard"
        description="Overview of invoices and outstanding balances."
        actions={
          <Button href="/invoices/new">
            <Plus size={15} /> Invoice
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="stagger-item">
          <StatCard
            label="Draft Invoices"
            value={summary.invoice_counts.draft ?? 0}
            icon={FileClock}
            tone="zinc"
          />
        </div>
        <div className="stagger-item">
          <StatCard
            label="Sent Invoices"
            value={summary.invoice_counts.sent ?? 0}
            icon={Send}
            tone="blue"
          />
        </div>
        <div className="stagger-item">
          <StatCard
            label="Paid Invoices"
            value={summary.invoice_counts.paid ?? 0}
            icon={CheckCircle2}
            tone="green"
          />
        </div>
        <div className="stagger-item">
          <StatCard
            label="Clients"
            value={summary.total_clients}
            icon={Building2}
            tone="primary"
          />
        </div>
      </div>

      <Card>
        <CardBody className="flex flex-wrap items-center gap-6">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-300">
            <Wallet size={20} strokeWidth={2} />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Outstanding (Sent, Unpaid)
            </p>
            {outstandingEntries.length === 0 ? (
              <p className="mt-0.5 text-sm text-zinc-500">Nothing outstanding.</p>
            ) : (
              <div className="mt-0.5 flex flex-wrap gap-x-6 gap-y-1">
                {outstandingEntries.map(([currency, amount]) => (
                  <p
                    key={currency}
                    className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50"
                  >
                    {formatMoney(amount, currency)}
                  </p>
                ))}
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            Revenue by Client
          </h2>
          <Link
            href="/clients"
            className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700"
          >
            View clients <ArrowRight size={12} />
          </Link>
        </CardHeader>
        <RevenueByClientChart data={summary.billed_by_client} />
      </Card>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            Recent Invoices
          </h2>
          <Link
            href="/invoices"
            className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700"
          >
            View all <ArrowRight size={12} />
          </Link>
        </CardHeader>
        {summary.recent_invoices.length === 0 ? (
          <CardBody>
            <p className="text-sm text-zinc-500">No invoices yet.</p>
          </CardBody>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {summary.recent_invoices.map((inv) => (
              <Link
                key={inv.id}
                href={`/invoices/${inv.id}`}
                className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">
                    {inv.invoice_no}
                  </p>
                  <p className="truncate text-xs text-zinc-500">{inv.client_name}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <Badge tone={statusTone(inv.status)}>{inv.status}</Badge>
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    {formatMoney(inv.grand_total, inv.currency)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </main>
  );
}
