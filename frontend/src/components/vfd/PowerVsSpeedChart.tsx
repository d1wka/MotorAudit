"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { PowerVsSpeedCurve } from "@/lib/types";

export default function PowerVsSpeedChart({ curve }: { curve: PowerVsSpeedCurve }) {
  const data = curve.speed_fractions.map((sf, i) => ({
    speed: `${Math.round(sf * 100)}%`,
    "Throttling": +(curve.baseline_fraction[i] * 100).toFixed(1),
    "VFD": +(curve.vfd_fraction[i] * 100).toFixed(1),
  }));

  return (
    <div>
      <ResponsiveContainer width="100%" height={248}>
        <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="speed" tick={{ fontSize: 11 }} />
          <YAxis
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 11 }}
            domain={[0, 105]}
            label={{ value: "Power (%)", angle: -90, position: "insideLeft", offset: 10, fontSize: 11 }}
          />
          <Tooltip formatter={(v: number) => [`${v.toFixed(1)}%`, ""]} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line type="monotone" dataKey="Throttling" stroke="#ef4444" strokeWidth={2} dot={false} strokeDasharray="6 3" />
          <Line type="monotone" dataKey="VFD" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
      <p className="text-center text-xs text-slate-400 -mt-1">Speed</p>
    </div>
  );
}
