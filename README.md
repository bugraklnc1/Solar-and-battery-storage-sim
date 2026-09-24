# Solar & Battery Storage Simulator 

![CI Pipeline](https://github.com/bugraklnc1/Solar-and-battery-storage-sim/actions/workflows/ci.yml/badge.svg)
![Python](https://img.shields.io/badge/Python-3.10+-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)
![React](https://img.shields.io/badge/React-18.x-61DAFB.svg)

An end-to-end data engineering and software simulation project modeling the core challenge of the energy transition: **solar intermittency and load shifting**. 

This project fetches real-world meteorological data, cleans and validates it through a Python pipeline, and runs a pure-TypeScript simulation to demonstrate how a Battery Energy Storage System (BESS) can mitigate the [Duck Curve](https://en.wikipedia.org/wiki/Duck_curve) effect by shifting daytime solar overproduction to cover evening consumption peaks.

## Key Features

* **Real-world Data Pipeline (Python):** Fetches 7-day historical hourly weather data for Berlin, Istanbul, and Lisbon via the Open-Meteo API.
* **Data Cleansing & Validation:** Uses linear interpolation for missing data and strictly validates physical constraints (e.g., radiation ≥ 0, temperature bounds) using **Pydantic**.
* **Dynamic Simulation Engine (TypeScript):** Calculates theoretical PV generation (accounting for c-Si temperature efficiency losses) and manages a 10 kWh battery charge/discharge logic against a dynamic 24-hour home consumption profile.
* **Interactive UI (React):** A sleek, responsive dashboard built with Tailwind CSS v4 and Recharts. Visualizes the exact moment the battery takes over when the sun goes down.
* **CI/CD Integration:** Automated testing pipeline using GitHub Actions, ensuring both Python (`pytest`) and TypeScript (`Vitest`) codebases remain stable.

## Architecture

The project strictly separates data engineering (Backend) from business logic and visualization (Frontend), communicating via a typed JSON contract.

```text
[Open-Meteo API] 
       │
       ▼
(1) Python: fetch_weather.py   --> Fetches raw API data
       │
       ▼
(2) Python: clean_data.py      --> Interpolates missing values
       │
       ▼
(3) Python: models.py          --> Validates via Pydantic
       │
       ▼
[ output/solar_data.json ]     <-- Shared Data Contract
       │
       ▼
(4) TS: simulate.ts            --> Runs PV + Battery BESS physics
       │
       ▼
(5) React: App.tsx             --> Renders Dashboard & Charts
```

## Tech Stack

**Data Pipeline:** Python, Requests, Pydantic, Pytest  
**Simulation & UI:** TypeScript, React, Vite, Tailwind CSS v4, Recharts, Vitest  
**DevOps:** Git, GitHub Actions (CI)  

## Getting Started

### 1. Data Pipeline (Python)
To generate fresh weather data for the last 7 days:

```bash
cd data-pipeline
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Run the pipeline (fetches data, validates, and updates the simulator's JSON)
python fetch_weather.py
python clean_data.py
cp output/solar_data.json ../simulator/public/
```

### 2. Simulator UI (React / TypeScript)
To run the interactive dashboard:

```bash
cd simulator
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

## Testing

The project maintains high quality through automated testing on both sides of the stack.

**Run Python Tests (Data Pipeline):**
```bash
cd data-pipeline
pytest tests/
```
*Tests edge cases like negative radiation, extreme temperatures, and missing data interpolation.*

**Run TypeScript Tests (Simulation Engine):**
```bash
cd simulator
npm run test
```
*Tests deterministic battery behavior: nighttime discharging, daytime charging, curtailment (waste) logic, grid-draw fallbacks, and temperature efficiency losses.*

## Known Limitations & Assumptions

* **Temperature Model:** Uses ambient air temperature as a proxy for panel surface temperature (a full model would use NOCT-based cell temperature estimation).
* **Efficiency Model:** Applies temperature efficiency loss only above 25°C (conservative simplification, no gain modeled below).
* **System Sizing:** The default 5 kW panel / 10 kWh battery configuration is undersized relative to the simulated household load, resulting in significant grid dependency. This is intentional to visually demonstrate the charging/discharging sizing trade-off on the UI, rather than a bug.

## Why this project? 

The transition to renewable energy isn't just about building more solar panels; it's about **matching supply with demand**. Solar panels only produce electricity during the day, but residential demand peaks in the morning and evening. 

This project simulates a **Battery Energy Storage System (BESS)**. By visualizing the "Charge Mode" during the day and "Discharge Mode" at night, it practically demonstrates **Load Shifting** — the exact technology required to stabilize modern green energy grids.

## License

This project is licensed under the MIT License.
