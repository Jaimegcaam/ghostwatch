"use client";

import { useId, useMemo, useRef, useState, type RefObject } from "react";
import { line, curveMonotoneX } from "d3-shape";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  useXAxisScale,
  useYAxisScale,
  usePlotArea,
  useXAxisInverseDataSnapScale,
  getRelativeCoordinate,
} from "recharts";
import { useTheme } from "@/components/theme/theme-provider";
import { getChartColors } from "@/lib/uptime-colors";

const ONE_HOUR_MS = 60 * 60 * 1000;

type ChartThemeColors = ReturnType<typeof getChartColors>;

function useChartThemeColors(): ChartThemeColors {
  const { theme, mounted } = useTheme();
  return useMemo(
    () => getChartColors(mounted && theme === "dark"),
    [theme, mounted],
  );
}

export interface ChartDataPoint {
  chartKey: string;
  at: number;
  time: string;
  responseTime: number;
  success: boolean;
  region?: string;
}

interface ResponseChartsPanelProps {
  data: ChartDataPoint[];
  regions: string[];
  regionLabels: Record<string, string>;
  /** null = show all regions side by side */
  activeRegion: string | null;
}

type HoverState = {
  point: ChartDataPoint;
  x: number;
  y: number;
};

export function filterLastHour(data: ChartDataPoint[]): ChartDataPoint[] {
  if (data.length === 0) return data;
  const latest = Math.max(...data.map((d) => d.at));
  const cutoff = latest - ONE_HOUR_MS;
  const inWindow = data.filter((d) => d.at >= cutoff);
  return inWindow.length > 0 ? inWindow : data;
}

