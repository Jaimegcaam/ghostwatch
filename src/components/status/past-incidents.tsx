"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ChevronDown } from "lucide-react";
import type { StatusPagePalette } from "@/lib/status-page-theme";
import { getStatusPagePalette } from "@/lib/status-page-theme";

export type PastIncident = {
  id: string;
  headline: string;
  detail: string;
  status: "ONGOING" | "RESOLVED";
  startedAt: string;
  resolvedAt: string | null;
  regionLabel: string | null;
};

type PastIncidentsProps = {
  incidentsByDate: Record<string, PastIncident[]>;
  colors?: StatusPagePalette["incident"];
};

const VISIBLE_COUNT = 2;

function IncidentRow({
  inc,
  showBorder,
  colors,
}: {
  inc: PastIncident;
  showBorder: boolean;
  colors: StatusPagePalette["incident"];
}) {
  const isOngoing = inc.status === "ONGOING";
  const badgeLabel = isOngoing ? "Ongoing" : "Resolved";
  const badgeBg = isOngoing ? colors.ongoingBg : colors.resolvedBg;
  const badgeColor = isOngoing ? colors.ongoing : colors.resolvedText;

  return (
    <div
      className="px-5 py-3.5"
      style={{ borderTop: showBorder ? `1px solid ${colors.rowBorder}` : undefined }}
    >
      <div className="flex items-start gap-3">
        <span
          className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: "#f87171", opacity: isOngoing ? 1 : 0.85 }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <p className="text-sm font-medium" style={{ color: colors.headline }}>
                {inc.headline}
              </p>
              {inc.regionLabel && (
                <span
                  className="rounded-md px-1.5 py-0.5 text-[10px] font-medium"
                  style={{ backgroundColor: colors.regionBg, color: colors.regionText }}
                >
                  {inc.regionLabel}
                </span>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-xs tabular-nums" style={{ color: colors.time }}>
                {format(new Date(inc.startedAt), "HH:mm")}
                {" → "}
                {isOngoing ? (
                  <span className="font-medium" style={{ color: colors.ongoing }}>
                    now
                  </span>
                ) : (
                  format(new Date(inc.resolvedAt!), "HH:mm")
                )}
              </span>
              <span
                className="rounded-md px-2 py-0.5 text-[11px] font-semibold"
                style={{ backgroundColor: badgeBg, color: badgeColor }}
              >
                {badgeLabel}
              </span>
            </div>
          </div>
          <p className="mt-0.5 text-xs" style={{ color: colors.detail }}>
            {inc.detail}
          </p>
        </div>
      </div>
    </div>
  );
}

function DateGroup({
  dateKey,
  incidents,
  colors,
}: {
  dateKey: string;
  incidents: PastIncident[];
  colors: StatusPagePalette["incident"];
}) {
  const [expanded, setExpanded] = useState(false);
  const hiddenCount = Math.max(0, incidents.length - VISIBLE_COUNT);
  const visible = expanded ? incidents : incidents.slice(0, VISIBLE_COUNT);

  return (
    <div>
      <p className="mb-2 text-xs font-medium" style={{ color: colors.date }}>
        {format(new Date(dateKey + "T12:00:00"), "MMMM d, yyyy")}
      </p>
      <div
        className="rounded-xl"
        style={{
          backgroundColor: colors.cardBg,
          border: `1px solid ${colors.cardBorder}`,
        }}
      >
        {visible.map((inc, i) => (
          <IncidentRow
            key={inc.id}
            inc={inc}
            showBorder={i > 0}
            colors={colors}
          />
        ))}
        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex w-full items-center justify-center gap-1.5 border-t px-5 py-2.5 text-xs font-medium transition-colors"
            style={{
              borderColor: colors.rowBorder,
              color: colors.expandText,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = colors.expandHover;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <ChevronDown
              className="h-3.5 w-3.5 transition-transform duration-200"
              style={{ transform: expanded ? "rotate(180deg)" : undefined }}
            />
            {expanded
              ? "Show fewer incidents"
              : `Show ${hiddenCount} more incident${hiddenCount === 1 ? "" : "s"}`}
          </button>
        )}
      </div>
    </div>
  );
}

export function PastIncidents({ incidentsByDate, colors }: PastIncidentsProps) {
  const incidentColors = colors ?? getStatusPagePalette("light").incident;
  const sortedDates = Object.keys(incidentsByDate).sort((a, b) =>
    b.localeCompare(a),
  );

  return (
    <section className="mt-10">
      <h2
        className="mb-4 text-sm font-semibold"
        style={{ color: incidentColors.heading }}
      >
        Past Incidents
      </h2>
      <div className="space-y-6">
        {sortedDates.map((dateKey) => (
          <DateGroup
            key={dateKey}
            dateKey={dateKey}
            incidents={incidentsByDate[dateKey]}
            colors={incidentColors}
          />
        ))}
      </div>
    </section>
  );
}
