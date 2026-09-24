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

// Tooltip must be a component reference (not <Instance />) to avoid Recharts freeze bug
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800/90 backdrop-blur border border-slate-600 rounded-xl p-3 text-xs shadow-xl">
      <p className="text-slate-300 font-medium mb-2">{formatTick(label)}</p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center gap-2 py-0.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: entry.color }} />
          <span className="text-slate-400">{entry.name}:</span>
          <span className="text-white font-semibold">
            {typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}
            {entry.dataKey === 'battery_soc_pct' ? ' %' : ' kW'}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function EnergyChart({ data }: Props) {
  // Show one tick per day (every 24 records). Using explicit ticks prevents label overlap.
  const tickValues = data
    .filter((_, i) => i % 24 === 0)
    .map(d => d.timestamp);

  return (
    <div className="bg-slate-900/60 backdrop-blur border border-slate-700/50 rounded-2xl p-6">
      <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-6">
        Energy Overview — 7 Days
      </h2>
      <ResponsiveContainer width="100%" height={340}>
        <ComposedChart data={data} margin={{ top: 4, right: 24, left: 0, bottom: 4 }}>
          <defs>
            <linearGradient id="batteryGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#34d399" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#34d399" stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />

          <XAxis
            dataKey="timestamp"
            ticks={tickValues}          // explicit daily ticks — no overlap
            tickFormatter={formatTick}
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            axisLine={{ stroke: '#334155' }}
            tickLine={false}
          />

          {/* Left Y axis: power (kW) */}
          <YAxis
            yAxisId="kw"
            domain={[0, 6]}
            tick={{ fill: '#94a3b8', fontSize: 11 }}
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
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}%`}
            width={46}
          />

          {/* Pass component reference — NOT <CustomTooltip /> — to avoid frozen tooltip bug */}
          <Tooltip content={CustomTooltip} />
          <Legend
            wrapperStyle={{ paddingTop: '20px', fontSize: '12px', color: '#94a3b8' }}
          />

          {/* Battery SOC — filled area on right axis */}
          <Area
            yAxisId="pct"
            type="monotone"
            dataKey="battery_soc_pct"
            name="Battery SOC"
            stroke="#34d399"
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
            stroke="#fbbf24"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
            activeDot={{ r: 4, strokeWidth: 0, fill: '#fbbf24' }}
          />

          {/* Grid Draw — dashed red line on left axis */}
          <Line
            yAxisId="kw"
            type="monotone"
            dataKey="grid_draw_kw"
            name="Grid Draw (kW)"
            stroke="#f87171"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            dot={false}
            isAnimationActive={false}
            activeDot={{ r: 3, strokeWidth: 0, fill: '#f87171' }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
