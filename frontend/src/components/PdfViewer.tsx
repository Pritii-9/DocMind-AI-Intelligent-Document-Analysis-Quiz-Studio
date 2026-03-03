/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function PdfViewer({ url }: { url: string }) {
  const [pages, setPages] = useState(0);
  const [pdfBlob, setPdfBlob] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    let objectUrl: string | null = null;

    const fetchPdf = async () => {
      try {
        setError(null);
        setPdfBlob(null);
        if (!token) throw new Error("Authentication token missing.");

        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.msg || "Unable to load file.");
        }

        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        setPdfBlob(objectUrl);
      } catch (err: any) {
        setError(err.message);
      }
    };

    if (url) fetchPdf();
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  if (error) return <div className="p-8 text-red-500 text-center font-bold">Error: {error}</div>;
  if (!pdfBlob) {
    return <div className="p-20 text-center animate-pulse text-slate-400">Loading Secure Stream...</div>;
  }

  return (
    <div className="flex-1 overflow-auto bg-slate-100 dark:bg-slate-900 p-8 flex flex-col items-center transition-colors">
      <Document file={pdfBlob} onLoadSuccess={(d) => setPages(d.numPages)} className="flex flex-col gap-8">
        {Array.from({ length: pages }, (_, i) => (
          <div key={i} className="shadow-2xl border border-slate-200 dark:border-slate-800">
            <Page
              pageNumber={i + 1}
              renderTextLayer={false}
              renderAnnotationLayer={false}
              width={800}
            />
          </div>
        ))}
      </Document>
    </div>
  );
}
