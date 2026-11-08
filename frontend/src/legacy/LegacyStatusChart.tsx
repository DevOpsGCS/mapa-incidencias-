import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART_CHROME, STATUS_CHART_COLORS, STATUS_LABELS } from "./legacyLabels";
import { LegacyStats } from "./types";

interface LegacyStatusChartProps {
  stats: LegacyStats;
}

export function LegacyStatusChart({ stats }: LegacyStatusChartProps) {
  const data = (Object.keys(stats.byStatus) as (keyof typeof stats.byStatus)[]).map(
    (status) => ({
      status,
      label: STATUS_LABELS[status],
      count: stats.byStatus[status],
    })
  );

  return (
    <div className="glass-panel p-4">
      <h3 className="mono-label text-[11px] text-[color:var(--muted)]">Tickets por estado</h3>
      <div className="mt-2 h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <XAxis
              dataKey="label"
              tick={{ fill: CHART_CHROME.mutedText, fontSize: 12 }}
              axisLine={{ stroke: CHART_CHROME.axis }}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: CHART_CHROME.mutedText, fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
              contentStyle={{
                background: "#131d33",
                border: "1px solid var(--glass-border)",
                borderRadius: 8,
                color: CHART_CHROME.primaryText,
                fontSize: 12,
              }}
              labelStyle={{ color: CHART_CHROME.secondaryText }}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={48}>
              {data.map((entry) => (
                <Cell key={entry.status} fill={STATUS_CHART_COLORS[entry.status]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
