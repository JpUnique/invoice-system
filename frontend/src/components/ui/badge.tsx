import { cn } from "@/lib/utils";

type Tone = "zinc" | "blue" | "green" | "red" | "amber";

const tones: Record<Tone, string> = {
  zinc: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  blue: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  green: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300",
  red: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  amber: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
};

const dotTones: Record<Tone, string> = {
  zinc: "bg-zinc-400",
  blue: "bg-blue-500",
  green: "bg-green-500",
  red: "bg-red-500",
  amber: "bg-amber-500",
};

export function Badge({
  tone = "zinc",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium capitalize",
        tones[tone],
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", dotTones[tone])} />
      {children}
    </span>
  );
}
