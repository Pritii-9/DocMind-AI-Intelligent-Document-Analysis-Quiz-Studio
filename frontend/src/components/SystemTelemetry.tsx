import { useEffect, useState } from "react";
import { Activity, Cpu, Database, HardDrive, ShieldCheck, Zap, RefreshCw, CheckCircle2, Server, Globe } from "lucide-react";
import api from "../api/client";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";

interface TelemetryStats {
  totalDocs: number;
  totalChunks: number;
  totalStorage: string;
  activeMembers: number;
  healthStatus: "healthy" | "checking" | "error";
  pingMs: number | null;
}

const ACCENT = "oklch(45% 0.033 256.848)";
const ACCENT_LIGHT = "oklch(96% 0.015 256.848)";

const S: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: 14,
  boxShadow: "0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.03)",
  border: "1px solid #e2e8f0",
  padding: "20px 22px",
};

export default function SystemTelemetry() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [stats, setStats] = useState<TelemetryStats>({
    totalDocs: 0,
    totalChunks: 0,
    totalStorage: "0 MB",
    activeMembers: 1,
    healthStatus: "healthy",
    pingMs: null,
  });
  const [loading, setLoading] = useState(true);
  const [testingPing, setTestingPing] = useState(false);

  const fetchMetrics = async () => {
    setLoading(true);
    const startTime = performance.now();
    try {
      const [overviewRes, libraryRes, healthRes] = await Promise.all([
        api.get("/pdf/overview").then(r => r.data).catch(() => null),
        api.get("/pdf/library").then(r => r.data).catch(() => []),
        api.get("/health").then(r => r.data).catch(() => null),
      ]);
      const endTime = performance.now();
      const ping = Math.round(endTime - startTime);

      let totalBytes = 0;
      let totalChunks = 0;
      if (Array.isArray(libraryRes)) {
        libraryRes.forEach((d: any) => {
          totalBytes += d.size_bytes || 0;
          totalChunks += d.ai_chunk_count || 0;
        });
      }

      const mb = (totalBytes / (1024 * 1024)).toFixed(2);

      setStats({
        totalDocs: libraryRes.length || 0,
        totalChunks,
        totalStorage: `${mb} MB`,
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

  useEffect(() => {
    fetchMetrics();
  }, []);

  const runDiagnostic = async () => {
    setTestingPing(true);
    const start = performance.now();
    try {
      await api.get("/health");
      const duration = Math.round(performance.now() - start);
      setStats(prev => ({ ...prev, pingMs: duration, healthStatus: "healthy" }));
      toast.success(`Health Diagnostic Passed! Latency: ${duration}ms`);
    } catch {
      setStats(prev => ({ ...prev, healthStatus: "error" }));
      toast.error("Health Check failed. Backend unreachable.");
    } finally {
      setTestingPing(false);
    }
  };

  if (loading) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "calc(100vh - 60px)", gap: 12 }}>
      <div style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid #e2e8f0", borderTopColor: ACCENT }} className="spin" />
      <p style={{ fontSize: 13, color: "#64748b" }}>Loading system telemetry…</p>
    </div>
  );

  return (
    <div className="animate-in" style={{ padding: "28px 32px", background: "#f8fafc", minHeight: "calc(100vh - 60px)", fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", color: "#0f172a" }}>System Telemetry & Architecture</h1>
          <p style={{ fontSize: 13, color: "#64748b", marginTop: 3 }}>Live technical specs, backend performance metrics, and RAG vector telemetry.</p>
        </div>
        <button
          onClick={runDiagnostic}
          disabled={testingPing}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            background: ACCENT, color: "#fff", border: "none",
            borderRadius: 10, padding: "10px 18px", fontSize: 13, fontWeight: 600,
            cursor: testingPing ? "not-allowed" : "pointer", boxShadow: "0 4px 14px oklch(45% 0.033 256.848 / 0.25)", transition: "all 0.15s",
          }}
        >
          <RefreshCw size={14} className={testingPing ? "spin" : ""} />
          {testingPing ? "Running Diagnostic…" : "Run Diagnostic"}
        </button>
      </div>

      {/* Top Metrics Banner */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 24 }}>
        
        {/* API Ping Latency */}
        <div style={{ ...S, padding: "18px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>API Ping Latency</span>
            <Activity size={16} color={ACCENT} />
          </div>
          <p style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", margin: 0 }}>
            {stats.pingMs !== null ? `${stats.pingMs} ms` : "—"}
          </p>
          <span style={{ fontSize: 11, color: "#16a34a", fontWeight: 600, marginTop: 4, display: "inline-flex", alignItems: "center", gap: 4 }}>
            <CheckCircle2 size={11} /> Roundtrip response time
          </span>
        </div>

        {/* Total Indexed Chunks */}
        <div style={{ ...S, padding: "18px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Vector Chunks</span>
            <Cpu size={16} color="#7c3aed" />
          </div>
          <p style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", margin: 0 }}>
            {stats.totalChunks} Chunks
          </p>
          <span style={{ fontSize: 11, color: "#64748b", fontWeight: 500, marginTop: 4, display: "block" }}>
            Stored in MongoDB Atlas
          </span>
        </div>

        {/* Storage Volume */}
        <div style={{ ...S, padding: "18px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>S3 Storage Used</span>
            <HardDrive size={16} color="#2563eb" />
          </div>
          <p style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", margin: 0 }}>
            {stats.totalStorage}
          </p>
          <span style={{ fontSize: 11, color: "#64748b", fontWeight: 500, marginTop: 4, display: "block" }}>
            Across {stats.totalDocs} PDF documents
          </span>
        </div>

        {/* Quiz Optimization */}
        <div style={{ ...S, padding: "18px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Quiz Review Latency</span>
            <Zap size={16} color="#16a34a" />
          </div>
          <p style={{ fontSize: 24, fontWeight: 800, color: "#16a34a", margin: 0 }}>
            0 ms
          </p>
          <span style={{ fontSize: 11, color: "#15803d", fontWeight: 600, marginTop: 4, display: "block" }}>
            Pre-computed explanation cache
          </span>
        </div>

      </div>

      {/* Specifications Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        
        {/* RAG & Vector Engine Specs */}
        <div style={S}>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
            <Cpu size={18} color={ACCENT} /> RAG & Vector Processing Engine
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 12px", borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
              <span style={{ fontSize: 12.5, color: "#475569" }}>Embedding Transformer Model</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>BAAI/bge-small-en-v1.5</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 12px", borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
              <span style={{ fontSize: 12.5, color: "#475569" }}>Vector Dimensions</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>384 Dimensions</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 12px", borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
              <span style={{ fontSize: 12.5, color: "#475569" }}>Similarity Search Index</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#16a34a" }}>MongoDB Atlas $vectorSearch</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 12px", borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
              <span style={{ fontSize: 12.5, color: "#475569" }}>Fallback Engine</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>Cosine Similarity</span>
            </div>
          </div>
        </div>

        {/* Storage & Cloud Specs */}
        <div style={S}>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
            <Server size={18} color="#2563eb" /> Cloud Infrastructure & Streaming
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 12px", borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
              <span style={{ fontSize: 12.5, color: "#475569" }}>Object Storage Provider</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>AWS S3 Bucket</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 12px", borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
              <span style={{ fontSize: 12.5, color: "#475569" }}>Streaming Protocol</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#16a34a" }}>HTTP 206 Partial Content</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 12px", borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
              <span style={{ fontSize: 12.5, color: "#475569" }}>Server Architecture</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>FastAPI Async ASGI</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 12px", borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
              <span style={{ fontSize: 12.5, color: "#475569" }}>Tenant Isolation</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: ACCENT }}>Workspace Scope Claims</span>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
