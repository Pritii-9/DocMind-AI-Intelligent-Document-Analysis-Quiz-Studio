import { useState } from "react";

import { API_BASE_URL } from "../api/axios";

type UploaderProps = {
  onUploadComplete?: () => void;
};

export default function Uploader({ onUploadComplete }: UploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  const handleUpload = async () => {
    if (!file) return;

    const token = localStorage.getItem("access_token");
    if (!token) {
      setError("No active session found. Please login again.");
      return;
    }

    if (file.type !== "application/pdf") {
      setError("Only PDF files are allowed.");
      return;
    }

    setIsUploading(true);
    setProgress(0);
    setError("");

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
      if (!initRes.ok) throw new Error(initData?.msg || "Failed to initialize upload.");

      const { uploadId, key } = initData;
      const CHUNK_SIZE = 5 * 1024 * 1024;
      const totalParts = Math.ceil(file.size / CHUNK_SIZE);
      const parts = [];

      for (let i = 0; i < totalParts; i++) {
        const chunk = file.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        const formData = new FormData();
        formData.append("file", chunk);
        formData.append("partNumber", (i + 1).toString());
        formData.append("uploadId", uploadId);
        formData.append("key", key);

        const partRes = await fetch(`${API_BASE_URL}/pdf/upload-part`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        const partData = await partRes.json();
        if (!partRes.ok) throw new Error(partData?.msg || "Failed to upload file part.");

        parts.push({ PartNumber: i + 1, ETag: partData.etag });
        setProgress(Math.round(((i + 1) / totalParts) * 100));
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
      if (!completeRes.ok) throw new Error(completeData?.msg || "Failed to complete upload.");

      setFile(null);
      onUploadComplete?.();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Upload failed.";
      setError(message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="relative group border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-10 bg-slate-50 dark:bg-slate-800/50 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 hover:border-blue-400 transition-all text-center">
        <input
          type="file"
          accept="application/pdf"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 bg-white dark:bg-slate-700 rounded-2xl shadow-sm dark:shadow-none flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
            {file ? "PDF" : "UP"}
          </div>
          <div>
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
              {file ? file.name : "Choose a PDF file"}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              Drag and drop or click to browse
            </p>
          </div>
        </div>
      </div>

      {error && <p className="text-sm font-semibold text-red-600">{error}</p>}

      <button
        onClick={handleUpload}
        disabled={isUploading || !file}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-blue-100 dark:shadow-none disabled:bg-slate-200 dark:disabled:bg-slate-800 flex items-center justify-center gap-3"
      >
        {isUploading ? `Uploading (${progress}%)` : "Begin Secure Transfer"}
      </button>
    </div>
  );
}
