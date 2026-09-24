/**
 * Step 5: TypeScript data contract
 *
 * HourlyRecord  -> mirrors solar_data.json (matches Pydantic HourlyRecord exactly — project.md §5)
 * SimulationResult -> hourly output of the simulate() function
 */

// ---------------------------------------------------------------------------
// Input type — matches the Python-side solar_data.json contract (project.md §5)
// ---------------------------------------------------------------------------

export interface HourlyRecord {
  timestamp: string;
  location: 'Berlin' | 'Istanbul' | 'Lisbon';
  temperature_2m: number;        // °C
  shortwave_radiation: number;   // W/m²
}

// ---------------------------------------------------------------------------
// Output type — one entry per hour returned by simulate()
// ---------------------------------------------------------------------------

export interface SimulationResult {
  timestamp: string;
  location: 'Berlin' | 'Istanbul' | 'Lisbon';  // self-contained — safe for filtering
  pv_output_kw: number;       // PV output (kW) — includes temperature efficiency loss
  consumption_kw: number;     // Fixed home consumption (kW)
  battery_soc_kwh: number;    // Battery state of charge (kWh)
  battery_soc_pct: number;    // Battery state of charge (%) — 0 to 100
  curtailed_kw: number;       // Excess PV energy lost when battery is full (kW)
  grid_draw_kw: number;       // Energy drawn from the grid when battery is empty (kW)
}
