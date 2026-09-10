import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Upload, Trash2, Eye, RefreshCw, X, CloudUpload, CheckCircle, Clock, AlertCircle, Loader, Search } from "lucide-react";
import api from "../api/client";
import { useToast } from "../context/ToastContext";

interface Doc { id: string; filename: string; size_bytes: number; uploaded_at: string | null; ai_index_status: string; }

const CHUNK = 5 * 1024 * 1024;
const fmt  = (b: number) => b < 1024 ? `${b} B` : b < 1024**2 ? `${(b/1024).toFixed(1)} KB` : `${(b/1024**2).toFixed(1)} MB`;
const fmtD = (s: string | null) => s ? new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

const cardCls = "bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden";

const statusMap: Record<string, { icon: any; colorCls: string; bgCls: string; label: string }> = {
  ready:      { icon: CheckCircle,  colorCls: "text-green-700",  bgCls: "bg-green-100 text-green-700",  label: "Ready"      },
  processing: { icon: Loader,       colorCls: "text-yellow-700", bgCls: "bg-yellow-100 text-yellow-700", label: "Processing" },
  failed:     { icon: AlertCircle,  colorCls: "text-red-600",    bgCls: "bg-red-100 text-red-600",       label: "Failed"     },
  pending:    { icon: Clock,        colorCls: "text-slate-500",  bgCls: "bg-slate-100 text-slate-500",   label: "Pending"    },
};

