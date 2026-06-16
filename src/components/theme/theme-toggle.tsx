"use client";

import { Moon, Sun } from "lucide-react";

import { useTheme } from "@/components/theme/theme-provider";
import { cn } from "@/lib/utils";

type ThemeToggleProps = {
  className?: string;
  /** Sidebar uses a dark panel; auth/landing use light surfaces. */
  variant?: "sidebar" | "default";
};

export function ThemeToggle({ className, variant = "default" }: ThemeToggleProps) {
  const { toggleTheme, mounted } = useTheme();
  const sidebar = variant === "sidebar";

  return (
    <button
      type="button"
      disabled={!mounted}
      onClick={toggleTheme}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:opacity-60",
        sidebar
          ? "w-full text-[#c1c5d6] hover:bg-[#1a1d27] hover:text-white"
          : "text-gw-fg-muted hover:bg-gw-surface-hover hover:text-gw-fg",
        className,
      )}
      aria-label="Toggle color theme"
    >
      {/* Icons follow the <html> class set by ThemeScript — no React state lag. */}
      <Sun className="hidden h-4 w-4 shrink-0 dark:block" aria-hidden />
      <Moon className="h-4 w-4 shrink-0 dark:hidden" aria-hidden />
      <span className="hidden dark:inline">Light mode</span>
      <span className="dark:hidden">Dark mode</span>
    </button>
  );
}
