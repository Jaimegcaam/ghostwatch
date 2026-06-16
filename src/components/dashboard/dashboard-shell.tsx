"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";

import { Sidebar } from "@/components/dashboard/sidebar";
import { TeamProvider } from "@/components/dashboard/team-context";
import { GhostwatchLogo } from "@/components/brand/ghostwatch-logo";

export type TeamInfo = {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  role: string;
  projects: { id: string; name: string; slug: string }[];
};

export type DashboardUser = {
  id: string;
  name: string | null;
  email: string;
  teams: TeamInfo[];
  activeTeamId: string;
  activeTeamRole: string;
};

type DashboardShellProps = {
  user: DashboardUser;
  children: React.ReactNode;
};

export function DashboardShell({ user, children }: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <TeamProvider teamId={user.activeTeamId} role={user.activeTeamRole}>
      <div className="min-h-screen bg-gw-bg">
        <Sidebar
          user={user}
          mobileOpen={mobileOpen}
          onMobileOpenChange={setMobileOpen}
        />

        {mobileOpen && (
          <div
            className="fixed inset-0 z-40 bg-gray-900 lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
        )}

        <div className="lg:pl-64">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-gw-border bg-gw-surface px-4 lg:hidden">
            <button
              type="button"
              aria-label="Toggle menu"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gw-fg-muted hover:bg-gw-surface-hover"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
            <GhostwatchLogo tone="light" className="scale-90 origin-left" />
          </header>
          <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {children}
          </main>
        </div>
      </div>
    </TeamProvider>
  );
}
