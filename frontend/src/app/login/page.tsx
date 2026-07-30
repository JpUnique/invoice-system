"use client";

import { useState, FormEvent } from "react";
import Image from "next/image";
import { FileText, BarChart3, ShieldCheck, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";

const highlights = [
  { icon: FileText, text: "Standard & client co-branded proforma invoices" },
  { icon: BarChart3, text: "Revenue tracking by client, at a glance" },
  { icon: ShieldCheck, text: "Role-based approval workflow with a full audit trail" },
];

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not sign in");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Brand panel */}
      <div className="relative hidden w-[42%] flex-col justify-between overflow-hidden bg-gradient-to-br from-primary-700 via-primary-600 to-brand-green-600 p-10 text-white lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "24px 24px",
          }}
        />
        <div className="relative flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
            <Image src="/petrodata-logo.png" alt="PetroData" width={44} height={44} />
          </div>
          <div className="leading-tight">
            <p className="text-lg font-semibold tracking-wide">PetroData</p>
            <p className="text-xs text-white/70">Invoice System</p>
          </div>
        </div>

        <div className="relative flex flex-col gap-6">
          <h2 className="max-w-sm text-3xl font-semibold leading-tight tracking-tight">
            Professional invoicing, done right.
          </h2>
          <ul className="flex flex-col gap-3.5">
            {highlights.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-sm text-white/90">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/15">
                  <Icon size={13} strokeWidth={2} />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/60">
          PetroData Management Service Limited
        </p>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center bg-zinc-50 p-6 dark:bg-zinc-950">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center gap-3 lg:hidden">
            <div className="flex h-32 w-32 items-center justify-center rounded-3xl border border-zinc-200 bg-white shadow-card dark:border-zinc-800 dark:bg-zinc-900">
              <Image src="/petrodata-logo.png" alt="PetroData" width={92} height={92} />
            </div>
            <p className="text-sm font-semibold tracking-wide text-zinc-700 dark:text-zinc-200">
              Invoice System
            </p>
          </div>

          <Card className="p-7">
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                Welcome
              </h1>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Sign in to continue
              </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {error && <Alert>{error}</Alert>}

              <Label>
                Email
                <div className="relative">
                  <Mail
                    size={16}
                    strokeWidth={2}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
                  />
                  <Input
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@petrodata.net"
                    className="pl-9"
                  />
                </div>
              </Label>

              <Label>
                Password
                <div className="relative">
                  <Lock
                    size={16}
                    strokeWidth={2}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
                  />
                  <Input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-9 pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 transition-colors hover:text-zinc-600 dark:hover:text-zinc-300"
                  >
                    {showPassword ? (
                      <EyeOff size={16} strokeWidth={2} />
                    ) : (
                      <Eye size={16} strokeWidth={2} />
                    )}
                  </button>
                </div>
              </Label>

              <Button type="submit" variant="accent" disabled={submitting} className="mt-2 w-full">
                {submitting ? "Signing in..." : "Sign in"}
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
