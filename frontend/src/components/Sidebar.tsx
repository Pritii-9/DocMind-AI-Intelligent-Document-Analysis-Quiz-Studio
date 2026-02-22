/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function Sidebar({ onSelectFile, activeFile }: { onSelectFile: any, activeFile: string }) {
  const { logout } = useAuth();
  const [files, setFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const token = localStorage.getItem("access_token");
        const response = await fetch("http://localhost:5000/pdf/list", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error("Unauthorized");
        const data = await response.json();
        setFiles(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchFiles();
  }, []);

  return (
    /* Added dark:bg-black and border-slate-800 for a deep professional look */
    <div className="w-72 bg-slate-900 dark:bg-black h-full flex flex-col text-slate-400 border-r border-slate-800 shadow-2xl transition-colors">
      <div className="p-8">
        <div className="flex items-center gap-3 mb-8">
           <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white font-bold">V</div>
           <h2 className="text-xl font-bold text-white tracking-tight">Vault</h2>
        </div>
        <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">Documents</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 space-y-1">
        {loading ? (
          <div className="space-y-3 px-4 animate-pulse">
            {[1, 2, 3].map(i => <div key={i} className="h-10 bg-slate-800/50 rounded-lg" />)}
          </div>
        ) : (
          files.map(file => (
            <button 
              key={file} 
              onClick={() => onSelectFile(file)} 
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium border border-transparent ${
                activeFile === file 
                ? "bg-blue-600 text-white border-blue-400 shadow-lg shadow-blue-900/40" 
                : "hover:bg-slate-800 dark:hover:bg-slate-900 hover:text-slate-200"
              }`}
            >
              <span>{activeFile === file ? "📂" : "📄"}</span>
              <span className="truncate">{file}</span>
            </button>
          ))
        )}
      </div>

      <div className="p-6 border-t border-slate-800">
        <button 
          onClick={logout} 
          className="w-full bg-slate-800 dark:bg-slate-900 hover:bg-red-600 hover:text-white py-3 rounded-xl font-bold transition-all text-xs uppercase tracking-widest border border-slate-700 dark:border-slate-800"
        >
          Logout Session
        </button>
      </div>
    </div>
  );
}