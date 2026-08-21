"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { Protected } from "@/components/protected";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError, BankAccount, Client } from "@/lib/api";
import { formatMoney, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

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

const DUE_DATE_PRESETS = ["On Receipt", "Net 15", "Net 30", "Net 60"];

function emptyLineItem(): LineItemForm {
  return { description: "", quantity: "", rate: "", amount: "" };
}

function emptySection(): SectionForm {
  return { title: "", items: [emptyLineItem()] };
}

// Qty * Rate, rounded to the cent — computed in integer cents to avoid
// float drift (e.g. 0.1 + 0.2 style errors) before converting back.
function computeAmount(quantity: string, rate: string): string | null {
  const qty = parseFloat(quantity);
  const r = parseFloat(rate);
  if (!Number.isFinite(qty) || !Number.isFinite(r)) return null;
  const cents = Math.round(qty * r * 100);
  return (cents / 100).toFixed(2);
}

export default function NewInvoicePage() {
  return (
    <Protected>
      <AppShell>
        <NewInvoiceContent />
      </AppShell>
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
  const [customDueDate, setCustomDueDate] = useState("");
  const [contractNo, setContractNo] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [serviceEntryNumber, setServiceEntryNumber] = useState("");
  const [pdfTitle, setPdfTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [sections, setSections] = useState<SectionForm[]>([emptySection()]);
  const [discountAmount, setDiscountAmount] = useState("");
  const [savedAddresses, setSavedAddresses] = useState<{ id: string; address: string }[]>([]);
  const [billingAddressChoice, setBillingAddressChoice] = useState("new");
  const [newAddressText, setNewAddressText] = useState("");

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

  useEffect(() => {
    async function loadAddresses() {
      if (!token || !clientId) {
        setSavedAddresses([]);
        return;
      }
      try {
        const addresses = await api.listClientAddresses(token, clientId);
        setSavedAddresses(addresses);
        setBillingAddressChoice(addresses.length > 0 ? addresses[0].id : "new");
        setNewAddressText("");
      } catch {
        setSavedAddresses([]);
        setBillingAddressChoice("new");
      }
    }
    loadAddresses();
  }, [token, clientId]);

  const billingAddress =
    billingAddressChoice === "new"
      ? newAddressText
      : savedAddresses.find((a) => a.id === billingAddressChoice)?.address ?? "";

  // Not currency-filtered on purpose — which bank to put on an invoice can
  // depend on what the specific client needs (e.g. a client paying in NGN
  // might still be sent USD account details on request), not just the
  // invoice's own currency. The "Default for {currency}" option above the
  // list still auto-picks based on currency when no explicit choice is made.
  const sortedBankAccounts = [...bankAccounts].sort(
    (a, b) => a.currency.localeCompare(b.currency) || a.bank_name.localeCompare(b.bank_name)
  );
  const availableCurrencies = Array.from(new Set(bankAccounts.map((a) => a.currency))).sort();
  if (availableCurrencies.length === 0) availableCurrencies.push("USD", "NGN");

  function updateSection(idx: number, patch: Partial<SectionForm>) {
    setSections((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }

  function updateItem(sIdx: number, iIdx: number, patch: Partial<LineItemForm>) {
    setSections((prev) =>
      prev.map((s, i) =>
        i === sIdx
          ? {
              ...s,
              items: s.items.map((li, j) => {
                if (j !== iIdx) return li;
                const next = { ...li, ...patch };
                // Editing qty/rate recalculates amount; editing amount
                // directly (e.g. for a flat one-off item) is left alone.
                if ("quantity" in patch || "rate" in patch) {
                  const computed = computeAmount(next.quantity, next.rate);
                  if (computed !== null) next.amount = computed;
                }
                return next;
              }),
            }
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
  const discount = Math.min(Math.max(parseFloat(discountAmount) || 0, 0), subtotal);
  const netSubtotal = Math.round((subtotal - discount) * 100) / 100;
  const vatAmount = Math.round(netSubtotal * 0.075 * 100) / 100;
  const grandTotal = Math.round((netSubtotal + vatAmount) * 100) / 100;

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
        billing_address: billingAddress || undefined,
        discount_amount: discount || undefined,
        service_entry_number: serviceEntryNumber || undefined,
        pdf_title: pdfTitle || undefined,
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
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-8">
      <div>
        <Link
          href="/invoices"
          className="flex w-fit items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          <ArrowLeft size={14} /> Invoices
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          New Invoice
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {error && <Alert>{error}</Alert>}

        <Card>
          <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Label>
              Client
              <Select
                value={clientId}
                onChange={(e) => {
                  setClientId(e.target.value);
                  const c = clients.find((c) => c.id === e.target.value);
                  if (c) setCurrency(c.default_currency || "USD");
                }}
              >
                <option value="" disabled>
                  Select a client
                </option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Label>

            <Label>
              Type
              <Select
                value={type}
                onChange={(e) => setType(e.target.value as "standard" | "proforma")}
              >
                <option value="standard">Standard</option>
                <option value="proforma">Proforma (client-branded)</option>
              </Select>
            </Label>

            <Label>
              Currency
              <Select
                value={currency}
                onChange={(e) => {
                  setCurrency(e.target.value);
                  setBankAccountId("");
                }}
              >
                {availableCurrencies.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Label>

            <Label>
              Bank Account
              <Select value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)}>
                <option value="">Default for {currency || "currency"}</option>
                {sortedBankAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    [{a.currency}] {a.bank_name} &middot; {a.account_number}
                  </option>
                ))}
              </Select>
            </Label>

            <Label>
              Invoice date
              <Input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
              />
            </Label>

            <Label>
              Due date
              <Select
                value={DUE_DATE_PRESETS.includes(dueDate) ? dueDate : "custom"}
                onChange={(e) => {
                  if (e.target.value === "custom") {
                    setDueDate(customDueDate ? formatDate(customDueDate) : "");
                  } else {
                    setDueDate(e.target.value);
                  }
                }}
              >
                {DUE_DATE_PRESETS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
                <option value="custom">Custom date&hellip;</option>
              </Select>
            </Label>

            {!DUE_DATE_PRESETS.includes(dueDate) && (
              <Label>
                Custom due date
                <Input
                  type="date"
                  value={customDueDate}
                  onChange={(e) => {
                    setCustomDueDate(e.target.value);
                    setDueDate(e.target.value ? formatDate(e.target.value) : "");
                  }}
                />
              </Label>
            )}

            {type === "proforma" && (
              <Label>
                Contract No.
                <Input
                  value={contractNo}
                  onChange={(e) => setContractNo(e.target.value)}
                  placeholder="e.g. PRO0014528"
                />
              </Label>
            )}

            <Label>
              PO Number
              <Input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} />
            </Label>

            <Label>
              Service Entry Number
              <Input
                value={serviceEntryNumber}
                onChange={(e) => setServiceEntryNumber(e.target.value)}
                placeholder="Optional — not all clients require this"
              />
            </Label>

            <Label>
              PDF Title
              <Input
                value={pdfTitle}
                onChange={(e) => setPdfTitle(e.target.value)}
                placeholder="Optional — defaults to the invoice number"
              />
            </Label>

            <Label className="col-span-full">
              Billing Address
              <Select
                value={billingAddressChoice}
                onChange={(e) => setBillingAddressChoice(e.target.value)}
              >
                {savedAddresses.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.address.length > 70 ? `${a.address.slice(0, 70)}…` : a.address}
                  </option>
                ))}
                <option value="new">+ Add new address</option>
              </Select>
            </Label>

            {billingAddressChoice === "new" && (
              <Label className="col-span-full">
                New address
                <Textarea
                  value={newAddressText}
                  onChange={(e) => setNewAddressText(e.target.value)}
                  rows={2}
                  placeholder="Street, city, state, country..."
                />
              </Label>
            )}
          </CardBody>
        </Card>

        {sections.map((section, sIdx) => (
          <Card key={sIdx}>
            <CardBody className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Input
                  value={section.title}
                  onChange={(e) => updateSection(sIdx, { title: e.target.value })}
                  placeholder={`Section ${sIdx + 1} title (e.g. "1. One-off Coding Fee")`}
                  className="flex-1 font-medium"
                />
                {sections.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeSection(sIdx)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                    title="Remove section"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>

              <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
                <table className="w-full text-left text-sm">
                  <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                    <tr>
                      <th className="px-3 py-2 font-medium">Description</th>
                      <th className="w-24 px-3 py-2 font-medium">Qty</th>
                      <th className="w-28 px-3 py-2 font-medium">Rate</th>
                      <th className="w-32 px-3 py-2 font-medium">Amount</th>
                      <th className="w-10 px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {section.items.map((li, iIdx) => (
                      <tr key={iIdx}>
                        <td className="px-3 py-1.5">
                          <Input
                            value={li.description}
                            onChange={(e) =>
                              updateItem(sIdx, iIdx, { description: e.target.value })
                            }
                            className="py-1.5"
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <Input
                            value={li.quantity}
                            onChange={(e) => updateItem(sIdx, iIdx, { quantity: e.target.value })}
                            inputMode="decimal"
                            className="py-1.5"
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <Input
                            value={li.rate}
                            onChange={(e) => updateItem(sIdx, iIdx, { rate: e.target.value })}
                            inputMode="decimal"
                            className="py-1.5"
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <Input
                            value={li.amount}
                            onChange={(e) => updateItem(sIdx, iIdx, { amount: e.target.value })}
                            inputMode="decimal"
                            className="py-1.5"
                          />
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          {section.items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeItem(sIdx, iIdx)}
                              className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                            >
                              <Trash2 size={13} />
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
                className="flex w-fit items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700"
              >
                <Plus size={13} /> Add line item
              </button>
            </CardBody>
          </Card>
        ))}

        <Button type="button" variant="secondary" onClick={addSection} className="self-start">
          <Plus size={15} /> Add section
        </Button>

        <Label>
          Notes
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </Label>

        <Card className="ml-auto w-80">
          <CardBody className="flex flex-col gap-1.5 text-sm">
            <div className="flex justify-between text-zinc-500">
              <span>Subtotal</span>
              <span>{formatMoney(subtotal, currency)}</span>
            </div>
            <div className="flex items-center justify-between gap-3 text-zinc-500">
              <label htmlFor="discount-amount">Discount</label>
              <input
                id="discount-amount"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={discountAmount}
                onChange={(e) => setDiscountAmount(e.target.value)}
                placeholder="0.00"
                className="w-24 rounded-md border border-zinc-300 bg-white px-2 py-1 text-right text-sm text-zinc-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>
            <div className="flex justify-between text-zinc-500">
              <span>VAT (7.5%)</span>
              <span>{formatMoney(vatAmount, currency)}</span>
            </div>
            <div className="flex justify-between border-t border-zinc-200 pt-1.5 text-base font-semibold text-zinc-900 dark:border-zinc-800 dark:text-zinc-50">
              <span>Grand Total</span>
              <span>{formatMoney(grandTotal, currency)}</span>
            </div>
          </CardBody>
        </Card>

        <Button type="submit" disabled={submitting} className="self-end">
          {submitting ? "Saving..." : "Save invoice"}
        </Button>
      </form>
    </main>
  );
}
