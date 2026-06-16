"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Mail,
  Shield,
  UserMinus,
  ChevronDown,
  Loader2,
  Users,
  Link2,
  Check,
} from "lucide-react";

type Member = {
  id: string;
  role: string;
  createdAt: string;
  user: { id: string; name: string | null; email: string; image: string | null };
};

type Invitation = {
  id: string;
  email: string;
  role: string;
  token: string;
  expiresAt: string;
  createdAt: string;
  invitedBy: { name: string | null; email: string };
};

const ROLES = ["ADMIN", "EDITOR", "VIEWER"] as const;
const roleBadgeStyles: Record<string, string> = {
  ADMIN: "bg-indigo-50 text-indigo-700",
  EDITOR: "bg-emerald-50 text-emerald-700",
  VIEWER: "bg-gw-surface-2 text-gw-fg-muted",
};

export default function TeamMembersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [myRole, setMyRole] = useState<string>("VIEWER");

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("VIEWER");
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function copyInviteLink(inv: Invitation) {
    const url = `${window.location.origin}/invitations/accept?token=${inv.token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(inv.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  const isAdmin = myRole === "ADMIN";

  useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    try {
      const [membersRes, teamsRes, invitationsRes] = await Promise.all([
        fetch(`/api/teams/${id}/members`),
        fetch(`/api/teams`),
        fetch(`/api/teams/${id}/invitations`).catch(() => null),
      ]);

      if (membersRes.ok) {
        const membersData = await membersRes.json();
        setMembers(membersData);
      }

      if (teamsRes.ok) {
        const teamsData = await teamsRes.json();
        const thisTeam = teamsData.find((t: { id: string; role: string }) => t.id === id);
        if (thisTeam) setMyRole(thisTeam.role);
      }

      if (invitationsRes?.ok) {
        const invData = await invitationsRes.json();
        setInvitations(invData);
      }
    } catch {
      setError("Failed to load team data");
    } finally {
      setLoading(false);
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/teams/${id}/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to send invitation");
      setSuccess(`Invitation sent to ${inviteEmail.trim()}`);
      setInviteEmail("");
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setInviting(false);
    }
  }

  async function handleRoleChange(memberId: string, newRole: string) {
    try {
      const res = await fetch(`/api/teams/${id}/members/${memberId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update role");
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  async function handleRemoveMember(memberId: string) {
    if (!confirm("Remove this member from the team?")) return;
    try {
      const res = await fetch(`/api/teams/${id}/members/${memberId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to remove member");
      }
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  async function handleRevokeInvitation(inviteId: string) {
    try {
      await fetch(`/api/teams/${id}/invitations/${inviteId}`, { method: "DELETE" });
      setInvitations((prev) => prev.filter((i) => i.id !== inviteId));
    } catch {
      setError("Failed to revoke invitation");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/teams" className="inline-flex items-center gap-1.5 text-sm text-gw-fg-muted hover:text-gw-fg-muted mb-4">
          <ArrowLeft className="h-4 w-4" /> Back to teams
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-gw-fg">Team Members</h1>
        <p className="mt-1 text-sm text-gw-fg-muted">
          Manage who has access to this team and their roles.
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
          <button onClick={() => setError(null)} className="ml-2 font-medium underline">Dismiss</button>
        </div>
      )}
      {success && (
        <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-600">
          {success}
          <button onClick={() => setSuccess(null)} className="ml-2 font-medium underline">Dismiss</button>
        </div>
      )}

      {isAdmin && (
        <form
          onSubmit={handleInvite}
          className="rounded-2xl border border-gw-border bg-gw-surface p-5 shadow-sm"
        >
          <h2 className="text-sm font-semibold text-gw-fg mb-3">Invite Member</h2>
          <div className="flex gap-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="colleague@company.com"
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gw-fg placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              required
            />
            <div className="relative">
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="appearance-none rounded-lg border border-gray-300 bg-gw-surface px-3 py-2 pr-8 text-sm text-gw-fg-muted focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r.charAt(0) + r.slice(1).toLowerCase()}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gw-fg-subtle" />
            </div>
            <button
              type="submit"
              disabled={inviting || !inviteEmail.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-indigo-500 disabled:opacity-50"
            >
              {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Invite
            </button>
          </div>
        </form>
      )}

      <div className="rounded-2xl border border-gw-border bg-gw-surface shadow-sm">
        <div className="px-5 py-4 border-b border-gw-border">
          <h2 className="text-sm font-semibold text-gw-fg flex items-center gap-2">
            <Users className="h-4 w-4 text-gw-fg-subtle" />
            Members ({members.length})
          </h2>
        </div>
        <div className="divide-y divide-gw-border">
          {members.map((member) => (
            <div key={member.id} className="flex items-center gap-4 px-5 py-3.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-600">
                {(member.user.name ?? member.user.email)[0]?.toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gw-fg truncate">
                  {member.user.name ?? member.user.email}
                </p>
                <p className="text-xs text-gw-fg-subtle truncate">{member.user.email}</p>
              </div>

              {isAdmin ? (
                <div className="relative">
                  <select
                    value={member.role}
                    onChange={(e) => handleRoleChange(member.id, e.target.value)}
                    className="appearance-none rounded-lg border border-gw-border bg-gw-surface px-3 py-1.5 pr-7 text-xs font-medium text-gw-fg-muted focus:border-indigo-500 focus:outline-none"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{r.charAt(0) + r.slice(1).toLowerCase()}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gw-fg-subtle" />
                </div>
              ) : (
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${roleBadgeStyles[member.role]}`}>
                  <Shield className="h-3 w-3" />
                  {member.role}
                </span>
              )}

              {isAdmin && (
                <button
                  onClick={() => handleRemoveMember(member.id)}
                  className="rounded-lg p-1.5 text-gw-fg-subtle transition-colors hover:bg-red-50 hover:text-red-500"
                  title="Remove member"
                >
                  <UserMinus className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {isAdmin && invitations.length > 0 && (
        <div className="rounded-2xl border border-gw-border bg-gw-surface shadow-sm">
          <div className="px-5 py-4 border-b border-gw-border">
            <h2 className="text-sm font-semibold text-gw-fg flex items-center gap-2">
              <Mail className="h-4 w-4 text-gw-fg-subtle" />
              Pending Invitations ({invitations.length})
            </h2>
          </div>
          <div className="divide-y divide-gw-border">
            {invitations.map((inv) => (
              <div key={inv.id} className="flex items-center gap-4 px-5 py-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-50 text-xs font-bold text-amber-600">
                  {inv.email[0]?.toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gw-fg truncate">{inv.email}</p>
                  <p className="text-xs text-gw-fg-subtle">
                    Invited as {inv.role.toLowerCase()} · Expires{" "}
                    {new Date(inv.expiresAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => copyInviteLink(inv)}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-gw-fg-muted transition-colors hover:bg-gw-surface-hover hover:text-gw-fg-muted"
                  title="Copy invitation link"
                >
                  {copiedId === inv.id ? (
                    <><Check className="h-3.5 w-3.5 text-green-500" /> Copied</>
                  ) : (
                    <><Link2 className="h-3.5 w-3.5" /> Copy link</>
                  )}
                </button>
                <button
                  onClick={() => handleRevokeInvitation(inv.id)}
                  className="text-xs font-medium text-red-500 hover:text-red-700"
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