export default function LibraryView() {
  const { toast, confirm }              = useToast();
  const [docs, setDocs]                 = useState<Doc[]>([]);
  const [searchQuery, setSearchQuery]   = useState("");
  const [loading, setLoading]           = useState(true);
  const [uploading, setUp]              = useState(false);
  const [progress, setProgress]         = useState(0);
  const [dragOver, setDrag]             = useState(false);
  const [viewer, setViewer]             = useState<{ doc: Doc; url: string } | null>(null);
  const [reindexing, setReindexing]     = useState<string | null>(null);
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
    const res = await fetch(`${api.defaults.baseURL}/pdf/stream/${encodeURIComponent(doc.filename)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
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
        try { await api.delete(`/pdf/delete/${doc.id}`); toast.success(`Deleted "${doc.filename}"`); load(); }
        catch { toast.error("Failed to delete document"); }
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

  // PDF viewer modal
  if (viewer) return (
    <div className="fixed inset-0 bg-slate-900/80 z-50 flex flex-col">
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--brand-light)" }}>
            <FileText size={16} style={{ color: "var(--brand)" }} />
          </div>
          <div>
            <p className="font-bold text-[13px] text-slate-900">{viewer.doc.filename}</p>
            <p className="text-[11px] text-slate-500">{fmt(viewer.doc.size_bytes)} · PDF Preview</p>
          </div>
        </div>
        <button
          onClick={closeViewer}
          className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded-lg px-3.5 py-1.5 cursor-pointer text-slate-800 text-xs font-semibold hover:bg-slate-200 transition-colors"
        >
          <X size={14} /> Close
        </button>
      </div>
      <iframe src={viewer.url} className="flex-1 border-0 w-full h-full" title="PDF Preview" />
    </div>
  );

  return (
    <div className="animate-in p-7 bg-slate-50 min-h-[calc(100vh-60px)] font-[Inter,system-ui,sans-serif]">

      {/* Header */}
      <div className="flex items-end justify-between mb-7">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-slate-900">Library</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">Upload, manage, and search your PDF documents.</p>
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-2 text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl border-none cursor-pointer transition-all duration-150 hover:-translate-y-px"
          style={{ background: "var(--brand)", boxShadow: "0 4px 14px rgba(61,79,110,0.3)" }}
          onMouseEnter={e => (e.currentTarget.style.background = "var(--brand-hover)")}
          onMouseLeave={e => (e.currentTarget.style.background = "var(--brand)")}
        >
          <Upload size={14} /> Upload PDF
        </button>
        <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); }} />
      </div>

      {/* Drag & drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) upload(f); }}
        onClick={() => !uploading && fileRef.current?.click()}
        className={[
          "rounded-2xl border-2 border-dashed px-8 py-6 text-center cursor-pointer mb-6 transition-all duration-150",
          dragOver
            ? "border-[var(--brand)] bg-[var(--brand-light)]"
            : "border-slate-300 bg-white hover:border-[var(--brand)] hover:bg-[var(--brand-light)]",
        ].join(" ")}
      >
        {uploading ? (
          <div>
            <div className="flex items-center justify-center gap-2.5 mb-2.5">
              <Loader size={18} style={{ color: "var(--brand)" }} className="spin" />
              <span className="text-sm font-bold text-slate-900">Uploading PDF… {progress}%</span>
            </div>
            <div className="h-1.5 w-60 bg-slate-200 rounded-full mx-auto overflow-hidden">
              <div className="h-full rounded-full transition-[width] duration-200" style={{ width: `${progress}%`, background: "var(--brand)" }} />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-3.5">
            <span className="inline-flex w-[42px] h-[42px] rounded-[10px] border items-center justify-center shrink-0" style={{ borderColor: "var(--brand-border)", background: "var(--brand-light)" }}>
              <CloudUpload size={20} style={{ color: "var(--brand)" }} />
            </span>
            <div className="text-left">
              <p className="text-sm font-bold text-slate-900 mb-0.5">Drop a PDF here, or click to browse</p>
              <p className="text-xs text-slate-500">Files are stored securely and prepared for instant questions</p>
            </div>
          </div>
        )}
      </div>

      {/* Search bar */}
      {docs.length > 0 && (
        <div className="mb-3.5 flex justify-end">
          <div className="relative w-[280px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search library documents…"
              className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-300 bg-white text-[12.5px] text-slate-900 outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/15 transition-colors"
            />
          </div>
        </div>
      )}

      {/* Document table */}
      <div className={cardCls}>
        <div className="grid gap-4 px-5 py-3 border-b border-slate-100 bg-slate-50 rounded-t-2xl" style={{ gridTemplateColumns: "1fr 110px 110px 140px 110px" }}>
          {["File Name", "Size", "Status", "Uploaded", "Actions"].map(h => (
            <p key={h} className="text-[10px] font-bold tracking-widest uppercase text-slate-400 m-0">{h}</p>
          ))}
        </div>

        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="grid items-center px-5 py-4 border-b border-slate-50 gap-4" style={{ gridTemplateColumns: "1fr 110px 110px 140px 110px" }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-100 animate-pulse" />
                <div className="h-3.5 w-36 bg-slate-100 rounded animate-pulse" />
              </div>
              {[50, 60, 80, 40].map((w, j) => (
                <div key={j} className="h-3 rounded animate-pulse bg-slate-100" style={{ width: w }} />
              ))}
            </div>
          ))
        ) : filteredDocs.length === 0 ? (
          <div className="py-12 px-5 text-center">
            <FileText size={30} className="text-slate-300 mx-auto mb-2.5" />
            <p className="text-sm font-bold text-slate-900 mb-1">
              {searchQuery ? "No matching documents found" : "No documents in library"}
            </p>
            <p className="text-xs text-slate-500">
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
              <div
                key={doc.id}
                className="grid items-center px-5 py-3.5 gap-4 hover:bg-slate-50 transition-colors"
                style={{
                  gridTemplateColumns: "1fr 110px 110px 140px 110px",
                  borderBottom: idx < filteredDocs.length - 1 ? "1px solid #f8fafc" : "none",
                }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center border" style={{ background: "var(--brand-light)", borderColor: "var(--brand-border)" }}>
                    <FileText size={15} style={{ color: "var(--brand)" }} />
                  </div>
                  <p className="text-[13px] font-semibold text-slate-900 truncate">{doc.filename}</p>
                </div>

                <p className="text-xs text-slate-500">{fmt(doc.size_bytes)}</p>

                <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${status.bgCls}`}>
                  <StatusIcon size={11} className={statusKey === "processing" || isReindexing ? "spin" : ""} />
                  {isReindexing ? "Indexing…" : status.label}
                </span>

                <p className="text-xs text-slate-500">{fmtD(doc.uploaded_at)}</p>

                <div className="flex items-center gap-1.5">
                  {[
                    { onClick: () => openViewer(doc), title: "View PDF", icon: Eye, danger: false },
                    { onClick: () => reindex(doc), title: "Re-process", icon: RefreshCw, danger: false, disabled: isReindexing, spin: isReindexing },
                    { onClick: () => del(doc), title: "Delete PDF", icon: Trash2, danger: true },
                  ].map((btn, bi) => (
                    <button
                      key={bi}
                      onClick={btn.onClick}
                      title={btn.title}
                      disabled={"disabled" in btn ? btn.disabled : false}
                      className={`flex items-center justify-center p-1.5 rounded-md border-none cursor-pointer text-slate-500 bg-slate-100 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${
                        btn.danger
                          ? "hover:bg-red-50 hover:text-red-600"
                          : "hover:bg-[var(--brand-light)] hover:text-[var(--brand)]"
                      }`}
                    >
                      <btn.icon size={14} className={"spin" in btn && btn.spin ? "spin" : ""} />
                    </button>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
