/**
 * Step 5: PV output + battery charge/discharge simulation
 *
 * A pure TypeScript module, fully independent of the UI layer.
 * No global state — identical input always produces identical output.
 *
 * Usage:
 *   import { simulate } from './simulate';
 *   const results = simulate(hourlyRecords);
 *   // or with a custom starting SOC:
 *   const results = simulate(hourlyRecords, 8.0); // start at 8 kWh
 */

import type { HourlyRecord, SimulationResult } from './types';

// ---------------------------------------------------------------------------
// Constants (project.md §10 — do not change)
// ---------------------------------------------------------------------------

const PANEL_CAPACITY_KW    = 5;      // kW  — total panel capacity
const TEMP_COEFFICIENT     = 0.004;  // /°C — efficiency loss per degree above 25 °C (c-Si)
const BATTERY_CAPACITY_KWH = 10;    // kWh — maximum battery capacity
const HOME_CONSUMPTION_KW  = 1.5;   // kW  — constant home consumption

// ---------------------------------------------------------------------------
// PV output formula (project.md §10)
// ---------------------------------------------------------------------------

/**
 * Calculates hourly PV output in kW.
 *
 * Formula:
 *   pv = (shortwave_radiation / 1000) * PANEL_CAPACITY_KW
 *        * (1 - TEMP_COEFFICIENT * max(0, temperature_2m - 25))
 *
 * - Dividing by 1000 converts W/m² to kW/m².
 * - 25 °C is the reference point; each degree above it reduces efficiency
 *   by TEMP_COEFFICIENT (max(0, ...) ensures no gain below 25 °C).
 */
function calcPvOutput(record: HourlyRecord): number {
  const irradiance_kw_m2 = record.shortwave_radiation / 1000;
  const temp_loss_factor  = 1 - TEMP_COEFFICIENT * Math.max(0, record.temperature_2m - 25);
  return irradiance_kw_m2 * PANEL_CAPACITY_KW * temp_loss_factor;
}

// ---------------------------------------------------------------------------
// Main simulation function
// ---------------------------------------------------------------------------

/**
 * Runs a battery simulation over hourly meteorological records.
 *
 * @param data           - Array of HourlyRecord (single city or mixed)
 * @param initialSocKwh  - Starting battery state of charge (kWh).
 *                         Defaults to 50% of capacity (5 kWh).
 *                         Override in tests to exercise charge/discharge scenarios.
 * @returns Array of SimulationResult — same length and order as the input.
 */
export function simulate(
  data: HourlyRecord[],
  initialSocKwh: number = BATTERY_CAPACITY_KWH / 2,
): SimulationResult[] {
  // Clamp initial SOC to physical bounds
  let socKwh = Math.min(Math.max(0, initialSocKwh), BATTERY_CAPACITY_KWH);

  const results: SimulationResult[] = [];

  for (const record of data) {
    const pv_output_kw   = calcPvOutput(record);
    const consumption_kw = HOME_CONSUMPTION_KW;

    // Positive net -> surplus production; negative -> deficit
    const net_kw = pv_output_kw - consumption_kw;

    let curtailed_kw = 0;
    let grid_draw_kw = 0;

    if (net_kw >= 0) {
      // ── CHARGE MODE: PV output exceeds consumption ───────────────────────
      const available_capacity = BATTERY_CAPACITY_KWH - socKwh;

      if (net_kw <= available_capacity) {
        // Surplus fits in the battery
        socKwh += net_kw;
      } else {
        // Battery full — excess energy is curtailed
        curtailed_kw = net_kw - available_capacity;
        socKwh = BATTERY_CAPACITY_KWH;
      }
    } else {
      // ── DISCHARGE MODE: Consumption exceeds PV output ────────────────────
      const deficit_kw = -net_kw; // make positive

      if (deficit_kw <= socKwh) {
        // Battery can cover the deficit
        socKwh -= deficit_kw;
      } else {
        // Battery depleted — remaining deficit is drawn from the grid
        grid_draw_kw = deficit_kw - socKwh;
        socKwh = 0;
      }
    }

    // Clean up any floating-point drift (e.g. 1e-15 instead of 0)
    socKwh = Math.min(Math.max(0, socKwh), BATTERY_CAPACITY_KWH);

    results.push({
      timestamp:        record.timestamp,
      location:         record.location,
      pv_output_kw:     parseFloat(pv_output_kw.toFixed(4)),
      consumption_kw,
      battery_soc_kwh:  parseFloat(socKwh.toFixed(4)),
      battery_soc_pct:  parseFloat(((socKwh / BATTERY_CAPACITY_KWH) * 100).toFixed(2)),
      curtailed_kw:     parseFloat(curtailed_kw.toFixed(4)),
      grid_draw_kw:     parseFloat(grid_draw_kw.toFixed(4)),
    });
  }

  return results;
}
