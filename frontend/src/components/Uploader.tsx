import { useState } from "react";

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks

export default function Uploader() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);


  const handleUpload = async () => {
    if (!file) return;

    // IMPORTANT: Ensure this matches the key in your AuthContext exactly
    const token = localStorage.getItem("access_token"); 

    if (!token) {
      alert("No session found. Please log out and log back in.");
      return;
    }

    setIsUploading(true);
    setProgress(0);

    try {
      // 1. Initialize S3 Multipart Upload
      const initRes = await fetch("http://localhost:5000/pdf/init-upload", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json", 
          "Authorization": `Bearer ${token}` 
        },
        body: JSON.stringify({ filename: file.name }),
      });
      
      if (initRes.status === 401) throw new Error("Session expired. Please re-login.");
      const { uploadId, key } = await initRes.json();

      const totalParts = Math.ceil(file.size / CHUNK_SIZE);
      const parts = [];

      // 2. Uploading Chunks
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

        if (!pRes.ok) throw new Error(`Chunk ${i + 1} failed. Status: ${pRes.status}`);
        
        const pData = await pRes.json();
        parts.push({ PartNumber: i + 1, ETag: pData.etag });
        
        setProgress(Math.round(((i + 1) / totalParts) * 100));
      }

      // 3. Complete Upload
      const compRes = await fetch("http://localhost:5000/pdf/complete-upload", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json", 
          "Authorization": `Bearer ${token}` 
        },
        body: JSON.stringify({ key, uploadId, parts }),
      });

      if (compRes.ok) {
        alert("Secure Upload Complete!");
        window.location.reload();
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      console.error("Upload Logic Error:", err);
      alert(err.message || "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 shadow-sm">
      <input 
        type="file" 
        accept="application/pdf"
        className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        onChange={(e) => setFile(e.target.files?.[0] || null)} 
      />
      <button 
        onClick={handleUpload} 
        disabled={isUploading || !file}
        className="bg-blue-600 text-white font-bold px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400 transition-all active:scale-95"
      >
        {isUploading ? `Uploading Chunks (${progress}%)` : "Start Secure Upload"}
      </button>
      {isUploading && (
        <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
          <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
        </div>
      )}
    </div>
  );
}