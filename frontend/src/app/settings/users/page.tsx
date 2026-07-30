"use client";

import { useEffect, useState, FormEvent } from "react";
import { Plus, X } from "lucide-react";
import { Protected } from "@/components/protected";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError, User } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { PageLoading } from "@/components/ui/spinner";

export default function UsersPage() {
  return (
    <Protected>
      <AppShell>
        <UsersContent />
      </AppShell>
    </Protected>
  );
}

const roleTone: Record<string, "red" | "blue" | "zinc"> = {
  admin: "red",
  gm: "blue",
  preparer: "zinc",
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "");
}

function UsersContent() {
  const { token, user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("preparer");
  const [submitting, setSubmitting] = useState(false);

  async function refresh() {
    if (!token) return;
    setLoading(true);
    try {
      setUsers(await api.listUsers(token));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load users");
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
      <main className="mx-auto w-full max-w-3xl p-8">
        <Alert>Only administrators can manage users.</Alert>
      </main>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError(null);
    setSubmitting(true);
    try {
      await api.createUser(token, { name, email, password, role });
      setName("");
      setEmail("");
      setPassword("");
      setRole("preparer");
      setShowForm(false);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create user");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8">
      <PageHeader
        title="Users"
        description="Staff accounts and their roles."
        actions={
          <Button onClick={() => setShowForm((v) => !v)} variant={showForm ? "secondary" : "primary"}>
            {showForm ? (
              <>
                <X size={15} /> Cancel
              </>
            ) : (
              <>
                <Plus size={15} /> New User
              </>
            )}
          </Button>
        }
      />

      {error && <Alert>{error}</Alert>}

      {showForm && (
        <Card>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
            <Label>
              Name
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </Label>
            <Label>
              Email
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </Label>
            <Label>
              Temporary Password
              <Input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                placeholder="At least 8 characters"
              />
            </Label>
            <Label>
              Role
              <Select value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="preparer">Preparer</option>
                <option value="gm">General Manager</option>
                <option value="admin">Administrator</option>
              </Select>
            </Label>
            <div className="col-span-full flex justify-end">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving..." : "Create user"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {loading ? (
        <PageLoading />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Email</th>
                <th className="px-5 py-3 font-medium">Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {users.map((u) => (
                <tr key={u.id} className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold uppercase text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                        {initials(u.name)}
                      </div>
                      <span className="font-medium text-zinc-900 dark:text-zinc-50">
                        {u.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-zinc-500">{u.email}</td>
                  <td className="px-5 py-3">
                    <Badge tone={roleTone[u.role] ?? "zinc"}>{u.role}</Badge>
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
