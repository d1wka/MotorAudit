"use client";

import { useAuditSession } from "@/hooks/useAuditSession";
import { api } from "@/lib/api";
import { useState } from "react";

export default function TopBar() {
  const { siteName, setSiteName, replacementResult, vfdResult, pqResult, currencySymbol } = useAuditSession();
  const [downloading, setDownloading] = useState(false);

  const hasResults = !!(replacementResult || vfdResult || pqResult);

  const handlePdf = async () => {
    setDownloading(true);
    try {
      await api.report.downloadPdf({
        site_name: siteName,
        analyst_name: "",
        currency_symbol: currencySymbol,
        replacement_result: replacementResult ?? undefined,
        vfd_result: vfdResult ?? undefined,
        pq_result: pqResult ?? undefined,
      });
    } catch (e) {
      alert("PDF generation failed: " + (e as Error).message);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0">
      <input
        value={siteName}
        onChange={(e) => setSiteName(e.target.value)}
        placeholder="Site name…"
        className="text-sm font-medium text-slate-600 bg-transparent border-none outline-none w-64"
      />

      <div className="flex items-center gap-3">
        {hasResults && (
          <span className="text-xs text-emerald-600 font-medium bg-emerald-50 px-2 py-1 rounded">
            {[replacementResult && "Replacement", vfdResult && "VFD", pqResult && "PQ"]
              .filter(Boolean)
              .join(" · ")} analysed
          </span>
        )}
        <button
          onClick={handlePdf}
          disabled={!hasResults || downloading}
          className="flex items-center gap-2 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg disabled:opacity-40 transition-colors"
        >
          {downloading ? "Generating…" : "Export PDF"}
        </button>
      </div>
    </header>
  );
}
