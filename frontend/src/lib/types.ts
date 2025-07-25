// Mirrors backend Pydantic schemas exactly.

// ── AI Insights ───────────────────────────────────────────────────────────────
export interface AIInsightsResponse {
  insights: string;
  model: string;
}

export interface AIStatusResponse {
  configured: boolean;
  model: string | null;
}

// ── Motor DB ──────────────────────────────────────────────────────────────────
export interface MotorRecord {
  id: string;
  label: string;
  rated_power_kw: number;
  poles: number;
  ie_class: string;
  eta_100: number;
  eta_75: number;
  eta_50: number;
  eta_25: number;
}

// ── Module 1: Replacement ─────────────────────────────────────────────────────
export interface ExistingMotorInput {
  rated_power_kw: number;
  ie_class?: string;
  efficiency_override_pct?: number;
  load_factor: number;
}

export interface ReplacementMotorInput {
  ie_class?: string;
  efficiency_override_pct?: number;
  cost: number;
}

export interface ReplacementRequest {
  existing_motor: ExistingMotorInput;
  replacement_motor: ReplacementMotorInput;
  operating_hours_per_year: number;
  tariff_per_kwh: number;
  co2_factor_kg_per_kwh?: number;
  lifetime_years: number;
}

export interface MotorOperatingPoint {
  eta_at_load: number;
  input_power_kw: number;
  annual_kwh: number;
  annual_cost: number;
}

export interface SavingsSummary {
  annual_kwh: number;
  annual_cost: number;
  annual_co2_kg: number | null;
  payback_years: number;
  lifetime_net_savings: number;
}

export interface EfficiencyCurve {
  load_points: number[];
  existing_eta: number[];
  replacement_eta: number[];
}

export interface PaybackTimeline {
  years: number[];
  cumulative_savings: number[];
  net_position: number[];
}

export interface ReplacementResponse {
  existing: MotorOperatingPoint;
  replacement: MotorOperatingPoint;
  savings: SavingsSummary;
  efficiency_curve: EfficiencyCurve;
  payback_timeline: PaybackTimeline;
  assumptions: string[];
}

// ── Module 2: VFD ─────────────────────────────────────────────────────────────
export interface LoadPoint {
  speed_fraction: number;
  time_fraction: number;
}

export interface VFDRequest {
  motor_power_kw: number;
  load_type: "pump" | "fan" | "conveyor";
  motor_efficiency: number;
  vfd_efficiency: number;
  load_profile: LoadPoint[];
  operating_hours_per_year: number;
  tariff_per_kwh: number;
  vfd_cost: number;
  headroom_factor: number;
}

export interface ProfilePoint {
  speed_fraction: number;
  time_fraction: number;
  baseline_power_kw: number;
  vfd_input_power_kw: number;
  baseline_annual_kwh: number;
  vfd_annual_kwh: number;
}

export interface VFDTotals {
  baseline_annual_kwh: number;
  vfd_annual_kwh: number;
  saved_kwh: number;
  saved_cost: number;
  payback_years: number;
}

export interface PowerVsSpeedCurve {
  speed_fractions: number[];
  baseline_fraction: number[];
  vfd_fraction: number[];
}

export interface VFDResponse {
  recommended_vfd_kw: number;
  headroom_factor: number;
  profile_analysis: ProfilePoint[];
  totals: VFDTotals;
  power_vs_speed: PowerVsSpeedCurve;
  assumptions: string[];
}

// ── Module 3: Power Quality ───────────────────────────────────────────────────
export interface PQThresholds {
  thd_voltage_pct: number;
  thd_current_pct: number;
  power_factor_min: number;
  current_unbalance_pct: number;
}

export type PresetName =
  | "clean_sinusoid"
  | "vfd_harmonics"
  | "unbalanced_3phase"
  | "low_power_factor";

export interface PQRequest {
  source: "json" | "preset";
  preset_name?: PresetName;
  sample_rate_hz?: number;
  fundamental_freq_hz?: number;
  thresholds?: Partial<PQThresholds>;
}

export interface HarmonicComponent {
  freq_hz: number;
  amplitude_rms: number;
}

export interface ChannelAnalysis {
  rms: number;
  peak: number;
  thd_pct: number;
  harmonics: Record<string, HarmonicComponent>;
}

export interface PowerMetrics {
  active_power_w: number;
  apparent_power_va: number;
  reactive_power_var: number;
  power_factor: number;
  displacement_cos_phi: number;
  capacitor_bank_kvar: number | null;
}

export interface PhaseUnbalance {
  current_unbalance_pct: number;
  voltage_unbalance_pct: number | null;
  method: string;
}

export type StatusValue = "PASS" | "WARN" | "FAIL";

export interface StatusFlag {
  metric: string;
  value: number;
  limit: number;
  unit: string;
  status: StatusValue;
}

export interface WaveformPreview {
  time_ms: number[];
  ia: number[] | null;
  ib: number[] | null;
  ic: number[] | null;
  va: number[] | null;
}

export interface FFTPreview {
  freq_hz: number[];
  ia_magnitude: number[] | null;
  va_magnitude: number[] | null;
}

export interface PQResponse {
  duration_s: number;
  actual_fundamental_hz: number;
  channels: Record<string, ChannelAnalysis>;
  power_metrics: PowerMetrics | null;
  phase_unbalance: PhaseUnbalance | null;
  status_table: StatusFlag[];
  recommendations: string[];
  waveform_preview: WaveformPreview;
  fft_preview: FFTPreview;
}

// ── Report ────────────────────────────────────────────────────────────────────
export interface ModuleBreakdown {
  module: string;
  kwh_saved: number;
  cost_saved: number;
  investment: number;
}

export interface ReportSummary {
  total_annual_kwh_saved: number;
  total_annual_cost_saved: number;
  total_co2_kg_reduced: number | null;
  total_investment: number;
  blended_payback_years: number;
  breakdown: ModuleBreakdown[];
  power_quality_flags: number;
  disclaimer: string;
}

export interface ReportRequest {
  site_name: string;
  analyst_name: string;
  currency_symbol: string;
  replacement_result?: ReplacementResponse;
  vfd_result?: VFDResponse;
  pq_result?: PQResponse;
}
