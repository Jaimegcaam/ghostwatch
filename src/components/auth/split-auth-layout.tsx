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
      <div className="lg:w-[46%] lg:shrink-0 xl:w-[42%]">
        <AuthPresentationPanel />
      </div>

      <div className="relative flex flex-1 flex-col justify-center px-6 py-10 sm:px-10 lg:px-14 lg:py-12">
        <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
          <ThemeToggle className="rounded-lg border border-gw-border bg-gw-surface px-2.5 py-2 shadow-sm" />
        </div>

        <div className="mb-8 flex justify-center lg:hidden">
          <GhostwatchLogo tone="light" />
        </div>

        <div className="mx-auto w-full max-w-md">
          <div className="rounded-2xl border border-gw-border bg-gw-surface p-8 shadow-sm">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
