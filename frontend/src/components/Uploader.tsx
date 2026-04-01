import { FileUp, LoaderCircle, Shield, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

import { API_BASE_URL } from "../api/axios";

type UploaderProps = {
  onUploadComplete?: (uploadedFileName?: string) => void;
};

function formatBytes(value: number) {
  if (!value) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export default function Uploader({ onUploadComplete }: UploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileSummary = useMemo(() => {
    if (!file) return "PDF documents only";
    return `${file.name} • ${formatBytes(file.size)}`;
  }, [file]);

  const handleUpload = async () => {
    if (!file) return;

    const token = localStorage.getItem("access_token");
    if (!token) {
      setError("No active session found. Please sign in again.");
      return;
    }

    if (file.type !== "application/pdf") {
      setError("Only PDF files are allowed.");
      return;
    }

    setIsUploading(true);
    setProgress(0);
    setError(null);
    setMessage(null);

    try {
      const initRes = await fetch(`${API_BASE_URL}/pdf/init-upload`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ filename: file.name }),
      });
      const initData = await initRes.json();
      if (!initRes.ok) {
        throw new Error(initData?.msg || "Failed to initialize upload.");
      }

      const { uploadId, key, fileName } = initData;
      const chunkSize = 5 * 1024 * 1024;
      const totalParts = Math.ceil(file.size / chunkSize);
      const parts: { PartNumber: number; ETag: string }[] = [];

      for (let index = 0; index < totalParts; index += 1) {
        const chunk = file.slice(index * chunkSize, (index + 1) * chunkSize);
        const formData = new FormData();
        formData.append("file", chunk);
        formData.append("partNumber", String(index + 1));
        formData.append("uploadId", uploadId);
        formData.append("key", key);

        const partRes = await fetch(`${API_BASE_URL}/pdf/upload-part`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        const partData = await partRes.json();
        if (!partRes.ok) {
          throw new Error(partData?.msg || "Failed to upload document chunk.");
        }

        parts.push({ PartNumber: index + 1, ETag: partData.etag });
        setProgress(Math.round(((index + 1) / totalParts) * 100));
      }

      const completeRes = await fetch(`${API_BASE_URL}/pdf/complete-upload`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ key, uploadId, parts }),
      });
      const completeData = await completeRes.json();
      if (!completeRes.ok) {
        throw new Error(completeData?.msg || "Failed to complete upload.");
      }

      setMessage("Upload completed and indexed in the workspace.");
      setFile(null);
      onUploadComplete?.(fileName);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="rounded-[2rem] border border-black/5 bg-[var(--panel)] p-5 shadow-sm dark:border-white/10">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
            <Shield size={14} />
            Secure Transfer
          </div>
          <h3 className="mt-4 font-display text-2xl font-semibold text-[var(--text-strong)]">
            Upload and index new documents
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-soft)]">
            Large files are split into resilient chunks, stored in S3, then registered for workspace analytics and fast streaming.
          </p>
        </div>

        <div className="rounded-3xl border border-dashed border-[var(--border-strong)] bg-[var(--panel-muted)] p-4 lg:w-[22rem]">
          <label className="flex cursor-pointer flex-col gap-3 rounded-2xl border border-transparent p-3 transition hover:border-[var(--accent)]/30 hover:bg-white/40 dark:hover:bg-white/5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[var(--accent)] shadow-sm dark:bg-slate-900">
                <FileUp size={20} />
              </div>
              <div className="min-w-0">
                <p className="truncate font-semibold text-[var(--text-strong)]">{file ? "Ready to upload" : "Choose a PDF"}</p>
                <p className="truncate text-sm text-[var(--text-soft)]">{fileSummary}</p>
              </div>
            </div>
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
            />
          </label>

          <button
            type="button"
            disabled={isUploading || !file}
            onClick={handleUpload}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isUploading ? <LoaderCircle size={18} className="animate-spin" /> : <Sparkles size={18} />}
            {isUploading ? `Uploading ${progress}%` : "Start secure upload"}
          </button>

          <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
            <div
              className="h-full rounded-full bg-[var(--accent)] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>

          {message ? <p className="mt-3 text-sm font-medium text-emerald-600">{message}</p> : null}
          {error ? <p className="mt-3 text-sm font-medium text-rose-600">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
