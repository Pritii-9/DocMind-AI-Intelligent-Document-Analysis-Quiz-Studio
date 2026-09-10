import { useEffect, useState } from "react";
import { FileText, Users, HardDrive, Clock, Upload, ArrowRight } from "lucide-react";
import api from "../api/client";

interface Stats { total_documents: number; active_members: number; total_storage_bytes: number; last_upload_at: string | null; }
interface Doc { id: string; filename: string; size_bytes: number; uploaded_at: string | null; ai_index_status: string; }
interface ActivityItem { type: string; title: string; timestamp: string | null; actor: string | null; }

const fmt  = (b: number) => b < 1024 ? `${b} B` : b < 1024**2 ? `${(b/1024).toFixed(1)} KB` : `${(b/1024**2).toFixed(1)} MB`;
const fmtD = (s: string | null) => s ? new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
const fmtR = (s: string | null) => {
  if (!s) return "—";
  const m = Math.floor((Date.now() - new Date(s).getTime()) / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return fmtD(s);
};

const statusBadge: Record<string, { cls: string; label: string }> = {
  ready:      { cls: "bg-green-100 text-green-700",   label: "Ready"      },
  processing: { cls: "bg-yellow-100 text-yellow-700", label: "Processing" },
  failed:     { cls: "bg-red-100 text-red-600",       label: "Failed"     },
  pending:    { cls: "bg-slate-100 text-slate-500",   label: "Pending"    },
};

const cardCls = "bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden";

export default function Dashboard({ onNavigate }: { onNavigate: (t: any) => void }) {
  const [stats, setStats]       = useState<Stats | null>(null);
  const [docs, setDocs]         = useState<Doc[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    api.get("/pdf/overview")
      .then(({ data }) => { setStats(data.stats); setDocs(data.documents); setActivity(data.activity); })
      .finally(() => setLoading(false));
  }, []);

  const kpis = [
    { label: "Total PDFs",     value: stats?.total_documents ?? 0,         icon: FileText,  iconCls: "text-[var(--brand)]",  bgCls: "bg-[var(--brand-light)]",  trend: "In library"           },
    { label: "Active Members", value: stats?.active_members ?? 0,           icon: Users,     iconCls: "text-teal-600",        bgCls: "bg-teal-50",               trend: "Workspace team"        },
    { label: "Storage",        value: fmt(stats?.total_storage_bytes ?? 0), icon: HardDrive, iconCls: "text-amber-600",       bgCls: "bg-amber-50",              trend: "Encrypted S3 storage"  },
    { label: "Recent Upload",  value: fmtR(stats?.last_upload_at ?? null),  icon: Clock,     iconCls: "text-slate-500",       bgCls: "bg-slate-100",             trend: "Last document added"   },
  ];

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-[80vh] gap-3">
      <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-[var(--brand)] spin" />
      <p className="text-[13px] text-slate-500">Loading dashboard…</p>
    </div>
  );

  return (
    <div className="animate-in p-7 bg-slate-50 min-h-[calc(100vh-60px)] font-[Inter,system-ui,sans-serif]">

      {/* Header */}
      <div className="flex items-end justify-between mb-7">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-slate-900">Overview</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">Here's what's happening across your workspace today.</p>
        </div>
        <button
          onClick={() => onNavigate("library")}
          className="flex items-center gap-2 text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl border-none cursor-pointer transition-all duration-150 hover:-translate-y-px"
          style={{ background: "var(--brand)", boxShadow: "0 4px 14px rgba(61,79,110,0.3)" }}
          onMouseEnter={e => (e.currentTarget.style.background = "var(--brand-hover)")}
          onMouseLeave={e => (e.currentTarget.style.background = "var(--brand)")}
        >
          <Upload size={14} /> Upload PDF
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {kpis.map(k => (
          <div
            key={k.label}
            className={`${cardCls} p-5 flex items-center gap-4 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md cursor-default`}
          >
            <span className={`inline-flex shrink-0 w-11 h-11 rounded-full items-center justify-center ${k.bgCls}`}>
              <k.icon size={19} className={k.iconCls} />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-0.5">{k.label}</p>
              <p className="text-[22px] font-extrabold tracking-tight text-slate-900 leading-none">{k.value}</p>
              <p className="text-[11px] text-slate-400 mt-1">{k.trend}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-2 gap-4">

        {/* Recent Documents */}
        <div className={cardCls}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <span className="text-[14px] font-bold text-slate-900">Recent documents</span>
            <button
              onClick={() => onNavigate("library")}
              className="flex items-center gap-1 text-xs text-slate-400 bg-transparent border-none cursor-pointer font-semibold hover:text-[var(--brand)] transition-colors"
            >
              View library <ArrowRight size={12} />
            </button>
          </div>
          <div className="py-2">
            {docs.length === 0 ? (
              <div className="py-9 px-5 text-center">
                <FileText size={28} className="text-slate-300 mx-auto mb-2" />
                <p className="text-[13px] text-slate-500">No documents uploaded yet</p>
              </div>
            ) : (
              docs.slice(0, 5).map(doc => {
                const st = statusBadge[(doc.ai_index_status || "ready").toLowerCase()] || statusBadge.ready;
                return (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--brand-light)" }}>
                        <FileText size={15} style={{ color: "var(--brand)" }} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-slate-900 truncate">{doc.filename}</p>
                        <p className="text-[11px] text-slate-400">{fmt(doc.size_bytes)} · {fmtD(doc.uploaded_at)}</p>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Activity feed */}
        <div className={cardCls}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <span className="text-[14px] font-bold text-slate-900">Workspace activity</span>
            <span className="text-[11px] text-slate-400 font-semibold">Recent events</span>
          </div>
          <div className="py-2">
            {activity.length === 0 ? (
              <div className="py-9 px-5 text-center">
                <Clock size={28} className="text-slate-300 mx-auto mb-2" />
                <p className="text-[13px] text-slate-500">No recent activity</p>
              </div>
            ) : (
              activity.slice(0, 5).map((act, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 px-5 py-3 hover:bg-slate-50 transition-colors"
                >
                  <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: "var(--brand)" }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-slate-900 font-medium">{act.title}</p>
                    <p className="text-[11px] text-slate-400">
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
