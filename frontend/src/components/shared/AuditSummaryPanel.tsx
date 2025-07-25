"use client";

import { useEffect, useState } from "react";
import { useAuditSession } from "@/hooks/useAuditSession";
import { api } from "@/lib/api";
import type { ReportSummary } from "@/lib/types";

export default function AuditSummaryPanel() {
  const { siteName, analystName, currencySymbol, replacementResult, vfdResult, pqResult } =
    useAuditSession();
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!replacementResult && !vfdResult && !pqResult) {
      setSummary(null);
      return;
    }
    setLoading(true);
    api.report
      .summary({
        site_name: siteName,
        analyst_name: analystName,
        currency_symbol: currencySymbol,
        replacement_result: replacementResult ?? undefined,
        vfd_result: vfdResult ?? undefined,
        pq_result: pqResult ?? undefined,
      })
      .then(setSummary)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [replacementResult, vfdResult, pqResult, siteName, analystName, currencySymbol]);

  if (loading) return <div className="text-sm text-slate-400 animate-pulse">Computing consolidated summary…</div>;
  if (!summary) return null;

  const sym = currencySymbol;

  const Stat = ({ label, value }: { label: string; value: string }) => (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className="text-xl font-bold text-slate-800">{value}</div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Annual Energy Saved" value={`${summary.total_annual_kwh_saved.toLocaleString()} kWh`} />
        <Stat label={`Annual Cost Saved`} value={`${sym}${summary.total_annual_cost_saved.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} />
        <Stat label="Total Investment" value={`${sym}${summary.total_investment.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} />
        <Stat label="Blended Payback" value={`${summary.blended_payback_years.toFixed(2)} yrs`} />
      </div>

      {summary.total_co2_kg_reduced && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-sm">
          CO2 reduction: <span className="font-semibold">{summary.total_co2_kg_reduced.toLocaleString()} kg / yr</span>
        </div>
      )}

      {summary.power_quality_flags > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm">
          Power quality: <span className="font-semibold">{summary.power_quality_flags} flag(s)</span> require attention
        </div>
      )}

      {summary.breakdown.length > 0 && (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-100">
              <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600 rounded-tl">Measure</th>
              <th className="text-right px-3 py-2 text-xs font-semibold text-slate-600">kWh saved / yr</th>
              <th className="text-right px-3 py-2 text-xs font-semibold text-slate-600">Cost saved / yr</th>
              <th className="text-right px-3 py-2 text-xs font-semibold text-slate-600 rounded-tr">Investment</th>
            </tr>
          </thead>
          <tbody>
            {summary.breakdown.map((b, i) => (
              <tr key={i} className="border-t border-slate-100">
                <td className="px-3 py-2 text-slate-700">{b.module}</td>
                <td className="px-3 py-2 text-right text-slate-700">{b.kwh_saved.toLocaleString()}</td>
                <td className="px-3 py-2 text-right text-slate-700">{sym}{b.cost_saved.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="px-3 py-2 text-right text-slate-700">{sym}{b.investment.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="text-xs text-slate-400 italic">{summary.disclaimer}</p>
    </div>
  );
}
