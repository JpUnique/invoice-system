import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageLoading({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex flex-1 items-center justify-center gap-2 py-24 text-sm text-zinc-500">
      <Loader2 size={16} className="animate-spin" />
      {label}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("animate-spin", className)} />;
}
