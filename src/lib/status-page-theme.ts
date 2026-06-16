export type StatusPageThemeMode = "light" | "dark";

export type MonitorBadgeStyle = {
  label: string;
  dot: string;
  bg: string;
  border: string;
  text: string;
};

export type StatusPagePalette = {
  pageBg: string;
  heroBg: string;
  heroSubtext: string;
  headerBg: string;
  headerBorder: string;
  divider: string;
  cardBg: string;
  cardBorder: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textSubtle: string;
  footerBorder: string;
  footerText: string;
  accent: string;
  maintenance: {
    bg: string;
    border: string;
    title: string;
    body: string;
    meta: string;
    tagBg: string;
    tagText: string;
    icon: string;
  };
  incident: {
    heading: string;
    date: string;
    cardBg: string;
    cardBorder: string;
    rowBorder: string;
    headline: string;
    detail: string;
    time: string;
    regionBg: string;
    regionText: string;
    ongoing: string;
    resolvedBg: string;
    resolvedText: string;
    ongoingBg: string;
    expandHover: string;
    expandText: string;
  };
  tagBg: string;
  tagText: string;
};

const LIGHT: StatusPagePalette = {
  pageBg: "#f9fafb",
  heroBg: "#0a0a0a",
  heroSubtext: "#737373",
  headerBg: "#ffffff",
  headerBorder: "#e5e7eb",
  divider: "#f3f4f6",
  cardBg: "#ffffff",
  cardBorder: "#e5e7eb",
  textPrimary: "#111827",
  textSecondary: "#374151",
  textMuted: "#6b7280",
  textSubtle: "#9ca3af",
  footerBorder: "#e5e7eb",
  footerText: "#9ca3af",
  accent: "#2563eb",
  maintenance: {
    bg: "#eff6ff",
    border: "#bfdbfe",
    title: "#1e40af",
    body: "#3b82f6",
    meta: "#60a5fa",
    tagBg: "#dbeafe",
    tagText: "#1e40af",
    icon: "#3b82f6",
  },
  incident: {
    heading: "#111827",
    date: "#6b7280",
    cardBg: "#ffffff",
    cardBorder: "#e5e7eb",
    rowBorder: "#f3f4f6",
    headline: "#111827",
    detail: "#6b7280",
    time: "#9ca3af",
    regionBg: "#f3f4f6",
    regionText: "#6b7280",
    ongoing: "#dc2626",
    resolvedBg: "#f0fdf4",
    resolvedText: "#16a34a",
    ongoingBg: "#fef2f2",
    expandHover: "#f9fafb",
    expandText: "#6b7280",
  },
  tagBg: "#f3f4f6",
  tagText: "#6b7280",
};

const DARK: StatusPagePalette = {
  pageBg: "#0f1117",
  heroBg: "#050608",
  heroSubtext: "#9ca3af",
  headerBg: "#161922",
  headerBorder: "#25283a",
  divider: "#25283a",
  cardBg: "#161922",
  cardBorder: "#25283a",
  textPrimary: "#f3f4f6",
  textSecondary: "#d1d5db",
  textMuted: "#9ca3af",
  textSubtle: "#6b7280",
  footerBorder: "#25283a",
  footerText: "#6b7280",
  accent: "#60a5fa",
  maintenance: {
    bg: "#172554",
    border: "#1e3a8a",
    title: "#93c5fd",
    body: "#60a5fa",
    meta: "#93c5fd",
    tagBg: "#1e3a8a",
    tagText: "#bfdbfe",
    icon: "#60a5fa",
  },
  incident: {
    heading: "#f3f4f6",
    date: "#9ca3af",
    cardBg: "#161922",
    cardBorder: "#25283a",
    rowBorder: "#25283a",
    headline: "#f3f4f6",
    detail: "#9ca3af",
    time: "#6b7280",
    regionBg: "#1a1d27",
    regionText: "#9ca3af",
    ongoing: "#f87171",
    resolvedBg: "#052e16",
    resolvedText: "#4ade80",
    ongoingBg: "#450a0a",
    expandHover: "#1a1d27",
    expandText: "#9ca3af",
  },
  tagBg: "#1a1d27",
  tagText: "#9ca3af",
};

