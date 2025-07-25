import type {
  ReplacementRequest, ReplacementResponse,
  VFDRequest, VFDResponse,
  PQRequest, PQResponse,
  ReportRequest, ReportSummary,
  MotorRecord,
  AIInsightsResponse,
  AIStatusResponse,
} from "./types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail));
  }
  return res.json();
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(res.statusText);
  return res.json();
}

export const api = {
  motors: {
    list: () => get<MotorRecord[]>("/api/motors"),
  },

  replacement: {
    calculate: (req: ReplacementRequest) =>
      post<ReplacementResponse>("/api/replacement/calculate", req),
    demo: () => get<ReplacementRequest>("/api/replacement/demo"),
  },

  vfd: {
    calculate: (req: VFDRequest) =>
      post<VFDResponse>("/api/vfd/calculate", req),
    demo: () => get<VFDRequest>("/api/vfd/demo"),
  },

  powerQuality: {
    analyze: (req: PQRequest) =>
      post<PQResponse>("/api/power-quality/analyze", req),
    presets: () => get<{ presets: { name: string; description: string }[] }>("/api/power-quality/presets"),
    uploadCsv: async (
      file: File,
      params: { sample_rate_hz: number; fundamental_freq_hz: number }
    ): Promise<PQResponse> => {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("sample_rate_hz", String(params.sample_rate_hz));
      fd.append("fundamental_freq_hz", String(params.fundamental_freq_hz));
      const res = await fetch(`${BASE}/api/power-quality/upload`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail));
      }
      return res.json();
    },
  },

  ai: {
    status: () => get<AIStatusResponse>("/api/ai/status"),
    insights: (module: "replacement" | "vfd" | "power_quality", result: unknown) =>
      post<AIInsightsResponse>("/api/ai/insights", { module, result }),
  },

  report: {
    summary: (req: ReportRequest) =>
      post<ReportSummary>("/api/report/summary", req),
    downloadPdf: async (req: ReportRequest): Promise<void> => {
      const res = await fetch(`${BASE}/api/report/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
      });
      if (!res.ok) throw new Error("PDF generation failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "motoraudit_report.pdf";
      a.click();
      URL.revokeObjectURL(url);
    },
  },
};
