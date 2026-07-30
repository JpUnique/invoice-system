import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function Alert({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
        className
      )}
    >
      <AlertCircle size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}
