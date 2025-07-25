"use client";

import { useState } from "react";
import { useAuditSession } from "@/hooks/useAuditSession";
import { api } from "@/lib/api";
import type { VFDRequest } from "@/lib/types";
import VFDForm from "@/components/vfd/VFDForm";
import VFDResults from "@/components/vfd/VFDResults";

export default function VFDPage() {
  const { setVfdResult, vfdResult } = useAuditSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCalculate = async (req: VFDRequest) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.vfd.calculate(req);
      setVfdResult(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">VFD Sizing & Savings</h1>
        <p className="text-slate-500 text-sm mt-1">
          Estimate energy savings from a Variable Frequency Drive using affinity laws (pump/fan) or constant-torque model (conveyor).
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <VFDForm onCalculate={handleCalculate} loading={loading} />
        {error && (
          <div className="lg:col-span-2 bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">{error}</div>
        )}
        {vfdResult && (
          <div className="lg:col-span-2">
            <VFDResults result={vfdResult} />
          </div>
        )}
      </div>
    </div>
  );
}
