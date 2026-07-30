"use client";

import { useEffect, useState } from "react";
import { History } from "lucide-react";
import { Protected } from "@/components/protected";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError, AuditLogEntry } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { PageLoading } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";

export default function AuditPage() {
  return (
    <Protected>
      <AppShell>
        <AuditContent />
      </AppShell>
    </Protected>
  );
}

function actionTone(action: string): "green" | "blue" | "zinc" {
  if (action.endsWith(".created")) return "green";
  if (action.endsWith("_changed")) return "blue";
  return "zinc";
}

function AuditContent() {
  const { token, user } = useAuth();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!token) return;
      setLoading(true);
      try {
        setEntries(await api.listAuditLog(token));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Could not load audit log");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  if (user && user.role !== "admin") {
    return (
      <main className="mx-auto w-full max-w-3xl p-8">
        <Alert>Only administrators can view the audit log.</Alert>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-8">
      <PageHeader title="Audit Log" description="Who did what, and when." />

      {error && <Alert>{error}</Alert>}

      {loading ? (
        <PageLoading />
      ) : entries.length === 0 ? (
        <EmptyState icon={History} title="No activity recorded yet" />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th className="px-5 py-3 font-medium">When</th>
                <th className="px-5 py-3 font-medium">Actor</th>
                <th className="px-5 py-3 font-medium">Action</th>
                <th className="px-5 py-3 font-medium">Summary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {entries.map((e) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap px-5 py-3 text-zinc-500">
                    {formatDate(e.created_at)}
                  </td>
                  <td className="px-5 py-3 font-medium text-zinc-900 dark:text-zinc-50">
                    {e.actor_name}
                  </td>
                  <td className="px-5 py-3">
                    <Badge tone={actionTone(e.action)} className="normal-case">
                      {e.action.replace(/[._]/g, " ")}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 text-zinc-500">{e.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </main>
  );
}
