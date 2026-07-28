"use client";

import { useEffect, useState, FormEvent } from "react";
import Image from "next/image";
import { Protected } from "@/components/protected";
import { Nav } from "@/components/nav";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError, Client, API_URL } from "@/lib/api";

export default function ClientsPage() {
  return (
    <Protected>
      <Nav />
      <ClientsContent />
    </Protected>
  );
}

function ClientsContent() {
  const { token } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    async function load() {
      await refresh();
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <main className="mx-auto flex max-w-4xl flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Clients
        </h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded bg-zinc-900 px-3 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          {showForm ? "Cancel" : "New Client"}
        </button>
      </div>

      {showForm && (
        <NewClientForm
          token={token!}
          onCreated={() => {
            setShowForm(false);
            refresh();
          }}
        />
      )}

      {error && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-zinc-500">Loading...</p>
      ) : clients.length === 0 ? (
        <p className="text-zinc-500">No clients yet.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-2">Logo</th>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Code</th>
                <th className="px-4 py-2">Currency</th>
                <th className="px-4 py-2">Contact</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="px-4 py-2">
                    {c.logo_url ? (
                      <Image
                        src={`${API_URL}${c.logo_url}`}
                        alt={c.name}
                        width={32}
                        height={32}
                        className="h-8 w-8 object-contain"
                        unoptimized
                      />
                    ) : (
                      <span className="text-zinc-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-zinc-900 dark:text-zinc-50">{c.name}</td>
                  <td className="px-4 py-2 text-zinc-500">{c.code}</td>
                  <td className="px-4 py-2 text-zinc-500">{c.default_currency}</td>
                  <td className="px-4 py-2 text-zinc-500">{c.contact_email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

function NewClientForm({
  token,
  onCreated,
}: {
  token: string;
  onCreated: () => void;
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
      await api.createClient(token, form);
      formEl.reset();
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create client");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid grid-cols-1 gap-3 rounded-lg border border-zinc-200 p-4 sm:grid-cols-2 dark:border-zinc-800"
    >
      {error && (
        <p className="col-span-full rounded bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}
      <Field label="Name" name="name" required />
      <Field label="Code" name="code" required placeholder="e.g. SHELL" />
      <Field label="Attention" name="attention_name" />
      <Field label="Contact email" name="contact_email" type="email" />
      <Field label="Contact phone" name="contact_phone" />
      <Field label="Default currency" name="default_currency" placeholder="USD" />
      <label className="col-span-full flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
        Billing address
        <textarea
          name="billing_address"
          rows={2}
          className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
        />
      </label>
      <label className="col-span-full flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
        Logo
        <input type="file" name="logo" accept="image/*" className="text-sm" />
      </label>
      <button
        type="submit"
        disabled={submitting}
        className="col-span-full mt-2 rounded bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {submitting ? "Saving..." : "Save client"}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
      {label}
      <input
        type={type}
        name={name}
        required={required}
        placeholder={placeholder}
        className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
      />
    </label>
  );
}
