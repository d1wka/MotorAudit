"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { WaveformPreview } from "@/lib/types";

export default function WaveformChart({ preview }: { preview: WaveformPreview }) {
  const data = preview.time_ms.map((t, i) => {
    const pt: Record<string, number> = { t: +t.toFixed(3) };
    if (preview.ia) pt["ia (A)"] = +(preview.ia[i] ?? 0).toFixed(3);
    if (preview.ib) pt["ib (A)"] = +(preview.ib[i] ?? 0).toFixed(3);
    if (preview.ic) pt["ic (A)"] = +(preview.ic[i] ?? 0).toFixed(3);
    if (preview.va) pt["va (V)"] = +(preview.va[i] ?? 0).toFixed(3);
    return pt;
  });

  const lines: { key: string; color: string }[] = [];
  if (preview.ia) lines.push({ key: "ia (A)", color: "#3b82f6" });
  if (preview.ib) lines.push({ key: "ib (A)", color: "#22c55e" });
  if (preview.ic) lines.push({ key: "ic (A)", color: "#f59e0b" });
  if (preview.va && !preview.ib) lines.push({ key: "va (V)", color: "#a855f7" });

  return (
    <div>
      <ResponsiveContainer width="100%" height={228}>
        <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="t" tick={{ fontSize: 9 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip contentStyle={{ fontSize: 11 }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {lines.map(({ key, color }) => (
            <Line key={key} type="linear" dataKey={key} stroke={color} dot={false} strokeWidth={1.5} />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <p className="text-center text-xs text-slate-400 -mt-1">Time (ms)</p>
    </div>
  );
}
