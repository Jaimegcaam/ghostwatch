import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import {
  getMainAppHosts,
  resolvePublicStatusPageByHost,
} from "@/lib/status-domains";
import { uptimePercentage } from "@/lib/utils";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const LOOKBACK_MS = 90 * MS_PER_DAY;

type IncidentRow = {
  id: string;
  title: string;
  status: "ONGOING" | "RESOLVED";
  startedAt: Date;
  resolvedAt: Date | null;
};

function incidentPayload(incident: IncidentRow, checkName: string) {
  const duration =
    incident.status === "RESOLVED" && incident.resolvedAt != null
      ? Math.floor(
          (incident.resolvedAt.getTime() - incident.startedAt.getTime()) / 1000,
        )
      : null;

  return {
    id: incident.id,
    checkName,
    title: incident.title,
    status: incident.status,
    startedAt: incident.startedAt,
    resolvedAt: incident.resolvedAt,
    duration,
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;

    // On a custom status domain, only the page bound to that host may be
    // served. This prevents reading another page's JSON via its slug.
    const h = await headers();
    const requestHost =
      h.get("x-ghostwatch-host") ||
      h.get("host")?.split(":")[0].toLowerCase() ||
      "";
    if (requestHost && !getMainAppHosts().has(requestHost)) {
      const bound = await resolvePublicStatusPageByHost(requestHost);
      if (!bound || bound.slug !== slug) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
    }

    const since = new Date(Date.now() - LOOKBACK_MS);

    const statusPage = await db.statusPage.findUnique({
      where: { slug },
      include: {
        checks: {
          include: {
            check: {
              select: {
                id: true,
                name: true,
                url: true,
                isPublic: true,
                enabled: true,
                results: {
                  where: {
                    createdAt: { gte: since },
                  },
                  orderBy: { createdAt: "desc" },
                  select: {
                    success: true,
                    createdAt: true,
                  },
                },
                incidents: {
                  where: {
                    startedAt: { gte: since },
                  },
                  orderBy: { startedAt: "desc" },
                  select: {
                    id: true,
                    title: true,
                    status: true,
                    startedAt: true,
                    resolvedAt: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!statusPage || !statusPage.isPublic) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const visible = statusPage.checks.filter(
      (spc) => spc.check.isPublic && spc.check.enabled,
    );

    const checks = visible.map((spc) => {
      const check = spc.check;
      const total = check.results.length;
      const successful = check.results.filter((r) => r.success).length;

      const dailyMap = new Map<string, { total: number; successful: number }>();
      for (const r of check.results) {
        const day = r.createdAt.toISOString().slice(0, 10);
        const entry = dailyMap.get(day) ?? { total: 0, successful: 0 };
        entry.total++;
        if (r.success) entry.successful++;
        dailyMap.set(day, entry);
      }

      const dailyUptime = Array.from(dailyMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, stats]) => ({
          date,
          uptime: uptimePercentage(stats.total, stats.successful),
        }));

      const incidents = check.incidents.map((inc) =>
        incidentPayload(inc, check.name),
      );

      return {
        id: check.id,
        name: check.name,
        url: check.url,
        uptime: uptimePercentage(total, successful),
        currentStatus: check.results[0]?.success ?? null,
        dailyUptime,
        incidents,
      };
    });

    const incidents = visible
      .flatMap((spc) =>
        spc.check.incidents.map((inc) => incidentPayload(inc, spc.check.name)),
      )
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());

    return NextResponse.json({
      title: statusPage.title,
      description: statusPage.description,
      checks,
      incidents,
    });
  } catch (error) {
    console.error("Failed to get status page:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
