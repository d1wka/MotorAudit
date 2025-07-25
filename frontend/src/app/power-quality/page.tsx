"use client";

import { useState } from "react";
import { useAuditSession } from "@/hooks/useAuditSession";
import { api } from "@/lib/api";
import type { PQRequest } from "@/lib/types";
import PQForm from "@/components/power-quality/PQForm";
import PQResults from "@/components/power-quality/PQResults";

export default function PowerQualityPage() {
  const { setPqResult, pqResult } = useAuditSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async (req: PQRequest, csvFile?: File) => {
    setLoading(true);
    setError(null);
    try {
      let result;
      if (csvFile) {
        result = await api.powerQuality.uploadCsv(csvFile, {
          sample_rate_hz: req.sample_rate_hz ?? 10000,
          fundamental_freq_hz: req.fundamental_freq_hz ?? 50,
        });
      } else {
        result = await api.powerQuality.analyze(req);
      }
      setPqResult(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Power Quality Analyzer</h1>
        <p className="text-slate-500 text-sm mt-1">
          Upload a CSV waveform or choose a preset signal. Computes THD, power factor, phase unbalance, and harmonic spectrum.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PQForm onAnalyze={handleAnalyze} loading={loading} />
        {error && (
          <div className="lg:col-span-2 bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">{error}</div>
        )}
        {pqResult && (
          <div className="lg:col-span-2">
            <PQResults result={pqResult} />
          </div>
        )}
      </div>
    </div>
  );
}
