import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART_CHROME } from "../lib/labels";
import { stateTypeColor } from "../lib/znunyColors";
import { ZnunyStats } from "../lib/znunyStats";
import { StateType } from "../types";

interface StatusChartProps {
  stats: ZnunyStats;
}

const STATE_TYPE_ORDER: Record<StateType, number> = { new: 0, open: 1, pending: 2, closed: 3 };

export function StatusChart({ stats }: StatusChartProps) {
  // Estados reales de Znuny (nombres en vivo), ordenados por tipo y luego por nombre.
  const data = [...stats.byState]
    .sort((a, b) => STATE_TYPE_ORDER[a.stateType] - STATE_TYPE_ORDER[b.stateType] || a.name.localeCompare(b.name))
    .map((entry) => ({ label: entry.name, count: entry.count, stateType: entry.stateType }));

  return (
    <div className="glass-panel p-4">
      <h3 className="mono-label text-[11px] text-[color:var(--muted)]">Tickets por estado</h3>
      <div className="mt-2 h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <XAxis
              dataKey="label"
              interval={0}
              tickFormatter={(value: string) => (value.length > 16 ? `${value.slice(0, 15)}…` : value)}
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
                <Cell key={entry.label} fill={stateTypeColor(entry.stateType)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
