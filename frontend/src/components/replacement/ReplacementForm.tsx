"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { ReplacementRequest } from "@/lib/types";

interface Props {
  onCalculate: (req: ReplacementRequest) => void;
  loading: boolean;
}

const IE_CLASSES = ["IE1", "IE2", "IE3", "IE4"];

const DEFAULT: ReplacementRequest = {
  existing_motor: { rated_power_kw: 37, ie_class: "IE1", load_factor: 0.75 },
  replacement_motor: { ie_class: "IE3", cost: 4200 },
  operating_hours_per_year: 6000,
  tariff_per_kwh: 0.12,
  co2_factor_kg_per_kwh: 0.233,
  lifetime_years: 20,
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
  return (
    <input
      {...props}
      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) {
  return (
    <select
      {...props}
      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
    />
  );
}

export default function ReplacementForm({ onCalculate, loading }: Props) {
  const [form, setForm] = useState<ReplacementRequest>(DEFAULT);

  const loadDemo = async () => {
    try {
      const demo = await api.replacement.demo();
      setForm(demo);
    } catch {
      setForm(DEFAULT);
    }
  };

  const set = (path: string, value: unknown) => {
    setForm((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      const keys = path.split(".");
      let obj: Record<string, unknown> = next;
      for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]] as Record<string, unknown>;
      obj[keys[keys.length - 1]] = value;
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCalculate(form);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-slate-700">Input Parameters</h2>
        <button type="button" onClick={loadDemo} className="text-xs text-blue-600 hover:underline">
          Load demo
        </button>
      </div>

      {/* Existing motor */}
      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Existing Motor</legend>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Rated Power" unit="kW">
            <Input type="number" min={0.1} max={10000} step={0.1}
              value={form.existing_motor.rated_power_kw}
              onChange={(e) => set("existing_motor.rated_power_kw", +e.target.value)} />
          </Field>
          <Field label="IE Class">
            <Select value={form.existing_motor.ie_class ?? ""}
              onChange={(e) => set("existing_motor.ie_class", e.target.value || undefined)}>
              {IE_CLASSES.map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Load Factor" unit="0–1">
            <Input type="number" min={0.05} max={1} step={0.01}
              value={form.existing_motor.load_factor}
              onChange={(e) => set("existing_motor.load_factor", +e.target.value)} />
          </Field>
          <Field label="Efficiency Override" unit="% (optional)">
            <Input type="number" min={50} max={100} step={0.1}
              placeholder="e.g. 88.5"
              value={form.existing_motor.efficiency_override_pct ?? ""}
              onChange={(e) => set("existing_motor.efficiency_override_pct", e.target.value ? +e.target.value : undefined)} />
          </Field>
        </div>
      </fieldset>

      {/* Replacement motor */}
      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Replacement Motor</legend>
        <div className="grid grid-cols-2 gap-3">
          <Field label="IE Class">
            <Select value={form.replacement_motor.ie_class ?? ""}
              onChange={(e) => set("replacement_motor.ie_class", e.target.value || undefined)}>
              {IE_CLASSES.map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Motor Cost" unit="currency">
            <Input type="number" min={0} step={1}
              value={form.replacement_motor.cost}
              onChange={(e) => set("replacement_motor.cost", +e.target.value)} />
          </Field>
          <Field label="Efficiency Override" unit="% (optional)">
            <Input type="number" min={50} max={100} step={0.1}
              placeholder="e.g. 94.5"
              value={form.replacement_motor.efficiency_override_pct ?? ""}
              onChange={(e) => set("replacement_motor.efficiency_override_pct", e.target.value ? +e.target.value : undefined)} />
          </Field>
        </div>
      </fieldset>

      {/* Operating conditions */}
      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Operating Conditions</legend>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Operating Hours" unit="hr/yr">
            <Input type="number" min={0} max={8760} step={10}
              value={form.operating_hours_per_year}
              onChange={(e) => set("operating_hours_per_year", +e.target.value)} />
          </Field>
          <Field label="Electricity Tariff" unit="/kWh">
            <Input type="number" min={0.001} max={10} step={0.001}
              value={form.tariff_per_kwh}
              onChange={(e) => set("tariff_per_kwh", +e.target.value)} />
          </Field>
          <Field label="CO₂ Factor" unit="kg/kWh (optional)">
            <Input type="number" min={0} max={5} step={0.001}
              value={form.co2_factor_kg_per_kwh ?? ""}
              onChange={(e) => set("co2_factor_kg_per_kwh", e.target.value ? +e.target.value : undefined)} />
          </Field>
          <Field label="Lifetime" unit="years">
            <Input type="number" min={1} max={50} step={1}
              value={form.lifetime_years}
              onChange={(e) => set("lifetime_years", +e.target.value)} />
          </Field>
        </div>
      </fieldset>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-2.5 bg-navy-500 hover:opacity-90 text-white font-semibold rounded-lg transition-opacity disabled:opacity-50"
        style={{ backgroundColor: "#1e3a5f" }}
      >
        {loading ? "Calculating…" : "Calculate Savings"}
      </button>
    </form>
  );
}
