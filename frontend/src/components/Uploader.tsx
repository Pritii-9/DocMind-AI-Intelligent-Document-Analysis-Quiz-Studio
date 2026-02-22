/* eslint-disable @typescript-eslint/no-unused-vars */
import { useState } from "react";

export default function Uploader() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleUpload = async () => {
    if (!file) return;
    const token = localStorage.getItem("access_token"); 
    if (!token) return alert("No session found.");

    setIsUploading(true);
    setProgress(0);

    try {
      const initRes = await fetch("http://localhost:5000/pdf/init-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ filename: file.name }),
      });
      const { uploadId, key } = await initRes.json();
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

        const pRes = await fetch("http://localhost:5000/pdf/upload-part", {
          method: "POST",
          headers: { "Authorization": `Bearer ${token}` },
          body: formData,
        });
        const pData = await pRes.json();
        parts.push({ PartNumber: i + 1, ETag: pData.etag });
        setProgress(Math.round(((i + 1) / totalParts) * 100));
      }

      await fetch("http://localhost:5000/pdf/complete-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ key, uploadId, parts }),
      });
      window.location.reload();
    } catch (err) {
      alert("Upload failed.");
    } finally { setIsUploading(false); }
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
            {file ? "📄" : "☁️"}
          </div>
          <div>
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{file ? file.name : "Choose a PDF file"}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Drag and drop or click to browse</p>
          </div>
        </div>
      </div>

      <button 
        onClick={handleUpload} 
        disabled={isUploading || !file}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-blue-100 dark:shadow-none disabled:bg-slate-200 dark:disabled:bg-slate-800 flex items-center justify-center gap-3"
      >
        {isUploading ? "Uploading (" + progress + "%)" : "Begin Secure Transfer"}
      </button>
    </div>
  );
}