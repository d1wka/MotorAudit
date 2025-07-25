"use client";

import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import type { FFTPreview } from "@/lib/types";

interface Props {
  fft: FFTPreview;
  fundamental: number;
}

export default function FFTSpectrumChart({ fft, fundamental }: Props) {
  const step = Math.max(1, Math.floor(fft.freq_hz.length / 400));
  const data = fft.freq_hz
    .filter((_, i) => i % step === 0)
    .map((f, i) => {
      const idx = i * step;
      const pt: Record<string, number> = { freq: +f.toFixed(1) };
      if (fft.ia_magnitude) pt["ia (dBFS)"] = +(fft.ia_magnitude[idx] ?? -120).toFixed(1);
      if (fft.va_magnitude) pt["va (dBFS)"] = +(fft.va_magnitude[idx] ?? -120).toFixed(1);
      return pt;
    });

  // Reference lines at harmonic frequencies
  const harmonics = [1, 3, 5, 7, 11, 13].map((h) => fundamental * h).filter((f) => f <= 2000);

  return (
    <div>
      <ResponsiveContainer width="100%" height={228}>
        <ComposedChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="freq" type="number" domain={[0, 2000]}
            tick={{ fontSize: 9 }} tickCount={10} />
          <YAxis domain={[-80, 0]} tick={{ fontSize: 10 }}
            label={{ value: "dBFS", angle: -90, position: "insideLeft", offset: 10, fontSize: 11 }} />
          <Tooltip contentStyle={{ fontSize: 11 }} formatter={(v: number) => [`${v.toFixed(1)} dBFS`, ""]} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {harmonics.map((f) => (
            <ReferenceLine key={f} x={f} stroke="#f59e0b" strokeDasharray="3 2" strokeWidth={1} />
          ))}
          {fft.ia_magnitude && <Bar dataKey="ia (dBFS)" fill="#3b82f680" barSize={2} />}
          {fft.va_magnitude && <Line type="linear" dataKey="va (dBFS)" stroke="#a855f7" dot={false} strokeWidth={1} />}
        </ComposedChart>
      </ResponsiveContainer>
      <p className="text-center text-xs text-slate-400 -mt-1">Frequency (Hz)</p>
    </div>
  );
}
