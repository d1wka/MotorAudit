import type { PQResponse } from "@/lib/types";
import WaveformChart from "./WaveformChart";
import FFTSpectrumChart from "./FFTSpectrumChart";
import StatusTable from "./StatusTable";
import AIInsights from "@/components/shared/AIInsights";

interface Props { result: PQResponse }

function MetricCard({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-lg font-bold text-slate-800 mt-0.5">{value}{unit && <span className="text-sm font-normal text-slate-500 ml-1">{unit}</span>}</div>
    </div>
  );
}

export default function PQResults({ result }: Props) {
  const { channels, power_metrics: pm, phase_unbalance: ub } = result;
  const ia = channels.ia;
  const va = channels.va;

  return (
    <div className="space-y-5">
      {/* Signal info */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 flex gap-6 text-sm">
        <span className="text-slate-600">Duration: <strong>{result.duration_s.toFixed(3)} s</strong></span>
        <span className="text-slate-600">Fundamental: <strong>{result.actual_fundamental_hz.toFixed(2)} Hz</strong></span>
        {ia && <span className="text-slate-600">I_a RMS: <strong>{ia.rms.toFixed(3)} A</strong></span>}
        {va && <span className="text-slate-600">V_a RMS: <strong>{va.rms.toFixed(3)} V</strong></span>}
      </div>

      {/* Status table */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Status Flags</h3>
        <StatusTable flags={result.status_table} />
      </div>

      {/* Power metrics */}
      {pm && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-2">Power Metrics</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <MetricCard label="Active Power" value={pm.active_power_w.toFixed(1)} unit="W" />
            <MetricCard label="Apparent Power" value={pm.apparent_power_va.toFixed(1)} unit="VA" />
            <MetricCard label="Reactive Power" value={pm.reactive_power_var.toFixed(1)} unit="VAr" />
            <MetricCard label="Power Factor" value={pm.power_factor.toFixed(4)} />
            <MetricCard label="cos φ (disp.)" value={pm.displacement_cos_phi.toFixed(4)} />
          </div>
          {pm.capacitor_bank_kvar !== null && (
            <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-sm">
              PF correction: install approx. <strong>{pm.capacitor_bank_kvar.toFixed(2)} kVAr</strong> capacitor bank to reach target PF
            </div>
          )}
        </div>
      )}

      {/* Phase unbalance */}
      {ub && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-2">Phase Unbalance</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <MetricCard label="Current Unbalance" value={`${ub.current_unbalance_pct.toFixed(2)}%`} />
            {ub.voltage_unbalance_pct !== null && (
              <MetricCard label="Voltage Unbalance" value={`${ub.voltage_unbalance_pct.toFixed(2)}%`} />
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">Method: {ub.method}</p>
        </div>
      )}

      {/* THD per channel */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-2">Channel THD & Harmonics</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(channels).map(([ch, v]) => (
            <MetricCard key={ch} label={`${ch.toUpperCase()} THD`} value={`${v.thd_pct.toFixed(2)}%`} />
          ))}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Waveform</h3>
          <WaveformChart preview={result.waveform_preview} />
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">FFT Spectrum (0–2 kHz)</h3>
          <FFTSpectrumChart fft={result.fft_preview} fundamental={result.actual_fundamental_hz} />
        </div>
      </div>

      {/* Recommendations */}
      {result.recommendations.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Recommendations</h3>
          <ul className="space-y-2">
            {result.recommendations.map((r, i) => (
              <li key={i} className="flex gap-2 text-sm text-slate-700">
                <span className="text-amber-600 shrink-0 font-bold">-</span>
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      <AIInsights module="power_quality" result={result} />
    </div>
  );
}
