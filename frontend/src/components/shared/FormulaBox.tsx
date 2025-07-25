"use client";

import { useState } from "react";

interface Props {
  assumptions: string[];
  title?: string;
}

export default function FormulaBox({ assumptions, title = "Formulas & Assumptions" }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 text-sm font-medium text-slate-600 transition-colors"
      >
        <span>{title}</span>
        <span className="text-slate-400">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <ul className="px-4 py-3 space-y-2 bg-white">
          {assumptions.map((a, i) => (
            <li key={i} className="text-xs text-slate-600 font-mono leading-relaxed border-l-2 border-amber-400 pl-3">
              {a}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
