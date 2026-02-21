import { Document, Page, pdfjs } from "react-pdf";
import { useState, useEffect } from "react";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function PdfViewer({ url }: { url: string }) {
  const [pages, setPages] = useState(0);
  const [pdfBlob, setPdfBlob] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("access_token"); // Sync key
    let objectUrl: string | null = null;

    const fetchPdf = async () => {
      try {
        setError(null);
        if (!token) throw new Error("Auth token missing.");

        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
           const errData = await response.json().catch(() => ({}));
           throw new Error(errData.msg || "Access Denied");
        }

        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        setPdfBlob(objectUrl);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        setError(err.message);
      }
    };

    if (url) fetchPdf();

    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); }; // Cleanup
  }, [url]);

  if (error) return <div className="p-4 bg-red-100 text-red-700 rounded m-4">⚠️ {error}</div>;
  if (!pdfBlob) return <p className="p-4 italic text-gray-500">Connecting to secure stream...</p>;

  return (
    <div className="pdf-container bg-gray-200 p-4 rounded shadow-inner overflow-auto h-full">
      <Document file={pdfBlob} onLoadSuccess={(d) => setPages(d.numPages)}>
        {Array.from({ length: pages }, (_, i) => (
          <div key={i} className="mb-4 shadow-lg bg-white flex justify-center">
            <Page pageNumber={i + 1} renderTextLayer={false} renderAnnotationLayer={false} width={700} />
          </div>
        ))}
      </Document>
    </div>
  );
}