export function parseStatusPageTheme(
  value: string | null | undefined,
): StatusPageThemeMode {
  return value === "dark" ? "dark" : "light";
}

export function getStatusPagePalette(theme: StatusPageThemeMode): StatusPagePalette {
  return theme === "dark" ? DARK : LIGHT;
}

export type StatusPageBarColors = {
  operational: string;
  degraded: string;
  outage: string;
  maintenance: string;
  nodata: string;
  operationalHover: string;
  degradedHover: string;
  outageHover: string;
  maintenanceHover: string;
  nodataHover: string;
};

export function getStatusPageBarColors(
  theme: StatusPageThemeMode,
): StatusPageBarColors {
  if (theme === "dark") {
    return {
      operational: "#22c55e",
      degraded: "#f59e0b",
      outage: "#f87171",
      maintenance: "#3b82f6",
      nodata: "#3b404d",
      operationalHover: "#4ade80",
      degradedHover: "#fbbf24",
      outageHover: "#fca5a5",
      maintenanceHover: "#60a5fa",
      nodataHover: "#4b5263",
    };
  }
  return {
    operational: "#22c55e",
    degraded: "#f59e0b",
    outage: "#ef4444",
    maintenance: "#3b82f6",
    nodata: "#d1d5db",
    operationalHover: "#4ade80",
    degradedHover: "#fbbf24",
    outageHover: "#f87171",
    maintenanceHover: "#60a5fa",
    nodataHover: "#b0b5bf",
  };
}

/** Uptime % text color — readable red on dark backgrounds (not deep red-700/800). */
export function uptimeDisplayColor(
  uptime: number,
  theme: StatusPageThemeMode,
): string {
  if (uptime >= 99.5) return theme === "dark" ? "#4ade80" : "#16a34a";
  if (uptime >= 95) return theme === "dark" ? "#fbbf24" : "#d97706";
  return theme === "dark" ? "#f87171" : "#dc2626";
}

export function getMonitorBadgeStyles(
  status: "maintenance" | "unknown" | "operational" | "degraded" | "outage",
  theme: StatusPageThemeMode,
): MonitorBadgeStyle {
  const light: Record<string, MonitorBadgeStyle> = {
    maintenance: {
      label: "Maintenance",
      dot: "#3b82f6",
      bg: "#eff6ff",
      border: "#bfdbfe",
      text: "#1d4ed8",
    },
    unknown: {
      label: "Unknown",
      dot: "#9ca3af",
      bg: "#f9fafb",
      border: "#e5e7eb",
      text: "#6b7280",
    },
    operational: {
      label: "Operational",
      dot: "#22c55e",
      bg: "#f0fdf4",
      border: "#bbf7d0",
      text: "#15803d",
    },
    degraded: {
      label: "Degraded",
      dot: "#f59e0b",
      bg: "#fffbeb",
      border: "#fde68a",
      text: "#b45309",
    },
    outage: {
      label: "Outage",
      dot: "#ef4444",
      bg: "#fef2f2",
      border: "#fecaca",
      text: "#b91c1c",
    },
  };

  const dark: Record<string, MonitorBadgeStyle> = {
    maintenance: {
      label: "Maintenance",
      dot: "#60a5fa",
      bg: "#172554",
      border: "#1e3a8a",
      text: "#93c5fd",
    },
    unknown: {
      label: "Unknown",
      dot: "#6b7280",
      bg: "#1a1d27",
      border: "#25283a",
      text: "#9ca3af",
    },
    operational: {
      label: "Operational",
      dot: "#4ade80",
      bg: "#052e16",
      border: "#166534",
      text: "#86efac",
    },
    degraded: {
      label: "Degraded",
      dot: "#fbbf24",
      bg: "#422006",
      border: "#854d0e",
      text: "#fcd34d",
    },
    outage: {
      label: "Outage",
      dot: "#f87171",
      bg: "#450a0a",
      border: "#991b1b",
      text: "#fca5a5",
    },
  };

  return (theme === "dark" ? dark : light)[status];
}
