import { Sidebar } from "@/components/sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto animate-page-in">{children}</div>
    </div>
  );
}
