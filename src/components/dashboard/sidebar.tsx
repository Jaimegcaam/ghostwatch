"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Activity,
  Bell,
  ChevronDown,
  Globe,
  LayoutDashboard,
  LogOut,
  Users,
  Wrench,
} from "lucide-react";

import type { DashboardUser } from "@/components/dashboard/dashboard-shell";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { persistActiveTeamCookie } from "@/lib/active-team";
import { resolveUploadUrl } from "@/lib/upload-url";
import { GhostwatchLogo } from "@/components/brand/ghostwatch-logo";

const navItems = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    match: (p: string) => p === "/dashboard" || p === "/dashboard/",
  },
  {
    href: "/checks",
    label: "Monitors",
    icon: Activity,
    match: (p: string) => p.startsWith("/checks"),
  },
  {
    href: "/integrations",
    label: "Integrations",
    icon: Bell,
    match: (p: string) => p.startsWith("/integrations"),
  },
  {
    href: "/maintenance",
    label: "Maintenance",
    icon: Wrench,
    match: (p: string) => p.startsWith("/maintenance"),
  },
  {
    href: "/status-page",
    label: "Status Pages",
    icon: Globe,
    match: (p: string) => p.startsWith("/status-page"),
  },
  {
    href: "/teams",
    label: "Team Settings",
    icon: Users,
    match: (p: string) => p.startsWith("/teams"),
  },
] as const;

type SidebarProps = {
  user: DashboardUser;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
};

export function Sidebar({
  user,
  mobileOpen,
  onMobileOpenChange,
}: SidebarProps) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const initial = (user.name ?? user.email)[0]?.toUpperCase() ?? "?";
  const [teamMenuOpen, setTeamMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const activeTeam = user.teams.find((t) => t.id === user.activeTeamId) ?? user.teams[0];
  const roleBadgeColor: Record<string, string> = {
    ADMIN: "#818cf8",
    EDITOR: "#34d399",
    VIEWER: "#6b7194",
  };

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setTeamMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function switchTeam(teamId: string) {
    setTeamMenuOpen(false);
    persistActiveTeamCookie(teamId);
    router.refresh();
  }

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      }`}
      style={{ backgroundColor: "#0f1117" }}
    >
      <div className="flex h-16 shrink-0 items-center px-5">
        <GhostwatchLogo tone="dark" />
      </div>

      {/* Team Switcher */}
      <div className="px-3 mb-2" ref={menuRef}>
        <button
          onClick={() => setTeamMenuOpen(!teamMenuOpen)}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors"
          style={{ backgroundColor: "#1a1d27", color: "#c1c5d6" }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#25283a"; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#1a1d27"; }}
        >
          {activeTeam?.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={resolveUploadUrl(activeTeam.imageUrl) ?? ""} alt="" className="h-7 w-7 shrink-0 rounded-md object-cover" />
          ) : (
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-indigo-600/20 text-xs font-bold text-indigo-400">
              {activeTeam?.name[0]?.toUpperCase() ?? "T"}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-white">
              {activeTeam?.name ?? "Select Team"}
            </p>
            <p className="text-[10px] font-medium" style={{ color: roleBadgeColor[activeTeam?.role ?? "VIEWER"] }}>
              {activeTeam?.role ?? ""}
            </p>
          </div>
          <ChevronDown
            className="h-4 w-4 shrink-0 transition-transform"
            style={{ color: "#6b7194", transform: teamMenuOpen ? "rotate(180deg)" : "rotate(0deg)" }}
          />
        </button>

        {teamMenuOpen && (
          <div
            className="mt-1 rounded-lg py-1 shadow-lg"
            style={{ backgroundColor: "#1e2130", border: "1px solid #25283a" }}
          >
            {user.teams.map((team) => (
              <button
                key={team.id}
                onClick={() => switchTeam(team.id)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] transition-colors"
                style={{
                  color: team.id === activeTeam?.id ? "#ffffff" : "#c1c5d6",
                  backgroundColor: team.id === activeTeam?.id ? "#25283a" : "transparent",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#25283a"; }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = team.id === activeTeam?.id ? "#25283a" : "transparent";
                }}
              >
                {team.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={resolveUploadUrl(team.imageUrl) ?? ""} alt="" className="h-6 w-6 shrink-0 rounded-md object-cover" />
                ) : (
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-indigo-600/20 text-[10px] font-bold text-indigo-400">
                    {team.name[0]?.toUpperCase()}
                  </div>
                )}
                <span className="truncate flex-1">{team.name}</span>
                <span className="text-[10px]" style={{ color: roleBadgeColor[team.role] }}>
                  {team.role}
                </span>
              </button>
            ))}
            <div style={{ borderTop: "1px solid #25283a", margin: "4px 0" }} />
            <Link
              href="/teams/new"
              onClick={() => { setTeamMenuOpen(false); onMobileOpenChange(false); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-[13px] transition-colors"
              style={{ color: "#818cf8" }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#25283a"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
            >
              + Create Team
            </Link>
          </div>
        )}
      </div>

      <nav className="mt-2 flex flex-1 flex-col gap-1 px-3 overflow-y-auto">
        <p
          className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-widest"
          style={{ color: "#6b7194" }}
        >
          Menu
        </p>
        {navItems
          .filter(({ href }) => {
            if (href === "/teams" && activeTeam?.role === "VIEWER") return false;
            return true;
          })
          .map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <Link
              key={href}
              href={href}
              onClick={() => onMobileOpenChange(false)}
              className="relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors"
              style={{
                backgroundColor: active ? "#1e2130" : undefined,
                color: active ? "#ffffff" : "#c1c5d6",
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.backgroundColor = "#1a1d27";
                  e.currentTarget.style.color = "#ffffff";
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = "#c1c5d6";
                }
              }}
            >
              {active && (
                <span
                  className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-indigo-500"
                />
              )}
              <Icon
                className="h-[18px] w-[18px] shrink-0"
                style={{ color: active ? "#818cf8" : "#6b7194" }}
                aria-hidden
              />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3" style={{ borderTop: "1px solid #25283a" }}>
        <ThemeToggle variant="sidebar" className="mb-2" />
        <div className="flex items-center gap-3 rounded-lg px-3 py-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">
              {user.name ?? "Account"}
            </p>
            <p className="truncate text-xs" style={{ color: "#6b7194" }}>
              {user.email}
            </p>
          </div>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="rounded-lg p-1.5 transition-colors"
            style={{ color: "#6b7194" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#ffffff";
              e.currentTarget.style.backgroundColor = "#1a1d27";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "#6b7194";
              e.currentTarget.style.backgroundColor = "transparent";
            }}
            aria-label="Log out"
          >
            <LogOut className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
    </aside>
  );
}
