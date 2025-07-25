# MotorAudit

Energy audit platform for industrial electric motors. Three engineering modules under one UI, sharing a common motor database and producing a consolidated PDF report.

---

## Quick Start

### Backend

```bash
cd motoraudit/backend
python3 -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
# API docs → http://localhost:8000/docs
```

### Frontend

```bash
cd motoraudit/frontend
npm install
cp .env.example .env.local
npm run dev
# App → http://localhost:3000
```

### Tests

```bash
cd motoraudit/backend
pytest -v
```

---

## Engineering Background

### Module 1 — Motor Replacement & Payback

**Why it matters**: A motor that runs 6 000 h/yr at 75 % load for 20 years consumes ~10 times its own purchase price in electricity. Moving from IE1 to IE3 class typically saves 2–4 % of input energy at the operating load point — small percentages on large machines add up quickly.

**Key formula**:
```
E_annual = (P_rated × LF) / η(LF) × H       [kWh/yr]
```
- `P_rated` — rated shaft output power (kW)
- `LF` — load factor (fraction of rated shaft load)
- `η(LF)` — motor efficiency at operating load factor, interpolated from IEC 60034-30-1:2014 Table 1 via a quadratic polynomial fit through the four standard load points (25 %, 50 %, 75 %, 100 %)
- `H` — annual operating hours

**Payback**:
```
Payback = C_motor / (ΔE × tariff)            [years]
```

**Data source**: IEC 60034-30-1:2014 Table 1 minimum efficiency values, 4-pole 50 Hz motors, IE1–IE4, 4–110 kW. Note: these are minimum guaranteed values; name-plate efficiencies of specific models are typically 1–2 % higher.

---

### Module 2 — VFD Sizing & Savings

**Why it matters**: Pump and fan systems are the largest single category of industrial electricity use. Throttling/damping keeps the motor at full speed and wastes the excess energy in a restriction. A VFD reduces motor speed to match actual flow demand — and because shaft power follows the **affinity law** (power ∝ speed³), running at 70 % speed uses only 34 % of full-speed power.

**Affinity law (pump/fan)**:
```
P_shaft(n) = P_rated × (n / n_rated)³
```

**Constant-torque (conveyor)**:
```
P_shaft(n) = P_rated × (n / n_rated)
```

**Electrical input via VFD**:
```
P_elec = P_shaft / (η_motor × η_VFD)
```

**Baseline (throttling)**: The motor electrical input is modelled as constant at `P_rated / η_motor` regardless of flow point. This is conservative (some motors draw slightly less at part-slip) and the standard engineering assumption for VFD savings calculations.

**VFD rating**: Recommended at `1.10 × P_motor` (10 % headroom) to cover starting torque boost and thermal derating.

---

### Module 3 — Power Quality Analyzer

**Why it matters**: Non-linear loads (VFDs, rectifiers, UPS) inject harmonic currents that increase I²R losses, overheat motors and transformers, and cause nuisance tripping. Voltage unbalance > 2 % reduces motor efficiency and life. Low power factor increases apparent current and utility penalty charges.

**FFT and THD**:
```
THD = √(Σ_{h=2}^{N} I_h²) / I_1 × 100 %     (IEEE 519-2022)
```
where `I_h` is the RMS amplitude of the h-th harmonic extracted from a Hanning-windowed FFT.

**True RMS**:
```
X_rms = √((1/N) Σ xᵢ²)
```

**Power factor and displacement PF**:
```
PF   = P / S = mean(v·i) / (V_rms × I_rms)
cos φ = phase angle between fundamental voltage and current phasors
```
`PF < cos φ` when harmonics are present (distortion power factor).

**Reactive power correction**:
```
Q_corr = P × (tan φ_actual − tan φ_target)    [kVAr]
```

**Phase unbalance (NEMA MG-1)**:
```
UB% = max(|I_x − Ī|) / Ī × 100
```

**Thresholds**: Configurable per request. Default values approximate IEEE 519-2022 general system limits. Results are advisory — not legal compliance certification.

