import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import type { SimulationResult } from '../types';

interface Props {
  data: SimulationResult[];
}

/** "2026-09-20T14:00Z" → "Sep 20 14:00" */
function formatTick(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleString('en-GB', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  });
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/95 backdrop-blur border border-slate-200 rounded-xl p-3 text-xs shadow-xl">
      <p className="text-slate-700 font-medium mb-2">{formatTick(label)}</p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center gap-2 py-0.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: entry.color }} />
          <span className="text-slate-500">{entry.name}:</span>
          <span className="text-slate-900 font-semibold">
            {typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}
            {entry.dataKey === 'battery_soc_pct' ? ' %' : ' kW'}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function EnergyChart({ data }: Props) {
  const tickValues = data
    .filter((_, i) => i % 24 === 0)
    .map(d => d.timestamp);

  return (
    <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6">
      <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wider mb-6">
        Energy Overview — 7 Days
      </h2>
      <ResponsiveContainer width="100%" height={340}>
        <ComposedChart data={data} margin={{ top: 4, right: 24, left: 0, bottom: 4 }}>
          <defs>
            <linearGradient id="batteryGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#10b981" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />

          <XAxis
            dataKey="timestamp"
            ticks={tickValues}
            tickFormatter={formatTick}
            tick={{ fill: '#64748b', fontSize: 11 }}
            axisLine={{ stroke: '#e2e8f0' }}
            tickLine={false}
          />

          {/* Left Y axis: power (kW) */}
          <YAxis
            yAxisId="kw"
            domain={[0, 6]}
            tick={{ fill: '#64748b', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v} kW`}
            width={56}
          />

          {/* Right Y axis: battery % */}
          <YAxis
            yAxisId="pct"
            orientation="right"
            domain={[0, 100]}
            tick={{ fill: '#64748b', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}%`}
            width={46}
          />

          <Tooltip content={CustomTooltip} />
          <Legend
            wrapperStyle={{ paddingTop: '20px', fontSize: '12px', color: '#64748b' }}
          />

          {/* Battery SOC — filled area on right axis */}
          <Area
            yAxisId="pct"
            type="monotone"
            dataKey="battery_soc_pct"
            name="Battery SOC"
            stroke="#059669"
            strokeWidth={1.5}
            fill="url(#batteryGrad)"
            dot={false}
            isAnimationActive={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />

          {/* PV Output — line on left axis */}
          <Line
            yAxisId="kw"
            type="monotone"
            dataKey="pv_output_kw"
            name="PV Output (kW)"
            stroke="#d97706"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
            activeDot={{ r: 4, strokeWidth: 0, fill: '#d97706' }}
          />

          {/* Grid Draw — dashed red line on left axis */}
          <Line
            yAxisId="kw"
            type="monotone"
            dataKey="grid_draw_kw"
            name="Grid Draw (kW)"
            stroke="#dc2626"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            dot={false}
            isAnimationActive={false}
            activeDot={{ r: 3, strokeWidth: 0, fill: '#dc2626' }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
