"use client";

import { useEffect, useState, FormEvent } from "react";
import Image from "next/image";
import { Protected } from "@/components/protected";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError, CompanySettings, API_URL } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
import { PageLoading } from "@/components/ui/spinner";

export default function CompanySettingsPage() {
  return (
    <Protected>
      <AppShell>
        <CompanySettingsContent />
      </AppShell>
    </Protected>
  );
}

function CompanySettingsContent() {
  const { token, user } = useAuth();
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function load() {
      if (!token) return;
      setLoading(true);
      try {
        setSettings(await api.getCompanySettings(token));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Could not load company settings");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  if (user && user.role !== "admin" && user.role !== "gm") {
    return (
      <main className="mx-auto w-full max-w-3xl p-8">
        <Alert>Only administrators and GMs can manage company settings.</Alert>
      </main>
    );
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!token) return;
    setError(null);
    setSaved(false);
    setSubmitting(true);
    try {
      const form = new FormData(e.currentTarget);
      const updated = await api.updateCompanySettings(token, form);
      setSettings(updated);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save company settings");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8">
      <PageHeader
        title="Company Settings"
        description="Letterhead details printed on every invoice — name, address, contact info, and logo."
      />

      {error && <Alert>{error}</Alert>}
      {saved && !error && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-3.5 py-2.5 text-sm text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-300">
          Company settings saved.
        </div>
      )}

      {loading || !settings ? (
        <PageLoading />
      ) : (
        <Card>
          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2"
            onChange={() => setSaved(false)}
          >
            <Label className="col-span-full">
              Company Name
              <Input name="name" required defaultValue={settings.name} />
            </Label>
            <Label>
              Address Line 1
              <Input name="address_line1" defaultValue={settings.address_line1} />
            </Label>
            <Label>
              Address Line 2
              <Input name="address_line2" defaultValue={settings.address_line2} />
            </Label>
            <Label>
              Phone
              <Input name="phone" defaultValue={settings.phone} />
            </Label>
            <Label>
              Email
              <Input name="email" type="email" defaultValue={settings.email} />
            </Label>
            <Label>
              Website
              <Input name="website" defaultValue={settings.website} />
            </Label>
            <Label>
              TIN
              <Input name="tin" defaultValue={settings.tin} />
            </Label>
            <Label className="col-span-full">
              RC Number
              <Input name="rc_number" defaultValue={settings.rc_number} />
            </Label>
            <Label className="col-span-full">
              Logo{settings.logo_url && " (leave blank to keep current logo)"}
              <div className="flex items-center gap-3">
                {settings.logo_url && (
                  <Image
                    src={`${API_URL}${settings.logo_url}`}
                    alt={settings.name}
                    width={36}
                    height={36}
                    className="h-9 w-9 shrink-0 rounded-lg border border-zinc-200 object-contain p-1 dark:border-zinc-700"
                    unoptimized
                  />
                )}
                <input
                  type="file"
                  name="logo"
                  accept="image/*"
                  className="text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-zinc-700 hover:file:bg-zinc-200 dark:text-zinc-400 dark:file:bg-zinc-800 dark:file:text-zinc-200"
                />
              </div>
            </Label>
            <div className="col-span-full flex justify-end">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving..." : "Save changes"}
              </Button>
            </div>
          </form>
        </Card>
      )}
    </main>
  );
}
