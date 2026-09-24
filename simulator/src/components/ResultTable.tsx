import { useState } from 'react';
import type { SimulationResult } from '../types';

interface Props {
  results: SimulationResult[];
}

function formatTime(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleString('en-GB', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
    hour12: false, timeZone: 'UTC',
  });
}

function fmt(n: number, decimals = 2): string {
  return n.toFixed(decimals);
}

type Filter = 'all' | 'grid' | 'curtailed' | 'ok';

export default function ResultTable({ results }: Props) {
  const [filter, setFilter] = useState<Filter>('all');

  const visible = results.filter(r => {
    if (filter === 'grid')      return r.grid_draw_kw > 0;
    if (filter === 'curtailed') return r.curtailed_kw > 0;
    if (filter === 'ok')        return r.grid_draw_kw === 0 && r.curtailed_kw === 0;
    return true;
  });

  const countGrid    = results.filter(r => r.grid_draw_kw > 0).length;
  const countCurtail = results.filter(r => r.curtailed_kw > 0).length;
  const countOk      = results.filter(r => r.grid_draw_kw === 0 && r.curtailed_kw === 0).length;

  const tabs: { key: Filter; label: string; count: number; color: string }[] = [
    { key: 'all',       label: 'All Hours',   count: results.length, color: 'text-slate-600' },
    { key: 'ok',        label: '✓ Balanced',  count: countOk,        color: 'text-emerald-600' },
    { key: 'grid',      label: '⚡ Grid Draw', count: countGrid,      color: 'text-red-600' },
    { key: 'curtailed', label: '↑ Curtailed', count: countCurtail,   color: 'text-orange-600' },
  ];

  return (
    <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6">

      {/* Header + filter tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wider">
          Hourly Simulation Log
        </h2>
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={[
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150',
                filter === tab.key
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-400 hover:text-slate-700',
              ].join(' ')}
            >
              <span className={filter === tab.key ? tab.color : ''}>{tab.label}</span>
              <span className="ml-1.5 text-slate-400">{tab.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs text-slate-500 mb-4">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-slate-100 border border-slate-300" />
          Normal
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-orange-100 border border-orange-300" />
          Curtailed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-red-100 border border-red-300" />
          Grid Draw
        </span>
        <span className="text-slate-400 ml-auto">
          Battery SOC = end-of-hour state
        </span>
      </div>

      <div className="overflow-auto max-h-96 rounded-xl">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-100 text-slate-600">
              <th className="text-left px-3 py-2.5 font-medium rounded-tl-xl">Time (UTC)</th>
              <th className="text-right px-3 py-2.5 font-medium">PV Output</th>
              <th className="text-right px-3 py-2.5 font-medium">Consumption</th>
              <th className="text-right px-3 py-2.5 font-medium">Battery ↕</th>
              <th className="text-right px-3 py-2.5 font-medium">Battery SOC</th>
              <th className="text-right px-3 py-2.5 font-medium">Curtailed</th>
              <th className="text-right px-3 py-2.5 font-medium rounded-tr-xl">Grid Draw</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const isCurtailed = r.curtailed_kw > 0;
              const isGrid      = r.grid_draw_kw > 0;

              const batteryDischarged = isGrid
                ? Math.max(0, r.consumption_kw - r.pv_output_kw - r.grid_draw_kw)
                : 0;
              const batteryCharged = isCurtailed
                ? Math.max(0, r.pv_output_kw - r.consumption_kw - r.curtailed_kw)
                : 0;

              const rowBg = isCurtailed
                ? 'bg-orange-50 hover:bg-orange-100/60'
                : isGrid
                ? 'bg-red-50 hover:bg-red-100/60'
                : 'hover:bg-slate-50';

              return (
                <tr
                  key={r.timestamp}
                  className={`${rowBg} transition-colors border-b border-slate-100`}
                >
                  <td className="px-3 py-2 text-slate-700 font-mono">{formatTime(r.timestamp)}</td>
                  <td className="px-3 py-2 text-right text-amber-600">{fmt(r.pv_output_kw)} kW</td>
                  <td className="px-3 py-2 text-right text-slate-500">{fmt(r.consumption_kw)} kW</td>

                  {/* Battery contribution this hour */}
                  <td className="px-3 py-2 text-right">
                    {batteryDischarged > 0.001
                      ? <span className="text-sky-600">↓ {fmt(batteryDischarged)} kWh</span>
                      : batteryCharged > 0.001
                      ? <span className="text-emerald-600">↑ {fmt(batteryCharged)} kWh</span>
                      : r.pv_output_kw > r.consumption_kw
                      ? <span className="text-emerald-600 opacity-70">↑ {fmt(r.pv_output_kw - r.consumption_kw)} kWh</span>
                      : r.pv_output_kw < r.consumption_kw && !isGrid
                      ? <span className="text-sky-600 opacity-70">↓ {fmt(r.consumption_kw - r.pv_output_kw)} kWh</span>
                      : <span className="text-slate-300">—</span>}
                  </td>

                  {/* Battery SOC — end-of-hour */}
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {/* Mini SOC bar */}
                      <div className="w-14 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all"
                          style={{ width: `${r.battery_soc_pct}%` }}
                        />
                      </div>
                      <span className="text-emerald-600 w-10 text-right">{fmt(r.battery_soc_pct, 1)}%</span>
                    </div>
                  </td>

                  <td className="px-3 py-2 text-right">
                    {r.curtailed_kw > 0
                      ? <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-600 rounded px-1.5 py-0.5">
                          ↑ {fmt(r.curtailed_kw)} kW
                        </span>
                      : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {r.grid_draw_kw > 0
                      ? <span className="inline-flex items-center gap-1 bg-red-100 text-red-600 rounded px-1.5 py-0.5">
                          ⚡ {fmt(r.grid_draw_kw)} kW
                        </span>
                      : <span className="text-slate-300">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-400 mt-3 text-right">
        Showing {visible.length} of {results.length} hours
      </p>
    </div>
  );
}
