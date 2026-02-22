import { useState } from "react";
import Sidebar from "../components/Sidebar";
import PdfViewer from "../components/PdfViewer";
import Uploader from "../components/Uploader";
import ThemeToggle from "../components/ThemeToggle";

export default function Viewer() {
  const [selectedFile, setSelectedFile] = useState("");

  return (
    <div className="flex h-screen bg-slate-100 dark:bg-slate-950 overflow-hidden transition-colors duration-300">
      <Sidebar onSelectFile={setSelectedFile} activeFile={selectedFile} />

      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-8 flex items-center justify-between shadow-sm z-10 transition-colors">
          <div className="flex items-center gap-4">
            <h2 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Explorer</h2>
            <span className="text-slate-300 dark:text-slate-700">/</span>
            <span className="text-slate-800 dark:text-slate-100 font-bold truncate max-w-[400px]">
              {selectedFile || "Select a document"}
            </span>
          </div>
          
          <div className="flex items-center gap-4">
             <ThemeToggle />
             <div className="hidden md:flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-100 dark:border-slate-700">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tight">Encrypted</span>
             </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 lg:p-10 custom-scrollbar">
          <div className="max-w-5xl mx-auto space-y-8">
            {/* Upload Section */}
            <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 transition-all hover:shadow-md">
              <div className="mb-6">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white">Secure Upload</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">Files are encrypted and split into chunks before storage.</p>
              </div>
              <Uploader />
            </section>

            {/* Viewer Section */}
            <section className="bg-slate-800 dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-700 dark:border-slate-800 overflow-hidden min-h-[800px] flex flex-col transition-colors">
              {selectedFile ? (
                <PdfViewer url={`http://localhost:5000/pdf/stream/${selectedFile}`} />
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-500 py-20">
                   <div className="w-20 h-20 bg-slate-700 dark:bg-slate-800 rounded-full flex items-center justify-center text-4xl mb-4 shadow-inner">📂</div>
                   <p className="font-bold text-lg text-slate-400 dark:text-slate-500">No Document Selected</p>
                   <p className="text-sm opacity-60">Choose a file from the sidebar to start streaming.</p>
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}