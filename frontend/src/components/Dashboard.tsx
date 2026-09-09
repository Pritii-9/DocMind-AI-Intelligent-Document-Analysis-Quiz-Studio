import { useEffect, useState } from "react";
import { FileText, Users, HardDrive, Clock, Upload, ArrowRight } from "lucide-react";
import api from "../api/client";

interface Stats { total_documents: number; active_members: number; total_storage_bytes: number; last_upload_at: string | null; }
interface Doc { id: string; filename: string; size_bytes: number; uploaded_at: string | null; ai_index_status: string; }
interface ActivityItem { type: string; title: string; timestamp: string | null; actor: string | null; }

const ACCENT        = "oklch(45% 0.033 256.848)";
const ACCENT_HOVER  = "oklch(52% 0.04 256.848)";
const ACCENT_LIGHT  = "oklch(96% 0.015 256.848)";
const ACCENT_BORDER = "oklch(85% 0.03 256.848)";

const fmt = (b: number) => b < 1024 ? `${b} B` : b < 1024 ** 2 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1024 ** 2).toFixed(1)} MB`;
const fmtD = (s: string | null) => s ? new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
const fmtR = (s: string | null) => {
  if (!s) return "—";
  const diff = Date.now() - new Date(s).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return fmtD(s);
};

const card: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: 14,
  boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.03)",
  border: "1px solid #e2e8f0",
  overflow: "hidden",
};

const statusStyle: Record<string, { bg: string; color: string; label: string }> = {
  ready:      { bg: "#dcfce7", color: "#15803d", label: "Ready" },
  processing: { bg: "#fef9c3", color: "#a16207", label: "Processing" },
  failed:     { bg: "#fee2e2", color: "#dc2626", label: "Failed" },
  pending:    { bg: "#f4f4f5", color: "#71717a", label: "Pending" },
};

export default function Dashboard({ onNavigate }: { onNavigate: (t: any) => void }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [docs,  setDocs]  = useState<Doc[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/pdf/overview")
      .then(({ data }) => { setStats(data.stats); setDocs(data.documents); setActivity(data.activity); })
      .finally(() => setLoading(false));
  }, []);

  const kpis = [
    { label: "Total PDFs",     value: stats?.total_documents ?? 0,         icon: FileText,  iconColor: ACCENT,     iconBg: ACCENT_LIGHT, iconBorder: ACCENT_BORDER, trend: "In library" },
    { label: "Active Members", value: stats?.active_members ?? 0,           icon: Users,     iconColor: "#0d9488",  iconBg: "#ccfbf1",    iconBorder: "#99f6e4",    trend: "Workspace team" },
    { label: "Storage",        value: fmt(stats?.total_storage_bytes ?? 0), icon: HardDrive, iconColor: "#d97706",  iconBg: "#fef3c7",    iconBorder: "#fde68a",    trend: "Encrypted S3 storage" },
    { label: "Recent Upload",  value: fmtR(stats?.last_upload_at ?? null),  icon: Clock,     iconColor: "#64748b",  iconBg: "#f1f5f9",    iconBorder: "#e2e8f0",    trend: "Last document added" },
  ];

  if (loading) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "80vh", gap: 12 }}>
      <div style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid #e2e8f0", borderTopColor: ACCENT }} className="spin" />
      <p style={{ fontSize: 13, color: "#64748b" }}>Loading dashboard…</p>
    </div>
  );

  return (
    <div className="animate-in" style={{ padding: "28px 32px", background: "#f8fafc", minHeight: "calc(100vh - 60px)", fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", color: "#0f172a" }}>Overview</h1>
          <p style={{ fontSize: 13, color: "#64748b", marginTop: 3 }}>Here's what's happening across your workspace today.</p>
        </div>
        <button
          onClick={() => onNavigate("library")}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            background: ACCENT, color: "#fff",
            border: "none", borderRadius: 10,
            padding: "10px 18px", fontSize: 13, fontWeight: 600,
            cursor: "pointer",
            boxShadow: "0 4px 14px oklch(45% 0.033 256.848 / 0.3)",
            transition: "all 0.15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = ACCENT_HOVER; e.currentTarget.style.transform = "translateY(-1px)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = ACCENT; e.currentTarget.style.transform = "none"; }}
        >
          <Upload size={14} /> Upload PDF
        </button>
      </div>

      {/* KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        {kpis.map(k => (
          <div key={k.label} style={{
            ...card,
            padding: "20px 20px 18px",
            display: "flex", alignItems: "center", gap: 16,
            transition: "box-shadow 0.15s, transform 0.15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06)"; e.currentTarget.style.transform = "none"; }}
          >
            <span style={{
              display: "inline-flex", flexShrink: 0,
              width: 44, height: 44, borderRadius: "50%",
              border: `1px solid ${k.iconBorder}`,
              background: k.iconBg,
              alignItems: "center", justifyContent: "center",
            }}>
              <k.icon size={19} color={k.iconColor} />
            </span>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "#94a3b8", marginBottom: 3 }}>
                {k.label}
              </p>
              <p style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em", color: "#0f172a", lineHeight: 1 }}>
                {k.value}
              </p>
              <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{k.trend}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Content grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>

        {/* Recent Documents */}
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #f1f5f9" }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>Recent documents</span>
            <button
              onClick={() => onNavigate("library")}
              style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#94a3b8", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
              onMouseEnter={e => e.currentTarget.style.color = ACCENT}
              onMouseLeave={e => e.currentTarget.style.color = "#94a3b8"}
            >
              View library <ArrowRight size={12} />
            </button>
          </div>

          <div style={{ padding: "8px 0" }}>
            {docs.length === 0 ? (
              <div style={{ padding: "36px 20px", textAlign: "center" }}>
                <FileText size={28} color="#cbd5e1" style={{ margin: "0 auto 8px" }} />
                <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>No documents uploaded yet</p>
              </div>
            ) : (
              docs.slice(0, 5).map(doc => {
                const stKey = (doc.ai_index_status || "ready").toLowerCase();
                const st = statusStyle[stKey] || statusStyle.ready;
                return (
                  <div key={doc.id} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "11px 20px", transition: "background 0.15s",
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: ACCENT_LIGHT, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <FileText size={15} color={ACCENT} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {doc.filename}
                        </p>
                        <p style={{ fontSize: 11, color: "#94a3b8", margin: 0 }}>{fmt(doc.size_bytes)} · {fmtD(doc.uploaded_at)}</p>
                      </div>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: st.bg, color: st.color }}>
                      {st.label}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Activity Feed */}
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #f1f5f9" }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>Workspace activity</span>
            <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>Recent events</span>
          </div>

          <div style={{ padding: "8px 0" }}>
            {activity.length === 0 ? (
              <div style={{ padding: "36px 20px", textAlign: "center" }}>
                <Clock size={28} color="#cbd5e1" style={{ margin: "0 auto 8px" }} />
                <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>No recent activity</p>
              </div>
            ) : (
              activity.slice(0, 5).map((act, idx) => (
                <div key={idx} style={{
                  display: "flex", alignItems: "flex-start", gap: 12,
                  padding: "11px 20px", transition: "background 0.15s",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: ACCENT, marginTop: 6, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, color: "#0f172a", fontWeight: 500, margin: 0 }}>{act.title}</p>
                    <p style={{ fontSize: 11, color: "#94a3b8", margin: 0 }}>
                      {act.actor ? `${act.actor} · ` : ""}{fmtR(act.timestamp)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
