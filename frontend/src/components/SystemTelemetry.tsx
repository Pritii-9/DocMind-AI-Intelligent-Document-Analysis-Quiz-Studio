import { useEffect, useState } from "react";
import { Activity, Cpu, HardDrive, Zap, RefreshCw, CheckCircle2, Server } from "lucide-react";
import api from "../api/client";
import { useToast } from "../context/ToastContext";

interface TelemetryStats {
  totalDocs: number;
  totalChunks: number;
  totalStorage: string;
  activeMembers: number;
  healthStatus: "healthy" | "checking" | "error";
  pingMs: number | null;
}

const rowCls = "flex justify-between items-center px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-200";

export default function SystemTelemetry() {
  const { toast } = useToast();
  const [stats, setStats] = useState<TelemetryStats>({
    totalDocs: 0, totalChunks: 0, totalStorage: "0 MB",
    activeMembers: 1, healthStatus: "healthy", pingMs: null,
  });
  const [loading, setLoading]     = useState(true);
  const [testingPing, setTestingPing] = useState(false);

  const fetchMetrics = async () => {
    setLoading(true);
    const t0 = performance.now();
    try {
      const [overviewRes, libraryRes, healthRes] = await Promise.all([
        api.get("/pdf/overview").then(r => r.data).catch(() => null),
        api.get("/pdf/library").then(r => r.data).catch(() => []),
        api.get("/health").then(r => r.data).catch(() => null),
      ]);
      const ping = Math.round(performance.now() - t0);
      let totalBytes = 0, totalChunks = 0;
      if (Array.isArray(libraryRes)) {
        libraryRes.forEach((d: any) => { totalBytes += d.size_bytes || 0; totalChunks += d.ai_chunk_count || 0; });
      }
      setStats({
        totalDocs: libraryRes?.length || 0,
        totalChunks,
        totalStorage: `${(totalBytes / (1024 * 1024)).toFixed(2)} MB`,
        activeMembers: overviewRes?.stats?.active_members || 1,
        healthStatus: healthRes ? "healthy" : "error",
        pingMs: ping,
      });
    } catch {
      setStats(prev => ({ ...prev, healthStatus: "error" }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMetrics(); }, []);

  const runDiagnostic = async () => {
    setTestingPing(true);
    const t0 = performance.now();
    try {
      await api.get("/health");
      const ms = Math.round(performance.now() - t0);
      setStats(prev => ({ ...prev, pingMs: ms, healthStatus: "healthy" }));
      toast.success(`Health Diagnostic Passed! Latency: ${ms}ms`);
    } catch {
      setStats(prev => ({ ...prev, healthStatus: "error" }));
      toast.error("Health Check failed. Backend unreachable.");
    } finally {
      setTestingPing(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center gap-3" style={{ height: "calc(100vh - 60px)" }}>
      <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-[var(--brand)] spin" />
      <p className="text-[13px] text-slate-500">Loading system telemetry…</p>
    </div>
  );

  const metrics = [
    {
      label: "API Ping Latency",
      value: stats.pingMs !== null ? `${stats.pingMs} ms` : "—",
      sub: "Roundtrip response time",
      icon: Activity, iconCls: "text-[var(--brand)]",
      subCls: "text-green-600", subIcon: CheckCircle2,
    },
    {
      label: "Vector Chunks",
      value: `${stats.totalChunks} Chunks`,
      sub: "Stored in MongoDB Atlas",
      icon: Cpu, iconCls: "text-violet-600",
      subCls: "text-slate-500", subIcon: null,
    },
    {
      label: "S3 Storage Used",
      value: stats.totalStorage,
      sub: `Across ${stats.totalDocs} PDF documents`,
      icon: HardDrive, iconCls: "text-blue-600",
      subCls: "text-slate-500", subIcon: null,
    },
    {
      label: "Quiz Review Latency",
      value: "0 ms",
      sub: "Pre-computed explanation cache",
      icon: Zap, iconCls: "text-green-600",
      subCls: "text-green-700", subIcon: null,
      valueGreen: true,
    },
  ];

  const ragRows = [
    ["Embedding Transformer Model", "BAAI/bge-small-en-v1.5", "text-slate-900"],
    ["Vector Dimensions",           "384 Dimensions",          "text-slate-900"],
    ["Similarity Search Index",     "MongoDB Atlas $vectorSearch", "text-green-700"],
    ["Fallback Engine",             "Cosine Similarity",        "text-slate-900"],
  ];
  const cloudRows = [
    ["Object Storage Provider",    "AWS S3 Bucket",             "text-slate-900"],
    ["Streaming Protocol",         "HTTP 206 Partial Content",  "text-green-700"],
    ["Server Architecture",        "FastAPI Async ASGI",        "text-slate-900"],
    ["Tenant Isolation",           "Workspace Scope Claims",    "text-[var(--brand)]"],
  ];

  return (
    <div className="animate-in p-7 bg-slate-50 min-h-[calc(100vh-60px)] font-[Inter,system-ui,sans-serif]">

      {/* Header */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-slate-900">System Telemetry &amp; Architecture</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">Live technical specs, backend performance metrics, and RAG vector telemetry.</p>
        </div>
        <button
          onClick={runDiagnostic}
          disabled={testingPing}
          className="flex items-center gap-2 text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl border-none cursor-pointer transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ background: "var(--brand)", boxShadow: "0 4px 14px rgba(61,79,110,0.25)" }}
        >
          <RefreshCw size={14} className={testingPing ? "spin" : ""} />
          {testingPing ? "Running Diagnostic…" : "Run Diagnostic"}
        </button>
      </div>

      {/* KPI metric cards */}
      <div className="grid gap-3.5 mb-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px,1fr))" }}>
        {metrics.map(m => (
          <div key={m.label} className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-[18px]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-[0.05em]">{m.label}</span>
              <m.icon size={16} className={m.iconCls} />
            </div>
            <p className={`text-2xl font-extrabold m-0 ${m.valueGreen ? "text-green-600" : "text-slate-900"}`}>{m.value}</p>
            <span className={`text-[11px] font-semibold mt-1 flex items-center gap-1 ${m.subCls}`}>
              {m.subIcon && <m.subIcon size={11} />}
              {m.sub}
            </span>
          </div>
        ))}
      </div>

      {/* Spec grids */}
      <div className="grid grid-cols-2 gap-4">
        {[
          { title: "RAG & Vector Processing Engine", icon: Cpu, iconCls: "text-[var(--brand)]", rows: ragRows },
          { title: "Cloud Infrastructure & Streaming", icon: Server, iconCls: "text-blue-600", rows: cloudRows },
        ].map(panel => (
          <div key={panel.title} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h3 className="text-[15px] font-extrabold text-slate-900 mb-3.5 flex items-center gap-2">
              <panel.icon size={18} className={panel.iconCls} /> {panel.title}
            </h3>
            <div className="flex flex-col gap-2.5">
              {panel.rows.map(([label, val, valCls]) => (
                <div key={label} className={rowCls}>
                  <span className="text-[12.5px] text-slate-500">{label}</span>
                  <span className={`text-xs font-bold ${valCls}`}>{val}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
