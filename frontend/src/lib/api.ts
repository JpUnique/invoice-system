const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8081";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {}
): Promise<T> {
  const { token, headers, ...rest } = options;
  const finalHeaders = new Headers(headers);
  if (token) {
    finalHeaders.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_URL}${path}`, { ...rest, headers: finalHeaders });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, body.error ?? "Request failed");
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}

export type User = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "gm" | "preparer";
};

export type Client = {
  id: string;
  name: string;
  code: string;
  logo_url?: string;
  billing_address: string;
  attention_name: string;
  contact_email: string;
  contact_phone: string;
  default_currency: string;
};

export type InvoiceLineItem = {
  id: string;
  item_code: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
};

export type InvoiceSection = {
  id: string;
  title: string;
  line_items: InvoiceLineItem[];
};

export type Invoice = {
  id: string;
  invoice_no: string;
  type: "standard" | "proforma";
  status: "draft" | "sent" | "paid" | "void";
  client_id: string;
  currency: string;
  invoice_date: string;
  due_date: string;
  contract_no: string;
  po_number: string;
  vendor_code: string;
  invoice_period: string;
  subtotal: number;
  discount_amount: number;
  vat_rate: number;
  vat_amount: number;
  grand_total: number;
  amount_in_words: string;
  notes: string;
  created_at: string;
  sealed_at?: string;
  public_token: string;
  sections: InvoiceSection[];
};

export type InvoiceListRow = {
  id: string;
  invoice_no: string;
  type: string;
  status: string;
  currency: string;
  invoice_date: string;
  grand_total: number;
  created_at: string;
  client_id: string;
  client_name: string;
  client_code: string;
};

export type LineItemInput = {
  item_code?: string;
  description: string;
  quantity?: number;
  rate?: number;
  amount: number;
};

export type SectionInput = {
  title: string;
  line_items: LineItemInput[];
};

export type CreateInvoiceInput = {
  client_id: string;
  type: "standard" | "proforma";
  currency?: string;
  invoice_date?: string;
  due_date?: string;
  contract_no?: string;
  po_number?: string;
  vendor_code?: string;
  invoice_period?: string;
  notes?: string;
  bank_account_id?: string;
  billing_address?: string;
  discount_amount?: number;
  sections: SectionInput[];
};

export type BankAccount = {
  id: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  swift_code: string;
  bank_address: string;
  correspondent_bank: string;
  correspondent_account_number: string;
  correspondent_bank_address: string;
  correspondent_swift_code: string;
  correspondent_routing_number: string;
  correspondent_account_name: string;
  currency: string;
  is_default: boolean;
};

export type BankAccountInput = {
  bank_name: string;
  account_name: string;
  account_number: string;
  swift_code?: string;
  bank_address?: string;
  correspondent_bank?: string;
  correspondent_account_number?: string;
  correspondent_bank_address?: string;
  correspondent_swift_code?: string;
  correspondent_routing_number?: string;
  correspondent_account_name?: string;
  currency: string;
  is_default?: boolean;
};

export type CompanySettings = {
  name: string;
  address_line1: string;
  address_line2: string;
  phone: string;
  email: string;
  website: string;
  tin: string;
  rc_number: string;
  logo_url?: string;
};

export type DashboardSummary = {
  invoice_counts: Record<string, number>;
  total_clients: number;
  outstanding_by_currency: Record<string, number>;
  recent_invoices: {
    id: string;
    invoice_no: string;
    status: string;
    client_name: string;
    currency: string;
    grand_total: number;
    created_at: string;
  }[];
  billed_by_client: {
    client_id: string;
    client_name: string;
    currency: string;
    total_billed: number;
    invoice_count: number;
  }[];
};

export type AuditLogEntry = {
  id: string;
  actor_name: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  summary: string;
  created_at: string;
};

async function getPdfBlob(token: string, path: string) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, body.error ?? "Could not generate PDF");
  }
  return res.blob();
}

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>("/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }),

  me: (token: string) => request<User>("/api/v1/auth/me", { token }),

  listClients: (token: string) => request<Client[]>("/api/v1/clients", { token }),

  listClientAddresses: (token: string, clientId: string) =>
    request<{ id: string; address: string }[]>(`/api/v1/clients/${clientId}/addresses`, {
      token,
    }),

  createClient: (token: string, form: FormData) =>
    request<Client>("/api/v1/clients", { method: "POST", token, body: form }),

  updateClient: (token: string, id: string, form: FormData) =>
    request<Client>(`/api/v1/clients/${id}`, { method: "PUT", token, body: form }),

  deleteClient: (token: string, id: string) =>
    request<void>(`/api/v1/clients/${id}`, { method: "DELETE", token }),

  listInvoices: (token: string) => request<InvoiceListRow[]>("/api/v1/invoices", { token }),

  getInvoice: (token: string, id: string) =>
    request<Invoice>(`/api/v1/invoices/${id}`, { token }),

  createInvoice: (token: string, input: CreateInvoiceInput) =>
    request<Invoice>("/api/v1/invoices", {
      method: "POST",
      token,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),

  getInvoicePdfBlob: (token: string, id: string) =>
    getPdfBlob(token, `/api/v1/invoices/${id}/pdf`),

  updateInvoiceStatus: (token: string, id: string, status: string) =>
    request<Invoice>(`/api/v1/invoices/${id}/status`, {
      method: "PATCH",
      token,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }),

  sealInvoice: (token: string, id: string) =>
    request<Invoice>(`/api/v1/invoices/${id}/seal`, { method: "PATCH", token }),

  unsealInvoice: (token: string, id: string) =>
    request<Invoice>(`/api/v1/invoices/${id}/seal`, { method: "DELETE", token }),

  getDashboardSummary: (token: string) =>
    request<DashboardSummary>("/api/v1/dashboard/summary", { token }),

  listAuditLog: (token: string) =>
    request<AuditLogEntry[]>("/api/v1/audit-log", { token }),

  listBankAccounts: (token: string) =>
    request<BankAccount[]>("/api/v1/bank-accounts", { token }),

  createBankAccount: (token: string, input: BankAccountInput) =>
    request<BankAccount>("/api/v1/bank-accounts", {
      method: "POST",
      token,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),

  updateBankAccount: (token: string, id: string, input: BankAccountInput) =>
    request<BankAccount>(`/api/v1/bank-accounts/${id}`, {
      method: "PUT",
      token,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),

  deleteBankAccount: (token: string, id: string) =>
    request<void>(`/api/v1/bank-accounts/${id}`, { method: "DELETE", token }),

  getCompanySettings: (token: string) =>
    request<CompanySettings>("/api/v1/company-settings", { token }),

  updateCompanySettings: (token: string, form: FormData) =>
    request<CompanySettings>("/api/v1/company-settings", { method: "PUT", token, body: form }),

  listUsers: (token: string) => request<User[]>("/api/v1/users", { token }),

  createUser: (token: string, input: { name: string; email: string; password: string; role: string }) =>
    request<User>("/api/v1/users", {
      method: "POST",
      token,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
};

export { API_URL };
