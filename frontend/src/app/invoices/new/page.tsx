"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Protected } from "@/components/protected";
import { Nav } from "@/components/nav";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError, BankAccount, Client } from "@/lib/api";
import { formatMoney } from "@/lib/format";

type LineItemForm = {
  description: string;
  quantity: string;
  rate: string;
  amount: string;
};

type SectionForm = {
  title: string;
  items: LineItemForm[];
};

function emptyLineItem(): LineItemForm {
  return { description: "", quantity: "", rate: "", amount: "" };
}

function emptySection(): SectionForm {
  return { title: "", items: [emptyLineItem()] };
}

export default function NewInvoicePage() {
  return (
    <Protected>
      <Nav />
      <NewInvoiceContent />
    </Protected>
  );
}

function NewInvoiceContent() {
  const { token } = useAuth();
  const router = useRouter();

  const [clients, setClients] = useState<Client[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [clientId, setClientId] = useState("");
  const [type, setType] = useState<"standard" | "proforma">("standard");
  const [currency, setCurrency] = useState("USD");
  const [bankAccountId, setBankAccountId] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [dueDate, setDueDate] = useState("On Receipt");
  const [contractNo, setContractNo] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [sections, setSections] = useState<SectionForm[]>([emptySection()]);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      if (!token) return;
      try {
        const [clientList, accountList] = await Promise.all([
          api.listClients(token),
          api.listBankAccounts(token),
        ]);
        setClients(clientList);
        setBankAccounts(accountList);
        if (clientList.length > 0) {
          setClientId(clientList[0].id);
          setCurrency(clientList[0].default_currency || "USD");
        }
      } catch {
        // handled by the clients page; this form just leaves the selects empty
      }
    }
    load();
  }, [token]);

  const currencyBankAccounts = bankAccounts.filter((a) => a.currency === currency);

  function updateSection(idx: number, patch: Partial<SectionForm>) {
    setSections((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }

  function updateItem(sIdx: number, iIdx: number, patch: Partial<LineItemForm>) {
    setSections((prev) =>
      prev.map((s, i) =>
        i === sIdx
          ? { ...s, items: s.items.map((li, j) => (j === iIdx ? { ...li, ...patch } : li)) }
          : s
      )
    );
  }

  function addSection() {
    setSections((prev) => [...prev, emptySection()]);
  }

  function removeSection(idx: number) {
    setSections((prev) => prev.filter((_, i) => i !== idx));
  }

  function addItem(sIdx: number) {
    setSections((prev) =>
      prev.map((s, i) => (i === sIdx ? { ...s, items: [...s.items, emptyLineItem()] } : s))
    );
  }

  function removeItem(sIdx: number, iIdx: number) {
    setSections((prev) =>
      prev.map((s, i) =>
        i === sIdx ? { ...s, items: s.items.filter((_, j) => j !== iIdx) } : s
      )
    );
  }

  const subtotal = sections.reduce(
    (sum, s) => sum + s.items.reduce((sSum, li) => sSum + (parseFloat(li.amount) || 0), 0),
    0
  );
  const vatAmount = Math.round(subtotal * 0.075 * 100) / 100;
  const grandTotal = Math.round((subtotal + vatAmount) * 100) / 100;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError(null);

    const payloadSections = sections
      .map((s) => ({
        title: s.title,
        line_items: s.items
          .filter((li) => li.description.trim() !== "")
          .map((li) => ({
            description: li.description,
            quantity: parseFloat(li.quantity) || 0,
            rate: parseFloat(li.rate) || 0,
            amount: parseFloat(li.amount) || 0,
          })),
      }))
      .filter((s) => s.line_items.length > 0);

    if (!clientId) {
      setError("Select a client");
      return;
    }
    if (payloadSections.length === 0) {
      setError("Add at least one line item with a description and amount");
      return;
    }

    setSubmitting(true);
    try {
      const invoice = await api.createInvoice(token, {
        client_id: clientId,
        type,
        currency,
        invoice_date: invoiceDate,
        due_date: dueDate,
        contract_no: contractNo,
        po_number: poNumber,
        notes,
        bank_account_id: bankAccountId || undefined,
        sections: payloadSections,
      });
      router.push(`/invoices/${invoice.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create invoice");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">New Invoice</h1>

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
                const c = clients.find((c) => c.id === e.target.value);
                if (c) setCurrency(c.default_currency || "USD");
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
            Type
            <select
              value={type}
              onChange={(e) => setType(e.target.value as "standard" | "proforma")}
              className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            >
              <option value="standard">Standard</option>
              <option value="proforma">Proforma (client-branded)</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
            Currency
            <input
              value={currency}
              onChange={(e) => {
                setCurrency(e.target.value.toUpperCase());
                setBankAccountId("");
              }}
              className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
            Bank Account
            <select
              value={bankAccountId}
              onChange={(e) => setBankAccountId(e.target.value)}
              className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            >
              <option value="">Default for {currency || "currency"}</option>
              {currencyBankAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.bank_name} &middot; {a.account_number}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
            Invoice date
            <input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
            Due date
            <input
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              placeholder="On Receipt"
              className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            />
          </label>

          {type === "proforma" && (
            <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
              Contract No.
              <input
                value={contractNo}
                onChange={(e) => setContractNo(e.target.value)}
                placeholder="e.g. PRO0014528"
                className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              />
            </label>
          )}

          <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
            PO Number
            <input
              value={poNumber}
              onChange={(e) => setPoNumber(e.target.value)}
              className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            />
          </label>
        </div>

        {sections.map((section, sIdx) => (
          <div
            key={sIdx}
            className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
          >
            <div className="flex items-center gap-2">
              <input
                value={section.title}
                onChange={(e) => updateSection(sIdx, { title: e.target.value })}
                placeholder={`Section ${sIdx + 1} title (e.g. "1. One-off Coding Fee")`}
                className="flex-1 rounded border border-zinc-300 px-3 py-2 text-sm font-medium dark:border-zinc-700 dark:bg-zinc-800"
              />
              {sections.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeSection(sIdx)}
                  className="text-xs text-red-600 hover:underline dark:text-red-400"
                >
                  Remove section
                </button>
              )}
            </div>

            <div className="overflow-hidden rounded border border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-50 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                  <tr>
                    <th className="px-3 py-2">Description</th>
                    <th className="w-24 px-3 py-2">Qty</th>
                    <th className="w-28 px-3 py-2">Rate</th>
                    <th className="w-32 px-3 py-2">Amount</th>
                    <th className="w-10 px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {section.items.map((li, iIdx) => (
                    <tr key={iIdx} className="border-t border-zinc-100 dark:border-zinc-800">
                      <td className="px-3 py-1.5">
                        <input
                          value={li.description}
                          onChange={(e) =>
                            updateItem(sIdx, iIdx, { description: e.target.value })
                          }
                          className="w-full rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <input
                          value={li.quantity}
                          onChange={(e) => updateItem(sIdx, iIdx, { quantity: e.target.value })}
                          inputMode="decimal"
                          className="w-full rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <input
                          value={li.rate}
                          onChange={(e) => updateItem(sIdx, iIdx, { rate: e.target.value })}
                          inputMode="decimal"
                          className="w-full rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <input
                          value={li.amount}
                          onChange={(e) => updateItem(sIdx, iIdx, { amount: e.target.value })}
                          inputMode="decimal"
                          className="w-full rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                        />
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        {section.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeItem(sIdx, iIdx)}
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
              onClick={() => addItem(sIdx)}
              className="self-start text-xs font-medium text-zinc-600 hover:underline dark:text-zinc-300"
            >
              + Add line item
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={addSection}
          className="self-start rounded border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          + Add section
        </button>

        <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
          Notes
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          />
        </label>

        <div className="ml-auto flex w-64 flex-col gap-1 text-sm">
          <div className="flex justify-between text-zinc-500">
            <span>Subtotal</span>
            <span>{formatMoney(subtotal, currency)}</span>
          </div>
          <div className="flex justify-between text-zinc-500">
            <span>VAT (7.5%)</span>
            <span>{formatMoney(vatAmount, currency)}</span>
          </div>
          <div className="flex justify-between border-t border-zinc-200 pt-1 text-base font-semibold text-zinc-900 dark:border-zinc-800 dark:text-zinc-50">
            <span>Grand Total</span>
            <span>{formatMoney(grandTotal, currency)}</span>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="self-end rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {submitting ? "Saving..." : "Save invoice"}
        </button>
      </form>
    </main>
  );
}
