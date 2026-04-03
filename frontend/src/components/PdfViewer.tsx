import { ChevronLeft, ChevronRight, LoaderCircle, SearchSlash, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function PdfViewer({ url }: { url: string }) {
  const [pages, setPages] = useState(0);
  const [pdfBlob, setPdfBlob] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [activePage, setActivePage] = useState(1);
  const [containerWidth, setContainerWidth] = useState(960);
  const viewerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    let objectUrl: string | null = null;

    const fetchPdf = async () => {
      try {
        setError(null);
        setPdfBlob(null);
        setActivePage(1);
        if (!token) {
          throw new Error("Authentication token missing.");
        }

        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.msg || "Unable to load document.");
        }

        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        setPdfBlob(objectUrl);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load document.");
      }
    };

    void fetchPdf();

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [url]);

  useEffect(() => {
    const updateWidth = () => {
      if (!viewerRef.current) return;
      setContainerWidth(Math.max(320, viewerRef.current.clientWidth - 48));
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    if (viewerRef.current) {
      observer.observe(viewerRef.current);
    }
    window.addEventListener("resize", updateWidth);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateWidth);
    };
  }, []);

  const pageWidth = useMemo(() => Math.floor(Math.min(containerWidth, 980) * zoom), [containerWidth, zoom]);

  if (error) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center rounded-[2rem] border border-rose-200 bg-rose-50 p-10 text-center text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-200">
        <SearchSlash size={30} />
        <p className="mt-4 text-lg font-semibold">Unable to load this document</p>
        <p className="mt-2 max-w-xl text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[2rem] border border-black/5 bg-[var(--panel)] shadow-sm dark:border-white/10">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/5 px-5 py-4 dark:border-white/10">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-soft)]">Secure Viewer</p>
          <p className="text-sm text-[var(--text-soft)]">Streamed from protected storage with authenticated access.</p>
        </div>

        <div className="flex items-center gap-2 rounded-full border border-black/5 bg-[var(--panel-muted)] p-1 dark:border-white/10">
          <button
            type="button"
            onClick={() => setZoom((value) => Math.max(0.7, Number((value - 0.1).toFixed(2))))}
            className="rounded-full p-2 text-[var(--text-soft)] transition hover:bg-[var(--button-secondary-bg)] hover:text-[var(--text-strong)]"
            aria-label="Zoom out"
          >
            <ZoomOut size={16} />
          </button>
          <span className="min-w-14 text-center text-sm font-semibold text-[var(--text-strong)]">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            onClick={() => setZoom((value) => Math.min(1.8, Number((value + 0.1).toFixed(2))))}
            className="rounded-full p-2 text-[var(--text-soft)] transition hover:bg-[var(--button-secondary-bg)] hover:text-[var(--text-strong)]"
            aria-label="Zoom in"
          >
            <ZoomIn size={16} />
          </button>
        </div>
      </div>

      {!pdfBlob ? (
        <div className="flex min-h-[60vh] items-center justify-center text-[var(--text-soft)]">
          <div className="flex items-center gap-3 rounded-full bg-[var(--panel-muted)] px-5 py-3 text-sm font-medium">
            <LoaderCircle size={18} className="animate-spin" />
            Loading secure stream
          </div>
        </div>
      ) : (
        <div ref={viewerRef} className="max-h-[72vh] overflow-auto bg-[var(--panel-muted)] p-6">
          <Document
            file={pdfBlob}
            onLoadSuccess={(document) => {
              setPages(document.numPages);
              setActivePage(1);
            }}
            className="flex flex-col items-center gap-6"
          >
            <div className="sticky top-0 z-10 flex items-center gap-3 rounded-full border border-black/5 bg-white/85 px-3 py-2 text-sm font-medium text-[var(--text-strong)] shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-950/80">
              <button
                type="button"
                disabled={activePage <= 1}
                onClick={() => setActivePage((page) => Math.max(1, page - 1))}
                className="rounded-full p-1 text-[var(--text-soft)] transition hover:bg-[var(--button-secondary-bg)] hover:text-[var(--text-strong)] disabled:opacity-40"
              >
                <ChevronLeft size={16} />
              </button>
              <span>
                Page {activePage} of {pages}
              </span>
              <button
                type="button"
                disabled={activePage >= pages}
                onClick={() => setActivePage((page) => Math.min(pages, page + 1))}
                className="rounded-full p-1 text-[var(--text-soft)] transition hover:bg-[var(--button-secondary-bg)] hover:text-[var(--text-strong)] disabled:opacity-40"
              >
                <ChevronRight size={16} />
              </button>
            </div>
            <div className="overflow-hidden rounded-3xl border border-black/5 bg-white shadow-2xl dark:border-white/10">
              <Page
                pageNumber={activePage}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                width={pageWidth}
              />
            </div>
          </Document>
        </div>
      )}
    </div>
  );
}
