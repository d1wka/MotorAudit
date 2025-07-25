"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { EfficiencyCurve } from "@/lib/types";

export default function EfficiencyVsLoadChart({ curve }: { curve: EfficiencyCurve }) {
  const data = curve.load_points.map((lf, i) => ({
    load: `${Math.round(lf * 100)}%`,
    "Existing": +((curve.existing_eta[i] ?? 0) * 100).toFixed(2),
    "Replacement": +((curve.replacement_eta[i] ?? 0) * 100).toFixed(2),
  }));

  return (
    <div>
      <ResponsiveContainer width="100%" height={248}>
        <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="load" tick={{ fontSize: 11 }} />
          <YAxis
            domain={["auto", "auto"]}
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 11 }}
            label={{ value: "η (%)", angle: -90, position: "insideLeft", offset: 10, fontSize: 11 }}
          />
          <Tooltip formatter={(v: number) => [`${v.toFixed(2)}%`, ""]} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line type="monotone" dataKey="Existing" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} />
          <Line type="monotone" dataKey="Replacement" stroke="#22c55e" strokeWidth={2} dot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
      <p className="text-center text-xs text-slate-400 -mt-1">Load Factor</p>
    </div>
  );
}
