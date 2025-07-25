"use client";

import { useState, useRef } from "react";
import type { PQRequest, PresetName, PQThresholds } from "@/lib/types";

interface Props {
  onAnalyze: (req: PQRequest, csvFile?: File) => void;
  loading: boolean;
}

const PRESETS: { name: PresetName; label: string; description: string }[] = [
  { name: "clean_sinusoid",    label: "Clean Sinusoid",     description: "Pure 50 Hz — zero THD reference" },
  { name: "vfd_harmonics",     label: "VFD Harmonics",      description: "6-pulse VFD current: 5th, 7th, 11th, 13th" },
  { name: "unbalanced_3phase", label: "3-Phase Unbalanced", description: "3-phase with ~4% current unbalance" },
  { name: "low_power_factor",  label: "Low Power Factor",   description: "PF ≈ 0.80 (37° current lag)" },
];

const DEFAULT_THRESHOLDS: PQThresholds = {
  thd_voltage_pct: 5,
  thd_current_pct: 8,
  power_factor_min: 0.95,
  current_unbalance_pct: 3,
};

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />;
}

export default function PQForm({ onAnalyze, loading }: Props) {
  const [mode, setMode] = useState<"preset" | "upload">("preset");
  const [preset, setPreset] = useState<PresetName>("vfd_harmonics");
  const [sampleRate, setSampleRate] = useState(10000);
  const [fundamental, setFundamental] = useState(50);
  const [thresholds, setThresholds] = useState<PQThresholds>(DEFAULT_THRESHOLDS);
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const setTh = (k: keyof PQThresholds, v: number) =>
    setThresholds((t) => ({ ...t, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const req: PQRequest = {
      source: mode === "preset" ? "preset" : "json",
      preset_name: mode === "preset" ? preset : undefined,
      sample_rate_hz: sampleRate,
      fundamental_freq_hz: fundamental,
      thresholds,
    };
    onAnalyze(req, mode === "upload" && file ? file : undefined);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-5 space-y-5">
      <h2 className="font-semibold text-slate-700">Analysis Settings</h2>

      {/* Mode selector */}
      <div className="flex gap-2">
        {(["preset", "upload"] as const).map((m) => (
          <button key={m} type="button" onClick={() => setMode(m)}
            className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors ${
              mode === m ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"
            }`}>
            {m === "preset" ? "Preset Signal" : "Upload CSV"}
          </button>
        ))}
      </div>

      {mode === "preset" && (
        <div className="space-y-2">
          {PRESETS.map((p) => (
            <label key={p.name}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                preset === p.name ? "border-blue-400 bg-blue-50" : "border-slate-200 hover:bg-slate-50"
              }`}>
              <input type="radio" name="preset" value={p.name} checked={preset === p.name}
                onChange={() => setPreset(p.name)} className="mt-0.5" />
              <div>
                <div className="text-sm font-medium text-slate-700">{p.label}</div>
                <div className="text-xs text-slate-500">{p.description}</div>
              </div>
            </label>
          ))}
        </div>
      )}

      {mode === "upload" && (
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            CSV file <span className="text-slate-400">(columns: time, ia [, ib, ic, va, vb, vc])</span>
          </label>
          <div
            className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 transition-colors"
            onClick={() => fileRef.current?.click()}>
            <input ref={fileRef} type="file" accept=".csv" className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            {file
              ? <p className="text-sm font-medium text-slate-700">{file.name}</p>
              : <p className="text-sm text-slate-400">Click to select a CSV file (max 10 MB)</p>}
          </div>
        </div>
      )}

      {/* Signal parameters */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Sample Rate (Hz)</label>
          <Input type="number" min={100} max={1000000} step={100}
            value={sampleRate} onChange={(e) => setSampleRate(+e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Fundamental (Hz)</label>
          <Input type="number" min={45} max={65} step={0.5}
            value={fundamental} onChange={(e) => setFundamental(+e.target.value)} />
        </div>
      </div>

      {/* Thresholds */}
      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Advisory Thresholds <span className="font-normal normal-case text-slate-400">(IEEE 519 style)</span>
        </legend>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Current THD limit (%)</label>
            <Input type="number" min={0} max={100} step={0.5}
              value={thresholds.thd_current_pct} onChange={(e) => setTh("thd_current_pct", +e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Voltage THD limit (%)</label>
            <Input type="number" min={0} max={100} step={0.5}
              value={thresholds.thd_voltage_pct} onChange={(e) => setTh("thd_voltage_pct", +e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Min Power Factor</label>
            <Input type="number" min={0} max={1} step={0.01}
              value={thresholds.power_factor_min} onChange={(e) => setTh("power_factor_min", +e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Current Unbalance limit (%)</label>
            <Input type="number" min={0} max={20} step={0.5}
              value={thresholds.current_unbalance_pct} onChange={(e) => setTh("current_unbalance_pct", +e.target.value)} />
          </div>
        </div>
      </fieldset>

      <button type="submit" disabled={loading || (mode === "upload" && !file)}
        className="w-full py-2.5 text-white font-semibold rounded-lg transition-opacity disabled:opacity-50"
        style={{ backgroundColor: "#1e3a5f" }}>
        {loading ? "Analysing…" : "Analyse Waveform"}
      </button>
    </form>
  );
}
