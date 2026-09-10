import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Upload, Trash2, Eye, RefreshCw, X, CloudUpload, CheckCircle, Clock, AlertCircle, Loader, Search } from "lucide-react";
import api from "../api/client";
import { useToast } from "../context/ToastContext";

interface Doc { id: string; filename: string; size_bytes: number; uploaded_at: string | null; ai_index_status: string; }

const CHUNK = 5 * 1024 * 1024;
const ACCENT        = "oklch(45% 0.033 256.848)";
const ACCENT_HOVER  = "oklch(52% 0.04 256.848)";
const ACCENT_LIGHT  = "oklch(96% 0.015 256.848)";
const ACCENT_BORDER = "oklch(85% 0.03 256.848)";

const fmt = (b: number) => b < 1024 ? `${b} B` : b < 1024 ** 2 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1024 ** 2).toFixed(1)} MB`;
const fmtD = (s: string | null) => s ? new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

const card: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: 14,
  boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.03)",
  border: "1px solid #e2e8f0",
};

const statusMap: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  ready:      { icon: CheckCircle, color: "#15803d", bg: "#dcfce7", label: "Ready" },
  processing: { icon: Loader,      color: "#a16207", bg: "#fef9c3", label: "Processing" },
  failed:     { icon: AlertCircle, color: "#dc2626", bg: "#fee2e2", label: "Failed" },
  pending:    { icon: Clock,       color: "#71717a", bg: "#f4f4f5", label: "Pending" },
};

export default function LibraryView() {
  const { toast, confirm }          = useToast();
  const [docs, setDocs]             = useState<Doc[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading]       = useState(true);
  const [uploading, setUp]          = useState(false);
  const [progress, setProgress]     = useState(0);
  const [dragOver, setDrag]         = useState(false);
  const [viewer, setViewer]         = useState<{ doc: Doc; url: string } | null>(null);
  const [reindexing, setReindexing] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    setLoading(true);
    api.get("/pdf/library").then(({ data }) => setDocs(data)).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function upload(file: File) {
    if (!file.name.toLowerCase().endsWith(".pdf")) return toast.error("Only PDF files are supported");
    setUp(true); setProgress(0);
    try {
      const { data: init } = await api.post("/pdf/init-upload", { filename: file.name });
      const { uploadId, key } = init;
      const parts: { PartNumber: number; ETag: string }[] = [];
      const total = Math.ceil(file.size / CHUNK);
      for (let i = 0; i < total; i++) {
        const form = new FormData();
        form.append("partNumber", String(i + 1));
        form.append("uploadId", uploadId);
        form.append("key", key);
        form.append("file", file.slice(i * CHUNK, (i + 1) * CHUNK));
        const { data: p } = await api.post("/pdf/upload-part", form);
        parts.push({ PartNumber: p.partNumber, ETag: p.etag });
        setProgress(Math.round(((i + 1) / total) * 100));
      }
      await api.post("/pdf/complete-upload", { key, uploadId, parts });
      toast.success(`"${file.name}" uploaded successfully.`);
      load();
    } catch (e: any) { toast.error(e.response?.data?.detail || "Upload failed"); }
    finally { setUp(false); setProgress(0); }
  }

  async function openViewer(doc: Doc) {
    const token = localStorage.getItem("token");
    const res = await fetch(`${api.defaults.baseURL}/pdf/stream/${encodeURIComponent(doc.filename)}`, { headers: { Authorization: `Bearer ${token}` } });
    const blob = await res.blob();
    setViewer({ doc, url: URL.createObjectURL(blob) });
  }

  function closeViewer() { if (viewer) URL.revokeObjectURL(viewer.url); setViewer(null); }

  async function del(doc: Doc) {
    confirm({
      title: "Delete document?",
      message: `Are you sure you want to delete "${doc.filename}"? This action cannot be undone.`,
      confirmText: "Delete PDF",
      danger: true,
      onConfirm: async () => {
        try {
          await api.delete(`/pdf/delete/${doc.id}`);
          toast.success(`Deleted "${doc.filename}"`);
          load();
        } catch (e: any) {
          toast.error("Failed to delete document");
        }
      },
    });
  }

  async function reindex(doc: Doc) {
    setReindexing(doc.id);
    toast.info(`Processing "${doc.filename}"…`);
    await api.post(`/ai/ingest/${doc.id}`).catch(() => {});
    await load();
    setReindexing(null);
    toast.success(`Processed "${doc.filename}" successfully.`);
  }

  const filteredDocs = docs.filter(d => d.filename.toLowerCase().includes(searchQuery.toLowerCase()));

  // ── PDF Viewer Modal ──
  if (viewer) return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.8)", zIndex: 100, display: "flex", flexDirection: "column" }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 24px", background: "#fff", borderBottom: "1px solid #e2e8f0", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: ACCENT_LIGHT, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <FileText size={16} color={ACCENT} />
          </div>
          <div>
            <p style={{ fontWeight: 700, fontSize: 13, color: "#0f172a", margin: 0 }}>{viewer.doc.filename}</p>
            <p style={{ fontSize: 11, color: "#64748b", margin: 0 }}>{fmt(viewer.doc.size_bytes)} · PDF Preview</p>
          </div>
        </div>
        <button onClick={closeViewer} style={{ background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 14px", cursor: "pointer", color: "#0f172a", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
          <X size={14} /> Close
        </button>
      </div>
      <iframe src={viewer.url} style={{ flex: 1, border: "none", width: "100%", height: "100%" }} title="PDF Preview" />
    </div>
  );

  return (
    <div className="animate-in" style={{ padding: "28px 32px", background: "#f8fafc", minHeight: "calc(100vh - 60px)", fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", color: "#0f172a" }}>Library</h1>
          <p style={{ fontSize: 13, color: "#64748b", marginTop: 3 }}>Upload, manage, and search your PDF documents.</p>
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            background: ACCENT, color: "#fff", border: "none",
            borderRadius: 10, padding: "10px 18px", fontSize: 13, fontWeight: 600,
            cursor: "pointer", boxShadow: "0 4px 14px oklch(45% 0.033 256.848 / 0.3)", transition: "all 0.15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = ACCENT_HOVER; e.currentTarget.style.transform = "translateY(-1px)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = ACCENT; e.currentTarget.style.transform = "none"; }}
        >
          <Upload size={14} /> Upload PDF
        </button>
        <input ref={fileRef} type="file" accept=".pdf" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); }} />
      </div>

      {/* Drag & drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) upload(f); }}
        onClick={() => !uploading && fileRef.current?.click()}
        style={{
          ...card,
          border: `2px dashed ${dragOver ? ACCENT : "#cbd5e1"}`,
          background: dragOver ? ACCENT_LIGHT : "#ffffff",
          padding: "24px 32px", textAlign: "center", cursor: "pointer",
          marginBottom: 24, transition: "all 0.15s",
        }}
      >
        {uploading ? (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 10 }}>
              <Loader size={18} color={ACCENT} className="spin" />
              <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>Uploading PDF… {progress}%</span>
            </div>
            <div style={{ height: 6, width: 240, background: "#e2e8f0", borderRadius: 99, margin: "0 auto", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${progress}%`, background: ACCENT, borderRadius: 99, transition: "width 0.2s" }} />
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14 }}>
            <span style={{ display: "inline-flex", width: 42, height: 42, borderRadius: 10, border: `1px solid ${ACCENT_BORDER}`, background: ACCENT_LIGHT, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <CloudUpload size={20} color={ACCENT} />
            </span>
            <div style={{ textAlign: "left" }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 2 }}>
                Drop a PDF here, or click to browse
              </p>
              <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>
                Files are stored securely and prepared for instant questions
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Filter / Search Bar */}
      {docs.length > 0 && (
        <div style={{ marginBottom: 14, display: "flex", justifyContent: "flex-end" }}>
          <div style={{ position: "relative", width: 280 }}>
            <Search size={14} color="#94a3b8" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search library documents…"
              style={{
                width: "100%", boxSizing: "border-box", padding: "8px 12px 8px 34px", borderRadius: 8,
                border: "1px solid #cbd5e1", background: "#ffffff", fontSize: 12.5, color: "#0f172a", outline: "none",
              }}
            />
          </div>
        </div>
      )}

      {/* Document list */}
      <div style={card}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 110px 110px 140px 110px", padding: "12px 20px", borderBottom: "1px solid #f1f5f9", background: "#f8fafc", borderRadius: "14px 14px 0 0" }}>
          {["File Name", "Size", "Status", "Uploaded", "Actions"].map(h => (
            <p key={h} style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#94a3b8" }}>{h}</p>
          ))}
        </div>

        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 110px 110px 140px 110px", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid #f8fafc" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "#f1f5f9" }} className="spin" />
                <div style={{ height: 14, width: 140, background: "#f1f5f9", borderRadius: 4 }} />
              </div>
              <div style={{ height: 12, width: 50, background: "#f1f5f9", borderRadius: 4 }} />
              <div style={{ height: 12, width: 60, background: "#f1f5f9", borderRadius: 4 }} />
              <div style={{ height: 12, width: 80, background: "#f1f5f9", borderRadius: 4 }} />
              <div style={{ height: 12, width: 40, background: "#f1f5f9", borderRadius: 4 }} />
            </div>
          ))
        ) : filteredDocs.length === 0 ? (
          <div style={{ padding: "48px 20px", textAlign: "center" }}>
            <FileText size={30} color="#cbd5e1" style={{ margin: "0 auto 10px" }} />
            <p style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>
              {searchQuery ? "No matching documents found" : "No documents in library"}
            </p>
            <p style={{ fontSize: 12, color: "#64748b" }}>
              {searchQuery ? `No PDF matches "${searchQuery}"` : "Upload your first PDF to begin asking questions and generating quizzes."}
            </p>
          </div>
        ) : (
          filteredDocs.map((doc, idx) => {
            const statusKey = (doc.ai_index_status || "ready").toLowerCase();
            const status = statusMap[statusKey] || statusMap.ready;
            const StatusIcon = status.icon;
            const isReindexing = reindexing === doc.id;

            return (
              <div key={doc.id} style={{
                display: "grid", gridTemplateColumns: "1fr 110px 110px 140px 110px",
                alignItems: "center", padding: "14px 20px",
                borderBottom: idx < filteredDocs.length - 1 ? "1px solid #f8fafc" : "none",
                transition: "background 0.15s",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                {/* Name */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: ACCENT_LIGHT, border: `1px solid ${ACCENT_BORDER}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <FileText size={15} color={ACCENT} />
                  </div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {doc.filename}
                  </p>
                </div>

                {/* Size */}
                <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>{fmt(doc.size_bytes)}</p>

                {/* Status */}
                <div>
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 99,
                    background: status.bg, color: status.color,
                  }}>
                    <StatusIcon size={11} className={statusKey === "processing" || isReindexing ? "spin" : ""} />
                    {isReindexing ? "Indexing…" : status.label}
                  </span>
                </div>

                {/* Uploaded */}
                <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>{fmtD(doc.uploaded_at)}</p>

                {/* Actions */}
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <button
                    onClick={() => openViewer(doc)}
                    title="View PDF"
                    style={{ background: "#f1f5f9", border: "none", borderRadius: 6, padding: 6, cursor: "pointer", color: "#64748b", display: "flex", transition: "all 0.15s" }}
                    onMouseEnter={e => { e.currentTarget.style.background = ACCENT_LIGHT; e.currentTarget.style.color = ACCENT; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "#f1f5f9"; e.currentTarget.style.color = "#64748b"; }}
                  >
                    <Eye size={14} />
                  </button>
                  <button
                    onClick={() => reindex(doc)}
                    disabled={isReindexing}
                    title="Re-process PDF"
                    style={{ background: "#f1f5f9", border: "none", borderRadius: 6, padding: 6, cursor: "pointer", color: "#64748b", display: "flex", transition: "all 0.15s" }}
                    onMouseEnter={e => { e.currentTarget.style.background = ACCENT_LIGHT; e.currentTarget.style.color = ACCENT; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "#f1f5f9"; e.currentTarget.style.color = "#64748b"; }}
                  >
                    <RefreshCw size={14} className={isReindexing ? "spin" : ""} />
                  </button>
                  <button
                    onClick={() => del(doc)}
                    title="Delete PDF"
                    style={{ background: "#f1f5f9", border: "none", borderRadius: 6, padding: 6, cursor: "pointer", color: "#64748b", display: "flex", transition: "all 0.15s" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "#fee2e2"; e.currentTarget.style.color = "#dc2626"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "#f1f5f9"; e.currentTarget.style.color = "#64748b"; }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
