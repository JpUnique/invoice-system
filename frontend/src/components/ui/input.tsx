import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const fieldClasses =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm transition-colors placeholder:text-zinc-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldClasses, className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldClasses, className)} {...props} />;
}

export function Select({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        className={cn(fieldClasses, "cursor-pointer appearance-none pr-8", className)}
        {...props}
      />
      <ChevronDown
        size={16}
        strokeWidth={2}
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400"
      />
    </div>
  );
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "flex flex-col gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300",
        className
      )}
      {...props}
    />
  );
}
