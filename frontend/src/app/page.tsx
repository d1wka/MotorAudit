"use client";

import { useAuditSession } from "@/hooks/useAuditSession";
import AuditSummaryPanel from "@/components/shared/AuditSummaryPanel";
import Link from "next/link";

const MODULES = [
  {
    href: "/replacement",
    title: "Motor Replacement",
    description: "Compare an existing motor against a higher-efficiency replacement. Computes annual savings, CO2 reduction, and simple payback period.",
    formula: "E = P_rated x LF / n(LF) x H",
  },
  {
    href: "/vfd",
    title: "VFD Sizing & Savings",
    description: "Estimate savings from installing a Variable Frequency Drive instead of throttling. Applies affinity laws for pumps and fans.",
    formula: "P_vfd(n) = P_rated x (n/n_rated)^3",
  },
  {
    href: "/power-quality",
    title: "Power Quality Analyzer",
    description: "Upload waveform data or select a preset signal. Computes THD, power factor, phase unbalance, and recommends mitigation.",
    formula: "THD = sqrt(sum(Ih^2)) / I1 x 100%",
  },
];

export default function DashboardPage() {
  const { replacementResult, vfdResult, pqResult } = useAuditSession();
  const hasAny = !!(replacementResult || vfdResult || pqResult);

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">MotorAudit Dashboard</h1>
        <p className="text-slate-500 mt-1 text-sm">
          Industrial motor energy audit platform — run each module, then export a consolidated report.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {MODULES.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="group bg-white rounded-xl border border-slate-200 p-5 hover:border-blue-400 hover:shadow-md transition-all"
          >
            <h2 className="font-semibold text-slate-800 group-hover:text-blue-700 transition-colors">
              {m.title}
            </h2>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">{m.description}</p>
            <code className="mt-3 block text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 text-slate-600 font-mono">
              {m.formula}
            </code>
          </Link>
        ))}
      </div>

      {hasAny && (
        <div>
          <h2 className="text-lg font-semibold text-slate-800 mb-3">Consolidated Audit Summary</h2>
          <AuditSummaryPanel />
        </div>
      )}

      {!hasAny && (
        <div className="text-center py-16 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
          <p className="font-medium">Run at least one module to see consolidated results here.</p>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 text-sm text-slate-600">
        <h3 className="font-semibold text-slate-700 mb-2">Engineering Basis</h3>
        <ul className="space-y-1 list-disc list-inside text-xs">
          <li>Motor efficiency data from IEC 60034-30-1:2014 Table 1 (4-pole, 50 Hz, IE1-IE4)</li>
          <li>Efficiency at operating load interpolated via quadratic fit through 4 IEC reference points</li>
          <li>VFD affinity law: P proportional to speed^3 (pump/fan) or P proportional to speed (constant torque)</li>
          <li>THD computed per IEEE 519-2022: sqrt(sum(Ih^2)) / I1 x 100%</li>
          <li>Power quality thresholds are advisory; not legal compliance certification</li>
          <li>All results are engineering estimates — see assumptions in each module</li>
        </ul>
      </div>
    </div>
  );
}
