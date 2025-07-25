import type { ReplacementResponse } from "@/lib/types";
import EfficiencyVsLoadChart from "./EfficiencyVsLoadChart";
import PaybackTimelineChart from "./PaybackTimelineChart";
import FormulaBox from "@/components/shared/FormulaBox";
import AIInsights from "@/components/shared/AIInsights";

interface Props { result: ReplacementResponse }

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-2xl font-bold text-slate-800 mt-1">{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function ReplacementResults({ result }: Props) {
  const { existing, replacement, savings } = result;
  const etaDiff = ((replacement.eta_at_load - existing.eta_at_load) * 100).toFixed(2);

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Annual Energy Saved" value={`${savings.annual_kwh.toLocaleString()} kWh`} sub="per year" />
        <KpiCard label="Annual Cost Saved" value={`${savings.annual_cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} sub="per year" />
        <KpiCard label="Simple Payback" value={`${savings.payback_years.toFixed(2)} yr`} />
        <KpiCard
          label="CO₂ Reduction"
          value={savings.annual_co2_kg ? `${savings.annual_co2_kg.toLocaleString()} kg` : "—"}
          sub="per year"
        />
      </div>

      {/* Comparison table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600">Parameter</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600">Existing Motor</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600">Replacement Motor</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-emerald-700">Δ Improvement</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <tr>
              <td className="px-4 py-3 text-slate-600">Efficiency at load</td>
              <td className="px-4 py-3 text-right font-mono">{(existing.eta_at_load * 100).toFixed(2)}%</td>
              <td className="px-4 py-3 text-right font-mono">{(replacement.eta_at_load * 100).toFixed(2)}%</td>
              <td className="px-4 py-3 text-right font-mono text-emerald-600">+{etaDiff}%</td>
            </tr>
            <tr>
              <td className="px-4 py-3 text-slate-600">Electrical input power</td>
              <td className="px-4 py-3 text-right font-mono">{existing.input_power_kw.toFixed(2)} kW</td>
              <td className="px-4 py-3 text-right font-mono">{replacement.input_power_kw.toFixed(2)} kW</td>
              <td className="px-4 py-3 text-right font-mono text-emerald-600">−{(existing.input_power_kw - replacement.input_power_kw).toFixed(2)} kW</td>
            </tr>
            <tr>
              <td className="px-4 py-3 text-slate-600">Annual energy</td>
              <td className="px-4 py-3 text-right font-mono">{existing.annual_kwh.toLocaleString()} kWh</td>
              <td className="px-4 py-3 text-right font-mono">{replacement.annual_kwh.toLocaleString()} kWh</td>
              <td className="px-4 py-3 text-right font-mono text-emerald-600">−{savings.annual_kwh.toLocaleString()} kWh</td>
            </tr>
            <tr>
              <td className="px-4 py-3 text-slate-600">Annual energy cost</td>
              <td className="px-4 py-3 text-right font-mono">{existing.annual_cost.toFixed(2)}</td>
              <td className="px-4 py-3 text-right font-mono">{replacement.annual_cost.toFixed(2)}</td>
              <td className="px-4 py-3 text-right font-mono text-emerald-600">−{savings.annual_cost.toFixed(2)}</td>
            </tr>
            <tr className="bg-slate-50">
              <td className="px-4 py-3 text-slate-700 font-medium">Lifetime net savings</td>
              <td className="px-4 py-3" />
              <td className="px-4 py-3" />
              <td className="px-4 py-3 text-right font-bold text-emerald-700">{savings.lifetime_net_savings.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Efficiency vs Load Factor</h3>
          <EfficiencyVsLoadChart curve={result.efficiency_curve} />
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Payback Timeline (cumulative)</h3>
          <PaybackTimelineChart timeline={result.payback_timeline} />
        </div>
      </div>

      <AIInsights module="replacement" result={result} />

      <FormulaBox assumptions={result.assumptions} />
    </div>
  );
}
