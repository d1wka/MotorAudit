"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { VFDRequest, LoadPoint } from "@/lib/types";

interface Props {
  onCalculate: (req: VFDRequest) => void;
  loading: boolean;
}

const DEFAULT: VFDRequest = {
  motor_power_kw: 55,
  load_type: "pump",
  motor_efficiency: 0.946,
  vfd_efficiency: 0.97,
  load_profile: [
    { speed_fraction: 1.00, time_fraction: 0.10 },
    { speed_fraction: 0.85, time_fraction: 0.30 },
    { speed_fraction: 0.70, time_fraction: 0.40 },
    { speed_fraction: 0.50, time_fraction: 0.20 },
  ],
  operating_hours_per_year: 7000,
  tariff_per_kwh: 0.12,
  vfd_cost: 7500,
  headroom_factor: 1.10,
};

function Field({ label, unit, children }: { label: string; unit?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">
        {label}{unit && <span className="text-slate-400 ml-1">({unit})</span>}
      </label>
      {children}
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />;
}

export default function VFDForm({ onCalculate, loading }: Props) {
  const [form, setForm] = useState<VFDRequest>(DEFAULT);

  const loadDemo = async () => {
    try {
      setForm(await api.vfd.demo());
    } catch { setForm(DEFAULT); }
  };

  const setField = (key: keyof VFDRequest, value: unknown) =>
    setForm((f) => ({ ...f, [key]: value }));

  const updateProfile = (i: number, field: keyof LoadPoint, value: number) => {
    const next = form.load_profile.map((p, idx) => idx === i ? { ...p, [field]: value } : p);
    setField("load_profile", next);
  };

  const addPoint = () =>
    setField("load_profile", [...form.load_profile, { speed_fraction: 0.5, time_fraction: 0 }]);

  const removePoint = (i: number) =>
    setField("load_profile", form.load_profile.filter((_, idx) => idx !== i));

  const tfSum = form.load_profile.reduce((s, p) => s + p.time_fraction, 0);
  const tfOk = Math.abs(tfSum - 1.0) <= 0.02;

  return (
    <form onSubmit={(e) => { e.preventDefault(); onCalculate(form); }}
      className="bg-white rounded-xl border border-slate-200 p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-slate-700">Input Parameters</h2>
        <button type="button" onClick={loadDemo} className="text-xs text-blue-600 hover:underline">Load demo</button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Motor Power" unit="kW">
          <Input type="number" min={0.1} max={10000} step={0.1}
            value={form.motor_power_kw} onChange={(e) => setField("motor_power_kw", +e.target.value)} />
        </Field>
        <Field label="Load Type">
          <select value={form.load_type}
            onChange={(e) => setField("load_type", e.target.value as VFDRequest["load_type"])}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white">
            <option value="pump">Pump (P ∝ speed³)</option>
            <option value="fan">Fan (P ∝ speed³)</option>
            <option value="conveyor">Conveyor (P ∝ speed)</option>
          </select>
        </Field>
        <Field label="Motor Efficiency" unit="0–1">
          <Input type="number" min={0.5} max={1} step={0.001}
            value={form.motor_efficiency} onChange={(e) => setField("motor_efficiency", +e.target.value)} />
        </Field>
        <Field label="VFD Efficiency" unit="0–1">
          <Input type="number" min={0.5} max={1} step={0.001}
            value={form.vfd_efficiency} onChange={(e) => setField("vfd_efficiency", +e.target.value)} />
        </Field>
        <Field label="Operating Hours" unit="hr/yr">
          <Input type="number" min={0} max={8760} step={10}
            value={form.operating_hours_per_year} onChange={(e) => setField("operating_hours_per_year", +e.target.value)} />
        </Field>
        <Field label="Tariff" unit="/kWh">
          <Input type="number" min={0.001} max={10} step={0.001}
            value={form.tariff_per_kwh} onChange={(e) => setField("tariff_per_kwh", +e.target.value)} />
        </Field>
        <Field label="VFD Cost" unit="currency">
          <Input type="number" min={0} step={1}
            value={form.vfd_cost} onChange={(e) => setField("vfd_cost", +e.target.value)} />
        </Field>
        <Field label="Headroom Factor">
          <Input type="number" min={1} max={2} step={0.01}
            value={form.headroom_factor} onChange={(e) => setField("headroom_factor", +e.target.value)} />
        </Field>
      </div>

      {/* Load profile */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Load Profile</label>
          <span className={`text-xs font-mono ${tfOk ? "text-emerald-600" : "text-red-500"}`}>
            sum time = {tfSum.toFixed(2)} {tfOk ? "(ok)" : "(must be 1.00)"}
          </span>
        </div>
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2 text-xs font-medium text-slate-500 px-2">
            <span>Speed fraction</span>
            <span>Time fraction</span>
            <span />
          </div>
          {form.load_profile.map((pt, i) => (
            <div key={i} className="grid grid-cols-3 gap-2 items-center">
              <Input type="number" min={0.05} max={1} step={0.01}
                value={pt.speed_fraction} onChange={(e) => updateProfile(i, "speed_fraction", +e.target.value)} />
              <Input type="number" min={0} max={1} step={0.01}
                value={pt.time_fraction} onChange={(e) => updateProfile(i, "time_fraction", +e.target.value)} />
              <button type="button" onClick={() => removePoint(i)}
                disabled={form.load_profile.length <= 1}
                className="text-xs text-red-400 hover:text-red-600 disabled:opacity-30">x</button>
            </div>
          ))}
          <button type="button" onClick={addPoint}
            className="text-xs text-blue-600 hover:underline">+ Add point</button>
        </div>
      </div>

      <button type="submit" disabled={loading || !tfOk}
        className="w-full py-2.5 text-white font-semibold rounded-lg transition-opacity disabled:opacity-50"
        style={{ backgroundColor: "#1e3a5f" }}>
        {loading ? "Calculating…" : "Calculate VFD Savings"}
      </button>
    </form>
  );
}
