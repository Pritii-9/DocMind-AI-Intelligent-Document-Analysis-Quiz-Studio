/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { FileText, Folder, LayoutDashboard, LogOut, Users } from "lucide-react";

import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

export type AdminView = "documents" | "team";

export default function Sidebar({
  onSelectFile,
  activeFile,
  refreshToken = 0,
  adminView,
  onChangeAdminView,
}: {
  onSelectFile: any;
  activeFile: string;
  refreshToken?: number;
  adminView?: AdminView;
  onChangeAdminView?: (view: AdminView) => void;
}) {
  const { logout, role, userName } = useAuth();
  const [files, setFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const response = await api.get("/pdf/list");
        setFiles(response.data);
      } catch (err) {
        console.error("Failed to load documents", err);
      } finally {
        setLoading(false);
      }
    };
    fetchFiles();
  }, [refreshToken]);

  return (
    <div className="w-72 bg-slate-900 dark:bg-black h-full flex flex-col text-slate-400 border-r border-slate-800 shadow-2xl transition-all">
      <div className="p-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold shadow-lg shadow-blue-900/40">
            V
          </div>
          <h2 className="text-xl font-black text-white tracking-tighter">Vault PRO</h2>
        </div>

        {role === "admin" && (
          <div className="mb-8">
            <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">
              Administration
            </h2>
            <div className="space-y-2">
              <button
                onClick={() => onChangeAdminView?.("documents")}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-bold ${
                  adminView === "documents"
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-900/40"
                    : "hover:bg-slate-800"
                }`}
              >
                <LayoutDashboard size={18} />
                Documents
              </button>
              <button
                onClick={() => onChangeAdminView?.("team")}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-bold ${
                  adminView === "team"
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/40"
                    : "hover:bg-slate-800"
                }`}
              >
                <Users size={18} />
                Team Management
              </button>
            </div>
          </div>
        )}

        <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">
          Your Documents
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 space-y-1 custom-scrollbar">
        {loading ? (
          <div className="space-y-3 px-4 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 bg-slate-800/30 rounded-xl" />
            ))}
          </div>
        ) : files.length === 0 ? (
          <div className="text-center py-10">
            <Folder className="mx-auto text-slate-700 mb-2" size={32} />
            <p className="text-xs text-slate-600">No documents found</p>
          </div>
        ) : (
          files.map((file) => (
            <button
              key={file}
              onClick={() => onSelectFile(file)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium border border-transparent group ${
                activeFile === file
                  ? "bg-blue-600 text-white border-blue-400 shadow-lg shadow-blue-900/40"
                  : "hover:bg-slate-800 dark:hover:bg-slate-900 hover:text-slate-200"
              }`}
            >
              <FileText
                className={`${
                  activeFile === file ? "text-white" : "text-slate-500 group-hover:text-blue-400"
                }`}
                size={18}
              />
              <span className="truncate">{file}</span>
            </button>
          ))
        )}
      </div>

      <div className="p-6 border-t border-slate-800 bg-slate-900/50">
        <div className="flex items-center gap-3 mb-6 px-2">
          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold text-white border border-slate-600">
            {userName?.charAt(0).toUpperCase()}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold text-slate-200 truncate">{userName}</span>
            <span className="text-[10px] text-slate-500 uppercase font-black">{role}</span>
          </div>
        </div>

        <button
          onClick={logout}
          className="w-full group flex items-center justify-center gap-2 bg-slate-800 dark:bg-slate-900 hover:bg-red-600 hover:text-white py-3 rounded-xl font-bold transition-all text-[10px] uppercase tracking-widest border border-slate-700 dark:border-slate-800"
        >
          <LogOut size={14} className="group-hover:translate-x-1 transition-transform" />
          Terminate Session
        </button>
      </div>
    </div>
  );
}
