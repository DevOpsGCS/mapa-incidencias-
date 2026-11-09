import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { UI_HEX } from "../lib/dataColors";

interface TrendChartProps {
  /** Serie ya recortada al rango del encabezado (trendFor). */
  data: { date: string; count: number }[];
}

function formatShortDate(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00`);
  return date.toLocaleDateString("es-SV", { day: "2-digit", month: "short" });
}

/** Solo el gráfico: el panel (título y "Ver detalles") lo pone MetricsView. */
export function TrendChart({ data }: TrendChartProps) {
  const points = data.map((point) => ({ ...point, label: formatShortDate(point.date) }));

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={UI_HEX.line} stopOpacity={0.2} />
              <stop offset="100%" stopColor={UI_HEX.line} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={UI_HEX.grid} />
          <XAxis
            dataKey="label"
            tick={{ fill: UI_HEX.axis, fontSize: 12 }}
            axisLine={{ stroke: UI_HEX.grid }}
            tickLine={false}
            minTickGap={20}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: UI_HEX.axis, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip
            cursor={{ stroke: UI_HEX.axis, strokeWidth: 1 }}
            contentStyle={{
              background: UI_HEX.tooltipBg,
              borderRadius: 8,
              color: UI_HEX.tooltipText,
              fontSize: 12,
            }}
            labelStyle={{ color: UI_HEX.tooltipLabel }}
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke={UI_HEX.line}
            strokeWidth={2}
            fill="url(#trendFill)"
            dot={points.length > 40 ? false : { r: 3, fill: UI_HEX.line, strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
