import { useState } from "react";
import Sidebar from "../components/Sidebar";
import PdfViewer from "../components/PdfViewer";
import Uploader from "../components/Uploader"; // Import the uploader

export default function Viewer() {
  const [selectedFile, setSelectedFile] = useState("sample.pdf");

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar on the left */}
      <Sidebar onSelectFile={setSelectedFile} activeFile={selectedFile} />

      {/* Main Content on the right */}
      <main className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-4xl mx-auto flex flex-col gap-6">
          
          {/* NEW: Upload Section */}
          <section className="bg-white shadow-md rounded-lg p-6 border-l-4 border-blue-600">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              📤 Upload Secure Document
            </h2>
            <Uploader />
          </section>

          {/* Viewer Section */}
          <div className="bg-white shadow-lg rounded-lg p-4">
            <h1 className="text-xl font-semibold mb-4 text-gray-800">
              Viewing: <span className="text-blue-600">{selectedFile}</span>
            </h1>
            <PdfViewer url={`http://localhost:5000/pdf/stream/${selectedFile}`} />
          </div>
        </div>
      </main>
    </div>
  );
}