"use client";

import { createContext, useContext, useState, ReactNode, createElement } from "react";
import type { ReplacementResponse, VFDResponse, PQResponse } from "@/lib/types";

interface AuditSession {
  siteName: string;
  analystName: string;
  currencySymbol: string;
  replacementResult: ReplacementResponse | null;
  vfdResult: VFDResponse | null;
  pqResult: PQResponse | null;
  setSiteName: (v: string) => void;
  setAnalystName: (v: string) => void;
  setCurrencySymbol: (v: string) => void;
  setReplacementResult: (v: ReplacementResponse | null) => void;
  setVfdResult: (v: VFDResponse | null) => void;
  setPqResult: (v: PQResponse | null) => void;
  clearAll: () => void;
}

const Ctx = createContext<AuditSession | null>(null);

export function AuditSessionProvider({ children }: { children: ReactNode }) {
  const [siteName, setSiteName] = useState("Plant A");
  const [analystName, setAnalystName] = useState("");
  const [currencySymbol, setCurrencySymbol] = useState("$");
  const [replacementResult, setReplacementResult] = useState<ReplacementResponse | null>(null);
  const [vfdResult, setVfdResult] = useState<VFDResponse | null>(null);
  const [pqResult, setPqResult] = useState<PQResponse | null>(null);

  const clearAll = () => {
    setReplacementResult(null);
    setVfdResult(null);
    setPqResult(null);
  };

  return createElement(Ctx.Provider, {
    value: {
      siteName, analystName, currencySymbol,
      replacementResult, vfdResult, pqResult,
      setSiteName, setAnalystName, setCurrencySymbol,
      setReplacementResult, setVfdResult, setPqResult,
      clearAll,
    },
    children,
  });
}

export function useAuditSession(): AuditSession {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuditSession must be used inside AuditSessionProvider");
  return ctx;
}