export function formatChartTime(at: number): string {
  const d = new Date(at);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function findNearestPoint(
  data: ChartDataPoint[],
  plotX: number,
  xSnap: ((value: number) => unknown) | undefined,
  xScale: (value: unknown) => number | undefined,
): ChartDataPoint | null {
  if (data.length === 0) return null;

  if (xSnap) {
    const snappedAt = xSnap(plotX);
    if (typeof snappedAt === "number" && Number.isFinite(snappedAt)) {
      let nearest: ChartDataPoint | null = null;
      let minDist = Infinity;
      for (const point of data) {
        const dist = Math.abs(point.at - snappedAt);
        if (dist < minDist) {
          minDist = dist;
          nearest = point;
        }
      }
      if (nearest) return nearest;
    }
  }

  let nearest = data[0];
  let minDist = Infinity;
  for (const point of data) {
    const px = xScale(point.at);
    if (px == null || Number.isNaN(px)) continue;
    const dist = Math.abs(px - plotX);
    if (dist < minDist) {
      minDist = dist;
      nearest = point;
    }
  }
  return nearest;
}

function svgPointToContainer(
  svg: SVGSVGElement,
  container: HTMLElement,
  svgX: number,
  svgY: number,
): { x: number; y: number } {
  const pt = svg.createSVGPoint();
  pt.x = svgX;
  pt.y = svgY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const screen = pt.matrixTransform(ctm);
  const rect = container.getBoundingClientRect();
  return {
    x: screen.x - rect.left,
    y: screen.y - rect.top,
  };
}

function splitStatusRuns(data: ChartDataPoint[]): ChartDataPoint[][] {
  if (data.length === 0) return [];
  const runs: ChartDataPoint[][] = [[data[0]]];
  for (let i = 1; i < data.length; i++) {
    if (data[i].success !== data[i - 1].success) {
      runs.push([data[i]]);
    } else {
      runs[runs.length - 1].push(data[i]);
    }
  }
  return runs;
}

function SegmentPaths({
  data,
  successColor,
  failureColor,
}: {
  data: ChartDataPoint[];
  successColor: string;
  failureColor: string;
}) {
  const baseId = useId().replace(/:/g, "");
  const xScale = useXAxisScale();
  const yScale = useYAxisScale();
  const runs = useMemo(() => splitStatusRuns(data), [data]);

  if (!xScale || !yScale || data.length === 0) return null;

  const px = (at: number) => {
    const x = xScale(at);
    return x == null || Number.isNaN(x) ? null : x;
  };
  const py = (value: number) => {
    const y = yScale(value);
    return y == null || Number.isNaN(y) ? null : y;
  };

  const pathFor = (points: ChartDataPoint[]) => {
    if (points.length < 2) return null;
    const scaled = points
      .map((p) => {
        const x = px(p.at);
        const y = py(p.responseTime);
        if (x == null || y == null) return null;
        return { x, y };
      })
      .filter((p): p is { x: number; y: number } => p != null);
    if (scaled.length < 2) return null;
    const gen = line<{ x: number; y: number }>()
      .x((d) => d.x)
      .y((d) => d.y)
      .curve(curveMonotoneX);
    return gen(scaled);
  };

  return (
    <g>
      <defs>
        {data.slice(0, -1).map((point, i) => {
          const next = data[i + 1];
          if (point.success === next.success) return null;

          const x1 = px(point.at);
          const y1 = py(point.responseTime);
          const x2 = px(next.at);
          const y2 = py(next.responseTime);
          if (x1 == null || y1 == null || x2 == null || y2 == null) return null;

          return (
            <linearGradient
              key={i}
              id={`${baseId}-grad-${i}`}
              gradientUnits="userSpaceOnUse"
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
            >
              <stop
                offset="0%"
                stopColor={point.success ? successColor : failureColor}
              />
              <stop
                offset="100%"
                stopColor={next.success ? successColor : failureColor}
              />
            </linearGradient>
          );
        })}
      </defs>

      {runs.map((run, i) => {
        const d = pathFor(run);
        const stroke = run[0].success ? successColor : failureColor;
        if (d) {
          return (
            <path
              key={`run-${i}`}
              d={d}
              fill="none"
              stroke={stroke}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        }
        if (run.length === 1) {
          const x = px(run[0].at);
          const y = py(run[0].responseTime);
          if (x == null || y == null) return null;
          return (
            <circle
              key={`dot-${i}`}
              cx={x}
              cy={y}
              r={3}
              fill={stroke}
            />
          );
        }
        return null;
      })}

      {data.slice(0, -1).map((point, i) => {
        const next = data[i + 1];
        if (point.success === next.success) return null;

        const x1 = px(point.at);
        const y1 = py(point.responseTime);
        const x2 = px(next.at);
        const y2 = py(next.responseTime);
        if (x1 == null || y1 == null || x2 == null || y2 == null) return null;

        return (
          <line
            key={`grad-${i}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={`url(#${baseId}-grad-${i})`}
            strokeWidth={2}
            strokeLinecap="round"
          />
        );
      })}
    </g>
  );
}

function ChartInteraction({
  data,
  containerRef,
  onHoverChange,
  colors,
}: {
  data: ChartDataPoint[];
  containerRef: RefObject<HTMLDivElement | null>;
  onHoverChange: (hover: HoverState | null) => void;
  colors: ChartThemeColors;
}) {
  const plotArea = usePlotArea();
  const xScale = useXAxisScale();
  const yScale = useYAxisScale();
  const xSnap = useXAxisInverseDataSnapScale();
  const [activePoint, setActivePoint] = useState<ChartDataPoint | null>(null);

  if (!plotArea || !xScale || !yScale || data.length === 0) return null;

  const setHover = (point: ChartDataPoint | null) => {
    setActivePoint(point);
    if (!point) {
      onHoverChange(null);
      return;
    }
    const cx = xScale(point.at);
    const cy = yScale(point.responseTime);
    if (cx == null || cy == null || Number.isNaN(cx) || Number.isNaN(cy)) {
      onHoverChange(null);
      return;
    }

    const svgX = cx;
    const svgY = cy;
    const container = containerRef.current;
    const svg = container?.querySelector("svg");
    if (!container || !svg) {
      onHoverChange(null);
      return;
    }

    const { x, y } = svgPointToContainer(svg, container, svgX, svgY);
    onHoverChange({ point, x, y });
  };

  return (
    <g>
      <rect
        x={plotArea.x}
        y={plotArea.y}
        width={plotArea.width}
        height={plotArea.height}
        fill="transparent"
        style={{ cursor: "crosshair" }}
        onMouseMove={(event) => {
          const { relativeX } = getRelativeCoordinate(event);
          const chartX = plotArea.x + relativeX;
          const point = findNearestPoint(data, chartX, xSnap, xScale);
          if (!point) return;
          setHover(point);
        }}
        onMouseLeave={() => setHover(null)}
      />

      {activePoint ? (() => {
        const cx = xScale(activePoint.at);
        const cy = yScale(activePoint.responseTime);
        if (cx == null || cy == null || Number.isNaN(cx) || Number.isNaN(cy)) {
          return null;
        }
        const color = activePoint.success ? colors.success : colors.failure;
        return (
          <>
            <line
              x1={cx}
              y1={plotArea.y}
              x2={cx}
              y2={plotArea.y + plotArea.height}
              stroke={colors.crosshair}
              strokeDasharray="3 3"
            />
            <circle
              cx={cx}
              cy={cy}
              r={4}
              fill={color}
              stroke="var(--color-gw-surface, #fff)"
              strokeWidth={2}
            />
          </>
        );
      })() : null}
    </g>
  );
}

function ChartTooltip({
  hover,
  colors,
}: {
  hover: HoverState;
  colors: ChartThemeColors;
}) {
  const { point } = hover;
  const isSuccess = point.success;
  const color = isSuccess ? colors.success : colors.failure;
  const latency = formatResponseTime(point.responseTime);

  return (
    <div
      className="pointer-events-none absolute z-10 min-w-[7.5rem] rounded-lg border border-gw-border bg-gw-surface shadow-lg"
      style={{
        left: hover.x,
        top: hover.y,
        transform: "translate(-50%, calc(-100% - 12px))",
      }}
    >
      <div className="px-3 py-2">
        <p className="text-[10px] font-medium uppercase tracking-wide text-gw-fg-muted">
          Time
        </p>
        <p className="text-sm font-semibold tabular-nums text-gw-fg">
          {formatChartTime(point.at)}
        </p>
      </div>
      <div
        className="border-t border-gw-border px-3 py-2"
        style={{ borderColor: `${color}20` }}
      >
        <p
          className="text-[10px] font-medium uppercase tracking-wide"
          style={{ color }}
        >
          {isSuccess ? "Response time" : "Failed"}
        </p>
        <p className="text-sm font-bold tabular-nums" style={{ color }}>
          {latency.value}
          <span className="ml-0.5 text-xs font-semibold opacity-90">
            {latency.unit}
          </span>
        </p>
      </div>
      <div
        className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 -translate-y-1 rotate-45 border-b border-r border-gw-border bg-gw-surface"
        aria-hidden
      />
    </div>
  );
}

function niceStep(roughStep: number): number {
  if (roughStep <= 0) return 100;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const residual = roughStep / magnitude;
  if (residual <= 1) return magnitude;
  if (residual <= 2) return 2 * magnitude;
  if (residual <= 5) return 5 * magnitude;
  return 10 * magnitude;
}

/** Stable Y-axis domain + ticks so labels always ascend 0 → max. */
export function buildYAxisScale(data: ChartDataPoint[]): {
  domainMax: number;
  ticks: number[];
} {
  const dataMax = Math.max(...data.map((d) => d.responseTime), 0);
  if (dataMax <= 0) {
    return { domainMax: 100, ticks: [0, 25, 50, 75, 100] };
  }

  const paddedMax = dataMax * 1.08;
  const step = niceStep(paddedMax / 4);
  const domainMax = Math.ceil(paddedMax / step) * step;
  const ticks: number[] = [];
  for (let value = 0; value <= domainMax; value += step) {
    ticks.push(value);
  }
  return { domainMax, ticks };
}

/** Axis ticks: plain numbers; unit shown once on the axis label. */
export function formatYAxisTick(value: number, useSeconds: boolean): string {
  if (useSeconds) {
    const seconds = value / 1000;
    return Number.isInteger(seconds)
      ? String(seconds)
      : seconds.toFixed(1);
  }
  return String(Math.round(value));
}

export function formatResponseTime(ms: number): {
  value: string;
  unit: "ms" | "s";
} {
  if (ms >= 1000) {
    const seconds = ms / 1000;
    return {
      value: seconds >= 10 ? seconds.toFixed(0) : seconds.toFixed(1),
      unit: "s",
    };
  }
  return { value: String(Math.round(ms)), unit: "ms" };
}

function SingleRegionChart({
  data,
  title,
}: {
  data: ChartDataPoint[];
  title?: string;
}) {
  const [hover, setHover] = useState<HoverState | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const yScale = useMemo(() => buildYAxisScale(data), [data]);
  const colors = useChartThemeColors();
  const yAxisUsesSeconds = yScale.domainMax >= 2000;

  if (data.length === 0) {
    return (
      <div className="flex h-52 min-h-[13rem] items-center justify-center rounded-lg border border-gw-border bg-gw-surface-2 text-sm text-gw-fg-muted">
        No data in the last hour
      </div>
    );
  }

  return (
    <div className="flex min-h-0 min-w-[280px] flex-1 flex-col">
      {title ? (
        <p className="mb-2 truncate text-xs font-medium text-gw-fg-muted">
          {title}
        </p>
      ) : null}
      <div ref={containerRef} className="relative h-52 min-h-[13rem] w-full">
        {hover ? <ChartTooltip hover={hover} colors={colors} /> : null}
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            key={`${yScale.domainMax}-${yScale.ticks.join("-")}`}
            data={data}
            margin={{ top: 8, right: 12, bottom: 5, left: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
            <XAxis
              dataKey="at"
              type="number"
              domain={["dataMin", "dataMax"]}
              tick={{ fontSize: 11, fill: colors.tick }}
              tickLine={false}
              axisLine={{ stroke: colors.axis }}
              minTickGap={28}
              tickFormatter={(ts: number) => formatChartTime(ts)}
            />
            <YAxis
              type="number"
              domain={[0, yScale.domainMax]}
              ticks={yScale.ticks}
              allowDecimals={false}
              tick={{ fontSize: 10, fill: colors.tick }}
              tickLine={false}
              axisLine={{ stroke: colors.axis }}
              tickFormatter={(value: number) =>
                formatYAxisTick(value, yAxisUsesSeconds)
              }
              width={44}
              label={{
                value: yAxisUsesSeconds ? "s" : "ms",
                position: "insideTopLeft",
                offset: 4,
                style: { fontSize: 9, fill: colors.tick, fontWeight: 500 },
              }}
            />
            <Line
              type="monotone"
              dataKey="responseTime"
              stroke="transparent"
              strokeWidth={0}
              dot={false}
              isAnimationActive={false}
              activeDot={false}
              legendType="none"
            />
            <SegmentPaths
              data={data}
              successColor={colors.success}
              failureColor={colors.failure}
            />
            <ChartInteraction
              data={data}
              containerRef={containerRef}
              onHoverChange={setHover}
              colors={colors}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function ResponseChartsPanel({
  data,
  regions,
  regionLabels,
  activeRegion,
}: ResponseChartsPanelProps) {
  const windowData = useMemo(() => filterLastHour(data), [data]);

  const byRegion = useMemo(() => {
    const map: Record<string, ChartDataPoint[]> = {};
    for (const id of regions) {
      map[id] = windowData
        .filter((d) => d.region === id)
        .sort((a, b) => a.at - b.at);
    }
    return map;
  }, [windowData, regions]);

  const showAll = activeRegion == null && regions.length > 1;

  if (windowData.length === 0) {
    return (
      <div className="flex h-52 items-center justify-center rounded-lg border border-gw-border bg-gw-surface-2 text-sm text-gw-fg-muted">
        No data available yet
      </div>
    );
  }

  if (showAll) {
    return (
      <div className="flex flex-wrap gap-4">
        {regions.map((regionId) => (
          <SingleRegionChart
            key={regionId}
            data={byRegion[regionId] ?? []}
            title={regionLabels[regionId] ?? regionId}
          />
        ))}
      </div>
    );
  }

  const regionId = activeRegion ?? regions[0];
  const singleData = regionId ? (byRegion[regionId] ?? windowData) : windowData;

  return <SingleRegionChart data={singleData} />;
}

/** @deprecated Use ResponseChartsPanel */
export function ResponseChart({
  data,
  regions,
  regionLabels,
}: {
  data: ChartDataPoint[];
  regions?: string[];
  regionLabels?: Record<string, string>;
}) {
  const ids =
    regions ??
    ([...new Set(data.map((d) => d.region).filter(Boolean))] as string[]);
  return (
    <ResponseChartsPanel
      data={data}
      regions={ids.length > 0 ? ids : ["default"]}
      regionLabels={regionLabels ?? {}}
      activeRegion={ids.length > 1 ? null : (ids[0] ?? null)}
    />
  );
}
