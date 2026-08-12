"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Building2,
  History,
  Landmark,
  Settings,
  UserCog,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, tone: "primary" as const },
  { href: "/invoices", label: "Invoices", icon: FileText, tone: "primary" as const },
  { href: "/clients", label: "Clients", icon: Building2, tone: "primary" as const },
];

// Shown to admin AND gm — matches the backend's admin+gm route group for
// bank accounts / company settings (see main.go).
const managementItems = [
  { href: "/settings/bank-accounts", label: "Bank Accounts", icon: Landmark },
  { href: "/settings/company", label: "Company Settings", icon: Settings },
];

// Admin only, matching the backend's admin-only route group.
const adminOnlyItems = [
  { href: "/audit", label: "Audit Log", icon: History },
  { href: "/settings/users", label: "Users", icon: UserCog },
];

function initials(name?: string) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "");
}

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  tone = "primary",
}: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  active: boolean;
  tone?: "primary" | "accent";
}) {
  const activeClasses =
    tone === "accent"
      ? "bg-brand-green-50 text-brand-green-700 dark:bg-brand-green-900/20 dark:text-brand-green-300"
      : "bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300";

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? activeClasses
          : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
      )}
    >
      <Icon size={17} strokeWidth={2} className="shrink-0" />
      {label}
    </Link>
  );
}

export function Sidebar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="h-1 shrink-0 bg-linear-to-r from-primary-600 to-brand-green-600" />
      <div className="flex items-center gap-2.5 border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
        <Image src="/petrodata-logo.png" alt="PetroData" width={30} height={30} />
        <div className="leading-tight">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">PetroData</p>
          <p className="text-[11px] text-zinc-400">Invoice System</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-4">
        {navItems.map((item) => (
          <NavLink key={item.href} {...item} active={pathname === item.href} />
        ))}

        {(user?.role === "admin" || user?.role === "gm") && (
          <>
            <p className="mb-1 mt-5 px-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Management
            </p>
            {managementItems.map((item) => (
              <NavLink key={item.href} {...item} active={pathname === item.href} />
            ))}
          </>
        )}

        {user?.role === "admin" && (
          <>
            <p className="mb-1 mt-5 px-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Admin
            </p>
            {adminOnlyItems.map((item) => (
              <NavLink key={item.href} {...item} active={pathname === item.href} />
            ))}
          </>
        )}
      </nav>

      <div className="flex items-center gap-2.5 border-t border-zinc-100 px-4 py-3 dark:border-zinc-800">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold uppercase text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">
          {initials(user?.name)}
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">
            {user?.name}
          </p>
          <p className="truncate text-xs capitalize text-zinc-400">{user?.role}</p>
        </div>
        <button
          onClick={logout}
          title="Sign out"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          <LogOut size={16} strokeWidth={2} />
        </button>
      </div>
    </aside>
  );
}
