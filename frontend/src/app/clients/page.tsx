"use client";

import { useEffect, useState, FormEvent } from "react";
import Image from "next/image";
import { Building2, Pencil, Plus, Trash2, X } from "lucide-react";
import { Protected } from "@/components/protected";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError, Client, API_URL } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
import { PageLoading } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";

export default function ClientsPage() {
  return (
    <Protected>
      <AppShell>
        <ClientsContent />
      </AppShell>
    </Protected>
  );
}

function ClientLogo({ client }: { client: Client }) {
  if (client.logo_url) {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-700">
        <Image
          src={`${API_URL}${client.logo_url}`}
          alt={client.name}
          width={36}
          height={36}
          className="h-full w-full object-contain p-1"
          unoptimized
        />
      </div>
    );
  }
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-400 dark:bg-zinc-800">
      <Building2 size={16} strokeWidth={2} />
    </div>
  );
}

function ClientsContent() {
  const { token, user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canManage = user?.role === "admin" || user?.role === "gm";

  async function refresh() {
    if (!token) return;
    setLoading(true);
    try {
      setClients(await api.listClients(token));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load clients");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!token) return;
    if (!confirm("Delete this client? This cannot be undone.")) return;
    setError(null);
    try {
      await api.deleteClient(token, id);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete client");
    }
  }

  useEffect(() => {
    async function load() {
      await refresh();
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-8">
      <PageHeader
        title="Clients"
        description="Companies you invoice, with their branding for co-branded proforma invoices."
        actions={
          canManage && (
            <Button onClick={() => setShowForm((v) => !v)} variant={showForm ? "secondary" : "primary"}>
              {showForm ? (
                <>
                  <X size={15} /> Cancel
                </>
              ) : (
                <>
                  <Plus size={15} /> New Client
                </>
              )}
            </Button>
          )
        }
      />

      {showForm && (
        <Card>
          <ClientForm
            token={token!}
            onSaved={() => {
              setShowForm(false);
              refresh();
            }}
          />
        </Card>
      )}

      {editingClient && (
        <Modal title={`Edit ${editingClient.name}`} onClose={() => setEditingClient(null)}>
          <ClientForm
            token={token!}
            client={editingClient}
            onSaved={() => {
              setEditingClient(null);
              refresh();
            }}
          />
        </Modal>
      )}

      {error && <Alert>{error}</Alert>}

      {loading ? (
        <PageLoading />
      ) : clients.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No clients yet"
          description="Add your first client to start creating invoices for them."
          action={
            !showForm && (
              <Button size="sm" onClick={() => setShowForm(true)}>
                <Plus size={15} /> New Client
              </Button>
            )
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th className="px-5 py-3 font-medium">Client</th>
                <th className="px-5 py-3 font-medium">Code</th>
                <th className="px-5 py-3 font-medium">Currency</th>
                <th className="px-5 py-3 font-medium">Contact</th>
                {canManage && <th className="w-16 px-5 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {clients.map((c) => (
                <tr key={c.id} className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <ClientLogo client={c} />
                      <span className="font-medium text-zinc-900 dark:text-zinc-50">
                        {c.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-zinc-500">{c.code}</td>
                  <td className="px-5 py-3 text-zinc-500">{c.default_currency}</td>
                  <td className="px-5 py-3 text-zinc-500">{c.contact_email || "—"}</td>
                  {canManage && (
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setEditingClient(c)}
                          title="Edit"
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-primary-50 hover:text-primary-600 dark:hover:bg-primary-950"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(c.id)}
                          title="Delete"
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </main>
  );
}

function ClientForm({
  token,
  client,
  onSaved,
}: {
  token: string;
  client?: Client;
  onSaved: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    setError(null);
    setSubmitting(true);
    try {
      const form = new FormData(formEl);
      if (client) {
        await api.updateClient(token, client.id, form);
      } else {
        await api.createClient(token, form);
        formEl.reset();
      }
      onSaved();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : `Could not ${client ? "update" : "create"} client`
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
      {error && (
        <div className="col-span-full">
          <Alert>{error}</Alert>
        </div>
      )}
      <Label>
        Name
        <Input name="name" required defaultValue={client?.name} />
      </Label>
      <Label>
        Code
        <Input name="code" required placeholder="e.g. SHELL" defaultValue={client?.code} />
      </Label>
      <Label>
        Attention
        <Input name="attention_name" defaultValue={client?.attention_name} />
      </Label>
      <Label>
        Contact email
        <Input name="contact_email" type="email" defaultValue={client?.contact_email} />
      </Label>
      <Label>
        Contact phone
        <Input name="contact_phone" defaultValue={client?.contact_phone} />
      </Label>
      <Label>
        Default currency
        <Input
          name="default_currency"
          placeholder="USD"
          defaultValue={client?.default_currency}
        />
      </Label>
      <Label className="col-span-full">
        Billing address
        <Textarea name="billing_address" rows={2} defaultValue={client?.billing_address} />
      </Label>
      <Label className="col-span-full">
        Logo{client && " (leave blank to keep current logo)"}
        <input
          type="file"
          name="logo"
          accept="image/*"
          className="text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-zinc-700 hover:file:bg-zinc-200 dark:text-zinc-400 dark:file:bg-zinc-800 dark:file:text-zinc-200"
        />
      </Label>
      <div className="col-span-full flex justify-end">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : client ? "Save changes" : "Save client"}
        </Button>
      </div>
    </form>
  );
}
