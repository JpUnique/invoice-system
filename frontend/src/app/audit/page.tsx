"use client";

import { useEffect, useState } from "react";
import { Protected } from "@/components/protected";
import { Nav } from "@/components/nav";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError, AuditLogEntry } from "@/lib/api";
import { formatDate } from "@/lib/format";

export default function AuditPage() {
  return (
    <Protected>
      <Nav />
      <AuditContent />
    </Protected>
  );
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
      <main className="mx-auto max-w-3xl p-6">
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          Only administrators can view the audit log.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-4xl flex-1 flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Audit Log</h1>

      {error && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-zinc-500">Loading...</p>
      ) : entries.length === 0 ? (
        <p className="text-zinc-500">No activity recorded yet.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-2">When</th>
                <th className="px-4 py-2">Actor</th>
                <th className="px-4 py-2">Action</th>
                <th className="px-4 py-2">Summary</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="px-4 py-2 whitespace-nowrap text-zinc-500">
                    {formatDate(e.created_at)}
                  </td>
                  <td className="px-4 py-2 text-zinc-900 dark:text-zinc-50">{e.actor_name}</td>
                  <td className="px-4 py-2 text-zinc-500">{e.action}</td>
                  <td className="px-4 py-2 text-zinc-500">{e.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
