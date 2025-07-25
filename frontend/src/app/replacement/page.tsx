"use client";

import { useState } from "react";
import { useAuditSession } from "@/hooks/useAuditSession";
import { api } from "@/lib/api";
import type { ReplacementRequest, ReplacementResponse } from "@/lib/types";
import ReplacementForm from "@/components/replacement/ReplacementForm";
import ReplacementResults from "@/components/replacement/ReplacementResults";

export default function ReplacementPage() {
  const { setReplacementResult, replacementResult } = useAuditSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCalculate = async (req: ReplacementRequest) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.replacement.calculate(req);
      setReplacementResult(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Motor Replacement & Payback</h1>
        <p className="text-slate-500 text-sm mt-1">
          Compare an existing motor against a higher-efficiency replacement. All efficiency values from IEC 60034-30-1:2014.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ReplacementForm onCalculate={handleCalculate} loading={loading} />
        {error && (
          <div className="lg:col-span-2 bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
            {error}
          </div>
        )}
        {replacementResult && (
          <div className="lg:col-span-2">
            <ReplacementResults result={replacementResult} />
          </div>
        )}
      </div>
    </div>
  );
}
