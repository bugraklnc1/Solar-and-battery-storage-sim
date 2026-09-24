import { useState, useEffect, useMemo } from 'react';
import { loadSolarData } from './loadData';
import { simulate } from './simulate';
import type { HourlyRecord, SimulationResult } from './types';
import EnergyChart from './components/EnergyChart';
import ResultTable from './components/ResultTable';

type City = 'Berlin' | 'Madrid' | 'Lisbon';

const CITIES: City[] = ['Berlin', 'Madrid', 'Lisbon'];

const CITY_FLAGS: Record<City, string> = {
  Berlin: '🇩🇪',
  Madrid: '🇪🇸',
  Lisbon: '🇵🇹',
};

// ── Stat card ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  accent: string;  // Tailwind text color class
}

function StatCard({ label, value, sub, accent }: StatCardProps) {
  return (
    <div className="bg-slate-900/60 backdrop-blur border border-slate-700/50 rounded-2xl p-5 flex flex-col gap-1">
      <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">{label}</span>
      <span className={`text-2xl font-bold ${accent}`}>{value}</span>
      {sub && <span className="text-xs text-slate-600">{sub}</span>}
    </div>
  );
}

// ── Loading / Error screens ────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
      <div className="w-10 h-10 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
      <p className="text-slate-500 text-sm">Loading solar data…</p>
    </div>
  );
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-3 px-6">
      <p className="text-red-400 text-lg font-semibold">Failed to load data</p>
      <p className="text-slate-500 text-sm text-center max-w-md font-mono">{message}</p>
      <p className="text-slate-600 text-xs mt-2">
        Run: <code className="text-amber-400">python fetch_weather.py &amp;&amp; python clean_data.py</code>
      </p>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [allData, setAllData]   = useState<HourlyRecord[]>([]);
  const [city, setCity]         = useState<City>('Berlin');
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    loadSolarData()
      .then(setAllData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Filter records for selected city, then run simulation
  const cityRecords = useMemo(
    () => allData.filter(r => r.location === city),
    [allData, city],
  );

  const results: SimulationResult[] = useMemo(
    () => simulate(cityRecords),
    [cityRecords],
  );

  // Aggregate stats
  const stats = useMemo(() => {
    const totalPv        = results.reduce((s, r) => s + r.pv_output_kw, 0);
    const totalGrid      = results.reduce((s, r) => s + r.grid_draw_kw, 0);
    const totalCurtailed = results.reduce((s, r) => s + r.curtailed_kw, 0);
    const selfSuffHours  = results.filter(r => r.grid_draw_kw === 0).length;
    const selfSuffPct    = results.length > 0
      ? Math.round((selfSuffHours / results.length) * 100)
      : 0;
    return { totalPv, totalGrid, totalCurtailed, selfSuffPct };
  }, [results]);

  if (loading) return <LoadingScreen />;
  if (error)   return <ErrorScreen message={error} />;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* ── Subtle grid background ── */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle at 30% 20%, rgba(251,191,36,0.04) 0%, transparent 60%),' +
            'radial-gradient(circle at 70% 80%, rgba(52,211,153,0.04) 0%, transparent 60%)',
        }}
      />

      <div className="relative max-w-6xl mx-auto px-6 py-10 space-y-6">

        {/* ── Header ── */}
        <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <p className="text-xs text-amber-400 font-semibold uppercase tracking-widest mb-1">
              Solar & Battery Storage Simulator
            </p>
            <h1 className="text-3xl font-bold tracking-tight">
              {CITY_FLAGS[city]}&nbsp; {city}
              <span className="text-slate-600 text-xl font-normal ml-2">/ 7-day simulation</span>
            </h1>
          </div>

          {/* City selector */}
          <div className="flex gap-2">
            {CITIES.map(c => (
              <button
                key={c}
                onClick={() => setCity(c)}
                className={[
                  'px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200',
                  city === c
                    ? 'bg-amber-400 text-slate-900 shadow-lg shadow-amber-400/20'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200',
                ].join(' ')}
              >
                {CITY_FLAGS[c]} {c}
              </button>
            ))}
          </div>
        </header>

        {/* ── Stat row ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard
            label="Total PV Output"
            value={`${stats.totalPv.toFixed(1)} kWh`}
            sub="7-day generation"
            accent="text-amber-400"
          />
          <StatCard
            label="Self-Sufficiency"
            value={`${stats.selfSuffPct}%`}
            sub="hours without grid"
            accent="text-emerald-400"
          />
          <StatCard
            label="Grid Draw"
            value={`${stats.totalGrid.toFixed(1)} kWh`}
            sub="from utility grid"
            accent="text-red-400"
          />
          <StatCard
            label="Curtailed"
            value={`${stats.totalCurtailed.toFixed(1)} kWh`}
            sub="excess PV lost"
            accent="text-orange-400"
          />
        </div>

        {/* ── Chart ── */}
        <EnergyChart data={results} />

        {/* ── Table ── */}
        <ResultTable results={results} />

        {/* ── Footer ── */}
        <footer className="text-center text-xs text-slate-700 pb-4">
          Data: Open-Meteo API &nbsp;·&nbsp; Panel: 5 kW &nbsp;·&nbsp;
          Battery: 10 kWh &nbsp;·&nbsp; Consumption: 1.5 kW constant
        </footer>

      </div>
    </div>
  );
}
