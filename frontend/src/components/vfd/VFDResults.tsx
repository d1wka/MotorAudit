import type { VFDResponse } from "@/lib/types";
import PowerVsSpeedChart from "./PowerVsSpeedChart";
import FormulaBox from "@/components/shared/FormulaBox";
import AIInsights from "@/components/shared/AIInsights";

interface Props { result: VFDResponse }

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-2xl font-bold text-slate-800 mt-1">{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function VFDResults({ result }: Props) {
  const { totals } = result;
  const savingsPct = ((totals.saved_kwh / totals.baseline_annual_kwh) * 100).toFixed(1);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Annual Energy Saved" value={`${totals.saved_kwh.toLocaleString()} kWh`} sub={`${savingsPct}% reduction`} />
        <KpiCard label="Annual Cost Saved" value={totals.saved_cost.toLocaleString(undefined, { minimumFractionDigits: 2 })} />
        <KpiCard label="Simple Payback" value={`${totals.payback_years.toFixed(2)} yr`} />
        <KpiCard label="Recommended VFD" value={`${result.recommended_vfd_kw} kW`} sub={`×${result.headroom_factor} headroom`} />
      </div>

      {/* Energy comparison */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Annual Energy Comparison</h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-xs text-slate-500">Baseline (throttling)</div>
            <div className="text-xl font-bold text-red-500 mt-1">{totals.baseline_annual_kwh.toLocaleString()} kWh</div>
          </div>
          <div className="flex items-center justify-center text-xl text-slate-300">to</div>
          <div>
            <div className="text-xs text-slate-500">With VFD</div>
            <div className="text-xl font-bold text-emerald-600 mt-1">{totals.vfd_annual_kwh.toLocaleString()} kWh</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Power vs speed chart */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Power vs Speed</h3>
          <PowerVsSpeedChart curve={result.power_vs_speed} />
        </div>

        {/* Profile table */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {["Speed", "Time%", "Baseline kW", "VFD kW", "Baseline kWh", "VFD kWh"].map((h) => (
                  <th key={h} className="px-3 py-2 text-left font-semibold text-slate-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {result.profile_analysis.map((pt, i) => (
                <tr key={i}>
                  <td className="px-3 py-2 font-mono">{(pt.speed_fraction * 100).toFixed(0)}%</td>
                  <td className="px-3 py-2 font-mono">{(pt.time_fraction * 100).toFixed(0)}%</td>
                  <td className="px-3 py-2 font-mono text-slate-500">{pt.baseline_power_kw.toFixed(1)}</td>
                  <td className="px-3 py-2 font-mono text-emerald-600">{pt.vfd_input_power_kw.toFixed(1)}</td>
                  <td className="px-3 py-2 font-mono text-slate-500">{pt.baseline_annual_kwh.toLocaleString()}</td>
                  <td className="px-3 py-2 font-mono text-emerald-600">{pt.vfd_annual_kwh.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AIInsights module="vfd" result={result} />

      <FormulaBox assumptions={result.assumptions} />
    </div>
  );
}
