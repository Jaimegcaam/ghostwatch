"use client";

import type { ReactNode } from "react";

import { AuthPresentationPanel } from "@/components/auth/auth-presentation-panel";
import { GhostwatchLogo } from "@/components/brand/ghostwatch-logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";

type SplitAuthLayoutProps = {
  children: ReactNode;
};

export function SplitAuthLayout({ children }: SplitAuthLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-gw-bg lg:flex-row">
      <div className="hidden lg:block lg:w-[46%] lg:shrink-0 xl:w-[42%]">
        <AuthPresentationPanel />
      </div>

      <div className="relative flex flex-1 flex-col justify-center px-4 py-6 sm:px-6 sm:py-10 lg:px-14 lg:py-12">
        <div className="absolute right-3 top-3 sm:right-6 sm:top-6">
          <ThemeToggle className="rounded-lg border border-gw-border bg-gw-surface px-2.5 py-2 shadow-sm" />
        </div>

        <div className="mb-6 flex flex-col items-center gap-2 pt-8 lg:mb-8 lg:hidden lg:pt-0">
          <GhostwatchLogo tone="light" />
          <p className="max-w-xs text-center text-sm text-gw-fg-muted">
            Self-hosted uptime monitoring with public status pages
          </p>
        </div>

        <div className="mx-auto w-full max-w-md">
          <div className="rounded-2xl border border-gw-border bg-gw-surface p-5 shadow-sm sm:p-8">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
