import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-zinc-300 px-6 py-16 text-center dark:border-zinc-700">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-100 text-zinc-400 dark:bg-zinc-800">
        <Icon size={20} strokeWidth={1.75} />
      </div>
      <div>
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">{title}</p>
        {description && (
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
