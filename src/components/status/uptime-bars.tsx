"use client";

import { useState, useEffect, useMemo } from "react";

export type DayStatus =
  | "operational"
  | "degraded"
  | "outage"
  | "maintenance"
  | "nodata";

export type DayData = {
  date: string;
  percentage: number | null;
  isMaintenance?: boolean;
  /**
   * Sustained-outage aware classification. When present it drives the bar
   * color so a single transient failure shows as "degraded" (amber) instead
   * of a full outage (red).
   */
  status?: DayStatus;
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00");
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function resolveStatus(day: DayData): DayStatus {
  if (day.status) return day.status;
  // Backward-compatible fallback based on percentage only.
  if (day.isMaintenance) return "maintenance";
  if (day.percentage === null) return "nodata";
  if (day.percentage >= 99.5) return "operational";
  if (day.percentage >= 95) return "degraded";
  return "outage";
}

export type UptimeBarColorPalette = {
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

const DEFAULT_BAR_COLORS: UptimeBarColorPalette = {
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

function getBarColor(day: DayData, palette: UptimeBarColorPalette): string {
  switch (resolveStatus(day)) {
    case "maintenance":
      return palette.maintenance;
    case "nodata":
      return palette.nodata;
    case "operational":
      return palette.operational;
    case "degraded":
      return palette.degraded;
    case "outage":
      return palette.outage;
  }
}

function getBarHoverColor(day: DayData, palette: UptimeBarColorPalette): string {
  switch (resolveStatus(day)) {
    case "maintenance":
      return palette.maintenanceHover;
    case "nodata":
      return palette.nodataHover;
    case "operational":
      return palette.operationalHover;
    case "degraded":
      return palette.degradedHover;
    case "outage":
      return palette.outageHover;
  }
}

function useResponsiveDayCount(): number {
  const [count, setCount] = useState(90);

  useEffect(() => {
    function update() {
      const w = window.innerWidth;
      if (w < 640) setCount(30);
      else if (w < 1024) setCount(60);
      else setCount(90);
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return count;
}

type UptimeBarsProps = {
  days: DayData[];
  height?: number;
  showLabels?: boolean;
  gap?: number;
  responsive?: boolean;
  labelColor?: string;
  barColors?: UptimeBarColorPalette;
};

export function UptimeBars({
  days,
  height = 34,
  showLabels = true,
  gap = 2,
  responsive = false,
  labelColor,
  barColors = DEFAULT_BAR_COLORS,
}: UptimeBarsProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const responsiveCount = useResponsiveDayCount();

  const visibleDays = useMemo(() => {
    if (!responsive) return days;
    return days.slice(-responsiveCount);
  }, [days, responsive, responsiveCount]);

  const daysLabel = responsive ? `${responsiveCount} days ago` : "90 days ago";

  if (visibleDays.length === 0) return null;

  return (
    <div className="relative">
      <div className="flex items-stretch" style={{ gap: `${gap}px` }}>
        {visibleDays.map((day, i) => (
          <div
            key={day.date}
            className="relative min-w-0 flex-1"
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <div
              className="cursor-pointer transition-all duration-150"
              style={{
                height: `${height}px`,
                borderRadius: "4px",
                backgroundColor:
                  hoveredIndex === i
                    ? getBarHoverColor(day, barColors)
                    : getBarColor(day, barColors),
                transform: hoveredIndex === i ? "scaleY(1.15)" : undefined,
                transformOrigin: "bottom",
              }}
            />
            {hoveredIndex === i && (
              <div
                className={`pointer-events-none absolute bottom-full z-50 mb-2 whitespace-nowrap rounded-lg bg-gray-900 px-3 py-2 text-xs text-white shadow-lg ${
                  i < 10
                    ? "left-0"
                    : i > visibleDays.length - 10
                      ? "right-0"
                      : "left-1/2 -translate-x-1/2"
                }`}
              >
                <p className="font-semibold">{formatDate(day.date)}</p>
                <p className="mt-0.5 text-gray-300">
                  {(() => {
                    const status = resolveStatus(day);
                    if (status === "maintenance") return "Maintenance";
                    if (status === "nodata") return "No data";
                    const pct =
                      day.percentage !== null
                        ? `${day.percentage.toFixed(2)}% uptime`
                        : "";
                    if (status === "outage") return `Outage · ${pct}`;
                    if (status === "degraded") return `Degraded · ${pct}`;
                    return pct;
                  })()}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
      {showLabels && (
        <div
          className={`mt-2 flex justify-between text-xs ${labelColor ? "" : "text-gw-fg-subtle"}`}
          style={labelColor ? { color: labelColor } : undefined}
        >
          <span>{daysLabel}</span>
          <span>Today</span>
        </div>
      )}
    </div>
  );
}
