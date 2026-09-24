/**
 * Step 6: Vitest tests for simulate.ts
 *
 * Each test calls simulate() with a specific initial SOC so that
 * charge, discharge, curtail, and grid-draw scenarios are independent
 * and fully deterministic.
 */

import { describe, it, expect } from 'vitest';
import { simulate } from '../src/simulate';
import type { HourlyRecord } from '../src/types';

// ---------------------------------------------------------------------------
// Test helper: minimal HourlyRecord factory
// ---------------------------------------------------------------------------

function makeRecord(
  shortwave_radiation: number,
  temperature_2m: number,
  options: {
    timestamp?: string;
    location?: 'Berlin' | 'Madrid' | 'Lisbon';
  } = {},
): HourlyRecord {
  return {
    timestamp: options.timestamp ?? '2026-09-20T12:00Z',
    location: options.location ?? 'Berlin',
    temperature_2m,
    shortwave_radiation,
  };
}

// ---------------------------------------------------------------------------
// 1. Basic smoke tests
// ---------------------------------------------------------------------------

describe('simulate — basic', () => {
  it('returns an empty array for empty input', () => {
    expect(simulate([])).toEqual([]);
  });

  it('output length matches input length', () => {
    const data = [
      makeRecord(0, 15),
      makeRecord(0, 15),
      makeRecord(500, 20),
    ];
    expect(simulate(data)).toHaveLength(3);
  });

  it('output location matches input location', () => {
    const result = simulate([makeRecord(0, 20, { location: 'Madrid' })]);
    expect(result[0].location).toBe('Madrid');
  });

  it('all numeric fields are typeof number — not string', () => {
    // Guards against parseFloat(x.toFixed()) accidentally producing strings.
    // If any field were a string, Recharts would silently misrender the chart.
    const [result] = simulate([makeRecord(500, 30)]);
    expect(typeof result.pv_output_kw).toBe('number');
    expect(typeof result.consumption_kw).toBe('number');
    expect(typeof result.battery_soc_kwh).toBe('number');
    expect(typeof result.battery_soc_pct).toBe('number');
    expect(typeof result.curtailed_kw).toBe('number');
    expect(typeof result.grid_draw_kw).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// 2. Nighttime discharge — Scenario 1
//    shortwave_radiation=0, temp=15°C, initialSoc=5 kWh
//    Expected: battery discharges by HOME_CONSUMPTION_KW (1.5 kWh) each hour
// ---------------------------------------------------------------------------

describe('simulate — nighttime discharge (Scenario 1)', () => {
  const INITIAL_SOC = 5; // kWh

  it('PV output is 0 when there is no radiation', () => {
    const [result] = simulate([makeRecord(0, 15)], INITIAL_SOC);
    expect(result.pv_output_kw).toBe(0);
  });

  it('battery discharges by 1.5 kWh in one hour', () => {
    const [result] = simulate([makeRecord(0, 15)], INITIAL_SOC);
    expect(result.battery_soc_kwh).toBe(3.5);  // 5 - 1.5
  });

  it('battery state of charge percentage is calculated correctly', () => {
    const [result] = simulate([makeRecord(0, 15)], INITIAL_SOC);
    expect(result.battery_soc_pct).toBe(35);    // 3.5 / 10 * 100
  });

  it('curtailed_kw is zero (no charging at night)', () => {
    const [result] = simulate([makeRecord(0, 15)], INITIAL_SOC);
    expect(result.curtailed_kw).toBe(0);
  });

  it('grid_draw_kw is zero (battery covers the deficit)', () => {
    const [result] = simulate([makeRecord(0, 15)], INITIAL_SOC);
    expect(result.grid_draw_kw).toBe(0);
  });

  it('3-hour night — SOC decreases step by step', () => {
    const hours = [makeRecord(0, 15), makeRecord(0, 15), makeRecord(0, 15)];
    const results = simulate(hours, INITIAL_SOC);
    expect(results[0].battery_soc_kwh).toBe(3.5);  // 5   - 1.5
    expect(results[1].battery_soc_kwh).toBe(2.0);  // 3.5 - 1.5
    expect(results[2].battery_soc_kwh).toBe(0.5);  // 2.0 - 1.5
  });
});

// ---------------------------------------------------------------------------
// 3. Full battery + solar production -> curtailed — Scenario 2
//    shortwave_radiation=800 W/m², temp=25°C, initialSoc=10 kWh (full)
//    pv = (800/1000) * 5 * 1.0 = 4.0 kW
//    net = 4.0 - 1.5 = +2.5 kW (surplus)
//    available_capacity = 10 - 10 = 0 -> curtailed = 2.5 kW
// ---------------------------------------------------------------------------

describe('simulate — full battery + solar -> curtailed (Scenario 2)', () => {
  const INITIAL_SOC = 10; // kWh — fully charged

  it('PV output is 4.0 kW at 800 W/m² and 25°C', () => {
    const [result] = simulate([makeRecord(800, 25)], INITIAL_SOC);
    expect(result.pv_output_kw).toBe(4.0);
  });

  it('battery SOC does not exceed 10 kWh', () => {
    const [result] = simulate([makeRecord(800, 25)], INITIAL_SOC);
    expect(result.battery_soc_kwh).toBe(10);
    expect(result.battery_soc_pct).toBe(100);
  });

  it('excess energy is reported in curtailed_kw', () => {
    // net = 4.0 - 1.5 = 2.5, available = 0 -> curtailed = 2.5
    const [result] = simulate([makeRecord(800, 25)], INITIAL_SOC);
    expect(result.curtailed_kw).toBeCloseTo(2.5, 4);
  });

  it('grid_draw_kw is zero', () => {
    const [result] = simulate([makeRecord(800, 25)], INITIAL_SOC);
    expect(result.grid_draw_kw).toBe(0);
  });

  it('partially full battery — charges until full, then curtails', () => {
    // SOC = 8 kWh, net = +2.5, available = 2 -> 0.5 kWh curtailed
    const [result] = simulate([makeRecord(800, 25)], 8);
    expect(result.battery_soc_kwh).toBe(10);
    expect(result.curtailed_kw).toBeCloseTo(0.5, 4);  // 2.5 - 2.0 = 0.5
  });

  it('boundary: net surplus exactly fills remaining capacity — no curtailment', () => {
    // SOC = 7.5 kWh, net = +2.5, available = 2.5 -> perfect fit, curtailed = 0
    const [result] = simulate([makeRecord(800, 25)], 7.5);
    expect(result.battery_soc_kwh).toBe(10);
    expect(result.curtailed_kw).toBe(0);
  });

  it('boundary: net surplus just exceeds remaining capacity — minimal curtailment', () => {
    // SOC = 9.9 kWh, net = +2.5, available = 0.1 -> curtailed = 2.4
    const [result] = simulate([makeRecord(800, 25)], 9.9);
    expect(result.battery_soc_kwh).toBe(10);
    expect(result.curtailed_kw).toBeCloseTo(2.4, 4);  // 2.5 - 0.1
  });
});

// ---------------------------------------------------------------------------
// 4. Empty battery + consumption > PV -> grid draw — Scenario 3
//    shortwave_radiation=0, temp=15°C, initialSoc=0 kWh
//    pv = 0, net = -1.5, battery empty -> grid_draw = 1.5 kW
// ---------------------------------------------------------------------------

describe('simulate — empty battery + deficit -> grid draw (Scenario 3)', () => {
  const INITIAL_SOC = 0; // kWh — fully depleted

  it('grid_draw_kw covers the full deficit', () => {
    const [result] = simulate([makeRecord(0, 15)], INITIAL_SOC);
    expect(result.grid_draw_kw).toBeCloseTo(1.5, 4);
  });

  it('battery SOC stays at 0 and does not go negative', () => {
    const [result] = simulate([makeRecord(0, 15)], INITIAL_SOC);
    expect(result.battery_soc_kwh).toBe(0);
    expect(result.battery_soc_pct).toBe(0);
  });

  it('curtailed_kw is zero', () => {
    const [result] = simulate([makeRecord(0, 15)], INITIAL_SOC);
    expect(result.curtailed_kw).toBe(0);
  });

  it('partial battery — battery first, then grid covers the rest', () => {
    // SOC = 0.5 kWh, deficit = 1.5 kW
    // Battery covers 0.5 kWh, remaining 1.0 kW drawn from grid
    const [result] = simulate([makeRecord(0, 15)], 0.5);
    expect(result.battery_soc_kwh).toBe(0);
    expect(result.grid_draw_kw).toBeCloseTo(1.0, 4);  // 1.5 - 0.5
  });
});

// ---------------------------------------------------------------------------
// 5. Temperature efficiency loss — Scenario 4
//    Formula: pv = (rad/1000) * 5 * (1 - 0.004 * max(0, temp - 25))
// ---------------------------------------------------------------------------

describe('simulate — temperature efficiency loss (Scenario 4)', () => {
  it('full efficiency at 25°C reference point (5.0 kW)', () => {
    // pv = (1000/1000) * 5 * (1 - 0.004 * 0) = 5.0
    const [result] = simulate([makeRecord(1000, 25)], 0);
    expect(result.pv_output_kw).toBeCloseTo(5.0, 4);
  });

  it('4% efficiency loss at 35°C (4.8 kW)', () => {
    // pv = (1000/1000) * 5 * (1 - 0.004 * 10) = 5 * 0.96 = 4.8
    const [result] = simulate([makeRecord(1000, 35)], 0);
    expect(result.pv_output_kw).toBeCloseTo(4.8, 4);
  });

  it('no efficiency loss below 25°C — max(0, negative) = 0', () => {
    // pv = (1000/1000) * 5 * (1 - 0.004 * max(0, 10-25)) = 5 * 1.0 = 5.0
    const [result] = simulate([makeRecord(1000, 10)], 0);
    expect(result.pv_output_kw).toBeCloseTo(5.0, 4);
  });

  it('8% efficiency loss at 45°C (4.6 kW)', () => {
    // pv = (1000/1000) * 5 * (1 - 0.004 * 20) = 5 * 0.92 = 4.6
    const [result] = simulate([makeRecord(1000, 45)], 0);
    expect(result.pv_output_kw).toBeCloseTo(4.6, 4);
  });

  it('curtailed_kw is correct with high temperature and a full battery', () => {
    // 35°C, soc=10 -> pv=4.8, net=4.8-1.5=3.3, curtailed=3.3
    const [result] = simulate([makeRecord(1000, 35)], 10);
    expect(result.curtailed_kw).toBeCloseTo(3.3, 4);
    expect(result.battery_soc_kwh).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// 6. Multi-hour state accumulation
// ---------------------------------------------------------------------------

describe('simulate — multi-hour state accumulation', () => {
  it('SOC rises during the day and falls at night', () => {
    const hours: HourlyRecord[] = [
      makeRecord(600, 22, { timestamp: '2026-09-20T10:00Z' }), // daytime
      makeRecord(600, 22, { timestamp: '2026-09-20T11:00Z' }), // daytime
      makeRecord(0,   15, { timestamp: '2026-09-20T22:00Z' }), // nighttime
      makeRecord(0,   15, { timestamp: '2026-09-20T23:00Z' }), // nighttime
    ];
    const results = simulate(hours, 3); // start at 3 kWh

    // Daytime: pv = (600/1000)*5*1 = 3.0, net = 3.0-1.5 = +1.5 -> charge
    expect(results[0].battery_soc_kwh).toBeCloseTo(4.5, 3);
    expect(results[1].battery_soc_kwh).toBeCloseTo(6.0, 3);

    // Nighttime: net = -1.5 -> discharge
    expect(results[2].battery_soc_kwh).toBeCloseTo(4.5, 3);
    expect(results[3].battery_soc_kwh).toBeCloseTo(3.0, 3);
  });
});
