/** Tailwind classes for uptime % that read well in light and dark dashboard UI. */
export function uptimePercentClass(percent: number): string {
  if (percent >= 99) return "text-emerald-600 dark:text-emerald-400";
  if (percent >= 95) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

export function uptimeStrokeClass(percent: number): string {
  if (percent >= 99) return "stroke-emerald-500 dark:stroke-emerald-400";
  if (percent >= 95) return "stroke-amber-500 dark:stroke-amber-400";
  return "stroke-red-500 dark:stroke-red-400";
}

/** Dashboard / app accent links — brand indigo. */
export const dashboardLinkClass =
  "text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300";

export const dashboardIconClass =
  "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400";

/** Destructive actions and danger zones — readable red in dark mode. */
export const dangerTextClass = "text-red-600 dark:text-red-400";
export const dangerBorderClass = "border-red-200 dark:border-red-800/50";
export const dangerOutlineButtonClass =
  "border border-red-200 bg-gw-surface text-red-600 transition-all hover:bg-red-50 dark:border-red-800/50 dark:text-red-400 dark:hover:bg-red-950/40";
export const dangerFilledButtonClass =
  "bg-red-600 text-white hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-400";
export const dangerZoneBorderClass = "border-red-200 dark:border-red-900/40";
export const dangerZoneTitleClass = "text-red-600 dark:text-red-400";
export const dangerAlertClass =
  "border border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300";
export const dangerAlertTitleClass = "text-red-800 dark:text-red-200";
export const dangerAlertBodyClass = "text-red-600 dark:text-red-400";
export const dangerIconClass = "text-red-600 dark:text-red-400";

export function getChartColors(isDark: boolean) {
  return {
    grid: isDark ? "#2a2f3a" : "#f0f0f0",
    axis: isDark ? "#374151" : "#e5e7eb",
    tick: isDark ? "#6b7280" : "#9ca3af",
    crosshair: isDark ? "#374151" : "#e5e7eb",
    success: "#10b981",
    failure: isDark ? "#f87171" : "#ef4444",
  };
}
