import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ACCENT_CYAN, CHART_CHROME } from "../lib/labels";
import { ZnunyStats } from "../lib/znunyStats";

interface TrendChartProps {
  stats: ZnunyStats;
}

const RANGE_OPTIONS = [7, 30] as const;

function formatShortDate(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00`);
  return date.toLocaleDateString("es-SV", { day: "2-digit", month: "short" });
}

export function TrendChart({ stats }: TrendChartProps) {
  const [rangeDays, setRangeDays] = useState<(typeof RANGE_OPTIONS)[number]>(7);

  const data = stats.trend.slice(-rangeDays).map((point) => ({
    ...point,
    label: formatShortDate(point.date),
  }));

  return (
    <div className="glass-panel p-4">
      <div className="flex items-center justify-between">
        <h3 className="mono-label text-[11px] text-[color:var(--muted)]">
          Tickets creados ({rangeDays} días)
        </h3>
        <div className="flex gap-1">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setRangeDays(option)}
              className={`mono-label rounded-full px-2.5 py-1 text-[10px] transition-colors ${
                rangeDays === option
                  ? "bg-[#3ED6C4]/20 text-[#3ED6C4]"
                  : "text-[color:var(--muted)] hover:text-[color:var(--text)]"
              }`}
            >
              {option}D
            </button>
          ))}
        </div>
      </div>
      <div className="mt-2 h-56">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={ACCENT_CYAN} stopOpacity={0.35} />
                <stop offset="100%" stopColor={ACCENT_CYAN} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              stroke={CHART_CHROME.grid}
              strokeDasharray="3 3"
            />
            <XAxis
              dataKey="label"
              tick={{ fill: CHART_CHROME.mutedText, fontSize: 11 }}
              axisLine={{ stroke: CHART_CHROME.axis }}
              tickLine={false}
              minTickGap={20}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: CHART_CHROME.mutedText, fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={32}
            />
            <Tooltip
              cursor={{ stroke: CHART_CHROME.axis, strokeWidth: 1 }}
              contentStyle={{
                background: "#131d33",
                border: "1px solid var(--glass-border)",
                borderRadius: 8,
                color: CHART_CHROME.primaryText,
                fontSize: 12,
              }}
              labelStyle={{ color: CHART_CHROME.secondaryText }}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke={ACCENT_CYAN}
              strokeWidth={2}
              fill="url(#trendFill)"
              dot={{ r: 3, fill: ACCENT_CYAN, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
