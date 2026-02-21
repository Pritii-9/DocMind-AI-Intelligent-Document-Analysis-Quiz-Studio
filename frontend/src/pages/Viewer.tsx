import { useState } from "react";
import Sidebar from "../components/Sidebar";
import PdfViewer from "../components/PdfViewer";

export default function Viewer() {
  // Default to sample.pdf if nothing is selected
  const [selectedFile, setSelectedFile] = useState("sample.pdf");

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar on the left */}
      <Sidebar onSelectFile={setSelectedFile} activeFile={selectedFile} />

      {/* Main Viewer area on the right */}
      <main className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-lg p-4">
          <h1 className="text-xl font-semibold mb-4 text-gray-800">
            Viewing: <span className="text-blue-600">{selectedFile}</span>
          </h1>
          <PdfViewer url={`http://localhost:5000/pdf/stream/${selectedFile}`} />
        </div>
      </main>
    </div>
  );
}