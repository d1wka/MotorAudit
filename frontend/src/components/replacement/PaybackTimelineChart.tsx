"use client";

import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ReferenceLine, ResponsiveContainer,
} from "recharts";
import type { PaybackTimeline } from "@/lib/types";

export default function PaybackTimelineChart({ timeline }: { timeline: PaybackTimeline }) {
  const data = timeline.years.map((yr, i) => ({
    year: yr,
    "Net Position": +timeline.net_position[i].toFixed(2),
    "Cumulative Savings": +timeline.cumulative_savings[i].toFixed(2),
  }));

  return (
    <div>
      <ResponsiveContainer width="100%" height={248}>
        <ComposedChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="year" tick={{ fontSize: 11 }} />
          <YAxis tickFormatter={(v) => v.toLocaleString()} tick={{ fontSize: 10 }} />
          <Tooltip formatter={(v: number) => [v.toLocaleString(undefined, { minimumFractionDigits: 2 }), ""]} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <ReferenceLine y={0} stroke="#64748b" strokeDasharray="4 2" />
          <Bar dataKey="Cumulative Savings" fill="#bfdbfe" radius={[2, 2, 0, 0]} />
          <Line type="monotone" dataKey="Net Position" stroke="#1e3a5f" strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
      <p className="text-center text-xs text-slate-400 -mt-1">Year</p>
    </div>
  );
}
