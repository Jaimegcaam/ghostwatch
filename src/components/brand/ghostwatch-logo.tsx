import { cn } from "@/lib/utils";

type GhostwatchLogoProps = {
  className?: string;
  /** Icon + wordmark, or icon only (favicon-sized slots). */
  variant?: "full" | "icon";
  /**
   * `dark` — sidebar / indigo panels (light ghost + white text).
   * `light` — dashboard header / status pages (indigo ghost + slate text).
   */
  tone?: "dark" | "light";
};

function GhostMark({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/ghostwatch-icon.svg"
      alt=""
      className={cn("h-8 w-8 shrink-0", className)}
      aria-hidden
    />
  );
}

export function GhostwatchLogo({
  className,
  variant = "full",
  tone = "light",
}: GhostwatchLogoProps) {
  const ghostName =
    tone === "dark" ? "text-white" : "text-gw-fg";
  const ghostAccent =
    tone === "dark" ? "text-teal-300" : "text-teal-600";

  if (variant === "icon") {
    return <GhostMark className={className} />;
  }

  return (
    <span
      className={cn("inline-flex items-center gap-2.5", className)}
      aria-label="Ghostwatch"
    >
      <GhostMark />
      <span
        className={cn(
          "text-[1.05rem] font-semibold tracking-tight leading-none",
          ghostName,
        )}
      >
        <span>ghost</span>
        <span className={ghostAccent}>watch</span>
      </span>
    </span>
  );
}
