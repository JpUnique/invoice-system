"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Protected } from "@/components/protected";
import { Nav } from "@/components/nav";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError, Client, InvoiceListRow } from "@/lib/api";

type ItemForm = {
  description: string;
  format_medium: string;
  quantity: string;
  remarks: string;
};

function emptyItem(): ItemForm {
  return { description: "", format_medium: "", quantity: "1", remarks: "" };
}

export default function NewTransmittalPage() {
  return (
    <Protected>
      <Nav />
      <NewTransmittalContent />
    </Protected>
  );
}

function NewTransmittalContent() {
  const { token, user } = useAuth();
  const router = useRouter();

  const [clients, setClients] = useState<Client[]>([]);
  const [invoices, setInvoices] = useState<InvoiceListRow[]>([]);
  const [clientId, setClientId] = useState("");
  const [relatedInvoiceId, setRelatedInvoiceId] = useState("");
  const [transmittalDate, setTransmittalDate] = useState("");
  const [purpose, setPurpose] = useState(
    "Please find enclosed the following for your record and necessary action."
  );
  const [modeOfDispatch, setModeOfDispatch] = useState("Email");
  const [dispatchedByName, setDispatchedByName] = useState(user?.name ?? "");
  const [receivedByName, setReceivedByName] = useState("");
  const [remarks, setRemarks] = useState("");
  const [items, setItems] = useState<ItemForm[]>([emptyItem()]);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      if (!token) return;
      try {
        const [clientList, invoiceList] = await Promise.all([
          api.listClients(token),
          api.listInvoices(token),
        ]);
        setClients(clientList);
        setInvoices(invoiceList);
        if (clientList.length > 0) setClientId(clientList[0].id);
      } catch {
        // surfaced implicitly by empty selects
      }
    }
    load();
  }, [token]);

  const clientInvoices = invoices.filter((i) => i.client_id === clientId);

  function updateItem(idx: number, patch: Partial<ItemForm>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  function addItem() {
    setItems((prev) => [...prev, emptyItem()]);
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError(null);

    const payloadItems = items
      .filter((it) => it.description.trim() !== "")
      .map((it) => ({
        description: it.description,
        format_medium: it.format_medium,
        quantity: parseFloat(it.quantity) || 0,
        remarks: it.remarks,
      }));

    if (!clientId) {
      setError("Select a client");
      return;
    }
    if (payloadItems.length === 0) {
      setError("Add at least one item with a description");
      return;
    }

    setSubmitting(true);
    try {
      const transmittal = await api.createTransmittal(token, {
        client_id: clientId,
        related_invoice_id: relatedInvoiceId || undefined,
        transmittal_date: transmittalDate,
        purpose,
        mode_of_dispatch: modeOfDispatch,
        dispatched_by_name: dispatchedByName,
        received_by_name: receivedByName,
        remarks,
        items: payloadItems,
      });
      router.push(`/transmittals/${transmittal.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create transmittal");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
        New Transmittal
      </h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {error && (
          <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}

        <div className="grid grid-cols-1 gap-3 rounded-lg border border-zinc-200 p-4 sm:grid-cols-3 dark:border-zinc-800">
          <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
            Client
            <select
              value={clientId}
              onChange={(e) => {
                setClientId(e.target.value);
                setRelatedInvoiceId("");
              }}
              className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            >
              <option value="" disabled>
                Select a client
              </option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
            Reference Invoice (optional)
            <select
              value={relatedInvoiceId}
              onChange={(e) => setRelatedInvoiceId(e.target.value)}
              className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            >
              <option value="">None</option>
              {clientInvoices.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.invoice_no}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
            Date
            <input
              type="date"
              value={transmittalDate}
              onChange={(e) => setTransmittalDate(e.target.value)}
              className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
            Mode of Dispatch
            <input
              value={modeOfDispatch}
              onChange={(e) => setModeOfDispatch(e.target.value)}
              placeholder="Email, Courier, Hand Delivery..."
              className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
            Dispatched By
            <input
              value={dispatchedByName}
              onChange={(e) => setDispatchedByName(e.target.value)}
              className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
            Received By (optional)
            <input
              value={receivedByName}
              onChange={(e) => setReceivedByName(e.target.value)}
              className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            />
          </label>

          <label className="col-span-full flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
            Purpose
            <textarea
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              rows={2}
              className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            />
          </label>
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <div className="overflow-hidden rounded border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                <tr>
                  <th className="px-3 py-2">Description</th>
                  <th className="w-32 px-3 py-2">Format/Medium</th>
                  <th className="w-20 px-3 py-2">Qty</th>
                  <th className="px-3 py-2">Remarks</th>
                  <th className="w-10 px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => (
                  <tr key={idx} className="border-t border-zinc-100 dark:border-zinc-800">
                    <td className="px-3 py-1.5">
                      <input
                        value={it.description}
                        onChange={(e) => updateItem(idx, { description: e.target.value })}
                        className="w-full rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        value={it.format_medium}
                        onChange={(e) => updateItem(idx, { format_medium: e.target.value })}
                        placeholder="PDF, HDD, Tape..."
                        className="w-full rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        value={it.quantity}
                        onChange={(e) => updateItem(idx, { quantity: e.target.value })}
                        inputMode="decimal"
                        className="w-full rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        value={it.remarks}
                        onChange={(e) => updateItem(idx, { remarks: e.target.value })}
                        className="w-full rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                      />
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="text-xs text-red-600 hover:underline dark:text-red-400"
                        >
                          ✕
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            onClick={addItem}
            className="self-start text-xs font-medium text-zinc-600 hover:underline dark:text-zinc-300"
          >
            + Add item
          </button>
        </div>

        <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
          Remarks
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            rows={2}
            className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          />
        </label>

        <button
          type="submit"
          disabled={submitting}
          className="self-end rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {submitting ? "Saving..." : "Save transmittal"}
        </button>
      </form>
    </main>
  );
}
