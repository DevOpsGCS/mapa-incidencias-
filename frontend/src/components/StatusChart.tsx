import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { UI_HEX } from "../lib/dataColors";
import { buildStateColorMap, stateColor } from "../lib/znunyColors";
import { ZnunyStats } from "../lib/znunyStats";
import { Catalog, StateType } from "../types";

interface StatusChartProps {
  stats: ZnunyStats;
  catalog: Catalog;
  /** Clic en una barra: filtra el detalle por ese tipo de estado. */
  onSelectState?: (stateType: StateType) => void;
}

const STATE_TYPE_ORDER: Record<StateType, number> = { new: 0, open: 1, pending: 2, closed: 3 };

/** Solo el gráfico: el panel (título y "Ver detalles") lo pone MetricsView. */
export function StatusChart({ stats, catalog, onSelectState }: StatusChartProps) {
  const stateColors = buildStateColorMap(catalog.states);
  // Estados reales de la mesa (nombres en vivo), ordenados por tipo y luego por nombre.
  const data = [...stats.byState]
    .sort((a, b) => STATE_TYPE_ORDER[a.stateType] - STATE_TYPE_ORDER[b.stateType] || a.name.localeCompare(b.name))
    .map((entry) => ({ label: entry.name, count: entry.count, stateType: entry.stateType }));

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={UI_HEX.grid} />
          <XAxis
            dataKey="label"
            interval={0}
            tickFormatter={(value: string) => (value.length > 16 ? `${value.slice(0, 15)}…` : value)}
            tick={{ fill: UI_HEX.axis, fontSize: 12 }}
            axisLine={{ stroke: UI_HEX.grid }}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: UI_HEX.axis, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
            contentStyle={{
              background: UI_HEX.tooltipBg,
              borderRadius: 8,
              color: UI_HEX.tooltipText,
              fontSize: 12,
            }}
            labelStyle={{ color: UI_HEX.tooltipLabel }}
          />
          <Bar
            dataKey="count"
            radius={[4, 4, 0, 0]}
            maxBarSize={48}
            cursor={onSelectState ? "pointer" : undefined}
            onClick={(entry: { stateType?: StateType }) => {
              if (entry.stateType) onSelectState?.(entry.stateType);
            }}
          >
            {data.map((entry) => (
              <Cell key={entry.label} fill={stateColor(stateColors, entry.label, entry.stateType)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
