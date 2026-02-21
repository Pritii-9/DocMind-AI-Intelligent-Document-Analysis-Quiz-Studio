import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";

interface SidebarProps {
  onSelectFile: (fileName: string) => void;
  activeFile: string;
}

export default function Sidebar({ onSelectFile, activeFile }: SidebarProps) {
  const { logout } = useAuth();
  const [files, setFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const token = localStorage.getItem("access_token"); // Sync key
        const response = await fetch("http://localhost:5000/pdf/list", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error("Unauthorized");
        const data = await response.json();
        setFiles(data);
      } catch (err) {
        console.error("Sidebar Error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchFiles();
  }, []);

  return (
    <div className="w-64 h-screen bg-gray-900 text-white p-4 flex flex-col">
      <h2 className="text-xl font-bold mb-6 border-b border-gray-700 pb-2">Documents</h2>
      <div className="flex-1 overflow-y-auto">
        {loading ? <p className="animate-pulse">Loading...</p> : (
          <ul className="space-y-2">
            {files.map(file => (
              <li key={file} onClick={() => onSelectFile(file)} className={`p-2 rounded cursor-pointer ${activeFile === file ? "bg-blue-600" : "hover:bg-gray-800"}`}>
                📄 {file}
              </li>
            ))}
          </ul>
        )}
      </div>
      <button onClick={logout} className="mt-4 bg-red-600 p-2 rounded hover:bg-red-700 transition">Logout</button>
    </div>
  );
}