**Preset signals**:
| Preset | Description |
|--------|-------------|
| `clean_sinusoid` | Pure 50 Hz, 42 A / 230 V — zero-THD reference |
| `vfd_harmonics` | 6-pulse VFD current: 5th (14 %), 7th (9 %), 11th (5 %), 13th (3 %) |
| `unbalanced_3phase` | 3-phase with phase B −8 %, phase C +6 % unbalance |
| `low_power_factor` | Single-phase, 37° lag → PF ≈ 0.80 |

---

## Project Structure

```
motoraudit/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app entry point
│   │   ├── config.py            # Settings (pydantic-settings)
│   │   ├── db/seed.py           # IEC motor efficiency table
│   │   ├── schemas/             # Pydantic request/response models
│   │   ├── core/
│   │   │   ├── motor_db.py      # Efficiency interpolation
│   │   │   ├── replacement_calc.py
│   │   │   ├── vfd_calc.py
│   │   │   ├── dsp.py           # FFT, THD, PF, unbalance
│   │   │   └── report_gen.py    # ReportLab PDF generator
│   │   ├── api/                 # FastAPI routers
│   │   └── tests/               # pytest unit tests
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── app/                 # Next.js App Router pages
│   │   ├── components/          # Per-module React components + charts
│   │   ├── lib/                 # TypeScript types, API client
│   │   └── hooks/               # useAuditSession context
│   └── package.json
└── README.md
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/motors` | List seeded IEC motors |
| GET | `/api/replacement/demo` | Demo preset inputs |
| POST | `/api/replacement/calculate` | Module 1 calculation |
| GET | `/api/vfd/demo` | Demo preset inputs |
| POST | `/api/vfd/calculate` | Module 2 calculation |
| GET | `/api/power-quality/presets` | Available preset names |
| POST | `/api/power-quality/analyze` | Module 3 JSON analysis |
| POST | `/api/power-quality/upload` | Module 3 CSV upload |
| POST | `/api/report/summary` | Consolidated JSON summary |
| POST | `/api/report/pdf` | PDF report download |

Full interactive docs at `http://localhost:8000/docs` (Swagger UI).

---

## Example Results (Demo Preset)

**Module 1** — 37 kW IE1 → IE3, 75 % load, 6 000 h/yr, $0.12/kWh:
- Annual energy saved: **~8 280 kWh**
- Annual cost saved: **~$994**
- Simple payback: **~4.2 years** (at $4 200 motor cost)
- CO₂ reduction: **~1 929 kg/yr** (at 0.233 kg/kWh)

**Module 2** — 55 kW pump VFD, load profile 10/30/40/20 % at 100/85/70/50 % speed, 7 000 h/yr:
- Baseline: **~415 800 kWh/yr** (throttling)
- VFD: **~246 000 kWh/yr**
- Saved: **~170 000 kWh/yr** (~41 % reduction)
- Payback: **~0.4 years** at $7 500 VFD cost

**Module 3** — VFD harmonics preset:
- Current THD: **~18 %** → FAIL (> 8 % limit)
- Voltage THD: **~1 %** → PASS
- Power factor: **0.999** → PASS (clean voltage, no reactive component in demo)
- Recommendation: passive harmonic filter for 5th + 7th harmonics

---

## Assumptions & Limitations

- Motor efficiency data is from IEC 60034-30-1:2014 minimum values (4-pole, 50 Hz). Real motors are typically 1–2 % better.
- Efficiency interpolation uses a quadratic polynomial through 4 IEC load points. Accuracy degrades outside the 25–100 % range.
- VFD savings assume a quadratic system curve (resistance-dominated piping). A static-head-dominated system will show lower savings.
- Power quality thresholds are advisory. No legal or regulatory compliance certification is implied.
- All financial calculations are undiscounted (no NPV/IRR). Add a discount rate for rigorous investment analysis.
- Results labelled as **engineering estimates** throughout the UI and reports.
