"use client";

import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export function Nav() {
  const { user, logout } = useAuth();

  return (
    <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-3 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-3">
        <Image src="/petrodata-logo.png" alt="PetroData" width={32} height={32} />
        <nav className="flex gap-4 text-sm font-medium text-zinc-600 dark:text-zinc-300">
          <Link href="/" className="hover:text-zinc-900 dark:hover:text-zinc-50">
            Dashboard
          </Link>
          <Link href="/invoices" className="hover:text-zinc-900 dark:hover:text-zinc-50">
            Invoices
          </Link>
          <Link href="/transmittals" className="hover:text-zinc-900 dark:hover:text-zinc-50">
            Transmittals
          </Link>
          <Link href="/clients" className="hover:text-zinc-900 dark:hover:text-zinc-50">
            Clients
          </Link>
          {user?.role === "admin" && (
            <>
              <Link href="/audit" className="hover:text-zinc-900 dark:hover:text-zinc-50">
                Audit Log
              </Link>
              <Link
                href="/settings/bank-accounts"
                className="hover:text-zinc-900 dark:hover:text-zinc-50"
              >
                Bank Accounts
              </Link>
              <Link href="/settings/users" className="hover:text-zinc-900 dark:hover:text-zinc-50">
                Users
              </Link>
            </>
          )}
        </nav>
      </div>
      <div className="flex items-center gap-3 text-sm text-zinc-600 dark:text-zinc-300">
        <span>
          {user?.name} <span className="text-zinc-400">({user?.role})</span>
        </span>
        <button
          onClick={logout}
          className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
