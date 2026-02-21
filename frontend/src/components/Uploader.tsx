import { useState } from "react";

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks

export default function Uploader() {
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);

  const handleUpload = async () => {
    if (!file) return;
    const token = localStorage.getItem("token");

    // 1. Initialize Upload
    const initRes = await fetch("http://localhost:5000/pdf/init-upload", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ filename: file.name }),
    });
    const { uploadId, key } = await initRes.json();

    const totalParts = Math.ceil(file.size / CHUNK_SIZE);
    const uploadedParts = [];

    // 2. Upload Chunks (Slicing Logic)
    for (let i = 0; i < totalParts; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);

      const formData = new FormData();
      formData.append("file", chunk);
      formData.append("partNumber", (i + 1).toString());
      formData.append("uploadId", uploadId);
      formData.append("key", key);

      const partRes = await fetch("http://localhost:5000/pdf/upload-part", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const { etag } = await partRes.json();
      uploadedParts.push({ PartNumber: i + 1, ETag: etag });
      setProgress(Math.round(((i + 1) / totalParts) * 100));
    }

    // 3. Complete Upload
    await fetch("http://localhost:5000/pdf/complete-upload", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ key, uploadId, parts: uploadedParts }),
    });

    alert("Upload Successful!");
    window.location.reload();
  };

  return (
    <div className="p-4 border rounded bg-white">
      <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      <button onClick={handleUpload} className="bg-blue-600 text-white px-4 py-2 mt-2">
        Upload Large PDF
      </button>
      {progress > 0 && <p className="mt-2">Progress: {progress}%</p>}
    </div>
  );
}