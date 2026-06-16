import { Activity, Globe, Server, Shield } from "lucide-react";

import { GhostwatchLogo } from "@/components/brand/ghostwatch-logo";

const highlights = [
  {
    icon: Activity,
    title: "Uptime monitoring",
    description: "HTTP checks with alerts when your services go down.",
  },
  {
    icon: Globe,
    title: "Public status pages",
    description: "Share uptime on your own domains — only what you choose is public.",
  },
  {
    icon: Server,
    title: "Self-hosted",
    description: "Your data stays on your infrastructure. MIT licensed.",
  },
  {
    icon: Shield,
    title: "Private by default",
    description: "Dashboard locked to your team. Invite members when you need to.",
  },
];

export function AuthPresentationPanel() {
  return (
    <div className="relative flex h-full min-h-[280px] flex-col justify-between overflow-hidden bg-gradient-to-br from-indigo-950 via-indigo-900 to-slate-900 p-8 text-white lg:min-h-screen lg:p-12">
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        aria-hidden
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, rgba(129,140,248,0.35) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(99,102,241,0.25) 0%, transparent 45%)",
        }}
      />

      <div className="relative">
        <GhostwatchLogo tone="dark" />
      </div>

      <div className="relative my-8 space-y-8 lg:my-0">
        <div>
          <h1 className="text-3xl font-bold leading-tight tracking-tight lg:text-4xl">
            Monitor your services.
            <span className="mt-1 block text-indigo-200">
              Own your status pages.
            </span>
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-indigo-100/80 lg:text-base">
            Open-source uptime monitoring you can self-host with Docker or
            Kubernetes. Simple setup, no vendor lock-in.
          </p>
        </div>

        <ul className="hidden max-w-md space-y-4 lg:block">
          {highlights.map(({ icon: Icon, title, description }) => (
            <li key={title} className="flex gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/10">
                <Icon className="h-4 w-4 text-indigo-200" aria-hidden />
              </div>
              <div>
                <p className="text-sm font-medium text-white">{title}</p>
                <p className="mt-0.5 text-sm text-indigo-100/70">{description}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <p className="relative text-xs text-indigo-200/60">
        Ghostwatch — MIT licensed · Self-hosted monitoring
      </p>
    </div>
  );
}
