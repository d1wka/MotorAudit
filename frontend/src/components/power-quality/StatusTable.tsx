import type { StatusFlag } from "@/lib/types";

interface Props { flags: StatusFlag[] }

const STATUS_STYLE: Record<string, string> = {
  PASS: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  WARN: "bg-amber-50 text-amber-700 border border-amber-200",
  FAIL: "bg-red-50 text-red-700 border border-red-200",
};

export default function StatusTable({ flags }: Props) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-slate-200">
          {["Metric", "Value", "Limit", "Unit", "Status"].map((h) => (
            <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-slate-600">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {flags.map((f, i) => (
          <tr key={i}>
            <td className="px-3 py-2 text-slate-700">{f.metric}</td>
            <td className="px-3 py-2 font-mono text-slate-800">{f.value.toFixed(3)}</td>
            <td className="px-3 py-2 font-mono text-slate-500">{f.limit.toFixed(3)}</td>
            <td className="px-3 py-2 text-slate-500">{f.unit}</td>
            <td className="px-3 py-2">
              <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${STATUS_STYLE[f.status]}`}>
                {f.status}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
