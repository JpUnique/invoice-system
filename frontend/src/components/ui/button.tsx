import Link from "next/link";
import { cn } from "@/lib/utils";

type Variant = "primary" | "accent" | "secondary" | "ghost" | "destructive";
type Size = "sm" | "md";

const variants: Record<Variant, string> = {
  primary:
    "bg-primary-600 text-white shadow-sm hover:bg-primary-700 focus-visible:outline-primary-600 disabled:bg-primary-300",
  // Green counterpart to primary — PetroData's mark is red *and* green, so
  // this is used in places that should stay visually distinct from the
  // primary red instead of defaulting everything to red.
  accent:
    "bg-brand-green-600 text-white shadow-sm hover:bg-brand-green-700 focus-visible:outline-brand-green-600 disabled:bg-brand-green-300",
  secondary:
    "bg-white text-zinc-700 border border-zinc-300 shadow-sm hover:bg-zinc-50 focus-visible:outline-zinc-400 dark:bg-zinc-900 dark:text-zinc-200 dark:border-zinc-700 dark:hover:bg-zinc-800",
  ghost:
    "text-zinc-600 hover:bg-zinc-100 focus-visible:outline-zinc-400 dark:text-zinc-300 dark:hover:bg-zinc-800",
  destructive:
    "text-red-600 hover:bg-red-50 focus-visible:outline-red-500 dark:text-red-400 dark:hover:bg-red-950",
};

const sizes: Record<Size, string> = {
  sm: "px-2.5 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
};

const base =
  "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-[color,background-color,border-color,transform] duration-150 ease-[var(--ease-out)] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.97]";

type CommonProps = {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: React.ReactNode;
};

type ButtonProps = CommonProps &
  React.ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };

type LinkProps = CommonProps &
  React.ComponentProps<typeof Link> & { href: string };

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonProps | LinkProps) {
  const classes = cn(base, variants[variant], sizes[size], className);

  if ("href" in props && props.href) {
    return (
      <Link className={classes} {...(props as LinkProps)}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} {...(props as ButtonProps)}>
      {children}
    </button>
  );
}
