import { useEffect, useMemo, useState, Suspense, lazy } from "react";
import type { AxiosError } from "axios";
import ChatAI from "../components/ChatAI";
import {
  ChevronLeft,
  ChevronRight,
  RefreshCcw,
  FileText,
  HardDrive,
  Users,
  Sparkles,
  LoaderCircle,
  Search,
  Shield,
  Plus,
  LogOut,
  Bot,
  X,
} from "lucide-react";

import api, { API_BASE_URL } from "../api/axios";
import InviteModal from "../components/InviteModal";
import Sidebar, { type AppSection } from "../components/Sidebar";
import ThemeToggle from "../components/ThemeToggle";
import Uploader from "../components/Uploader";
import { useAuth } from "../context/AuthContext";
import type { ActivityItem, PdfDocument, WorkspaceOverview } from "../types/pdf";
import type { WorkspaceUser } from "../types/user";

const sectionLabels: Record<AppSection, string> = {
  overview: "Dashboard",
  library: "Document Library",
  viewer: "Live Viewer",
  team: "Team Management",
};

const validSections: AppSection[] = ["overview", "library", "viewer", "team"];
const PdfViewer = lazy(() => import("../components/PdfViewer"));

type SortOption = "recent" | "name" | "size";

function getInitialSection(canManageTeam: boolean): AppSection {
  const hash = window.location.hash.replace("#", "") as AppSection;
  if (validSections.includes(hash)) {
    if (hash === "team" && !canManageTeam) return "overview";
    return hash;
  }
  return "overview";
}

function formatBytes(value: number) {
  if (!value) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size.toFixed(size >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatRelativeTime(value: string | null) {
  if (!value) return "No recent activity";
  const diffMs = new Date(value).getTime() - Date.now();
  const minutes = Math.round(diffMs / (1000 * 60));
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(hours, "hour");
  const days = Math.round(hours / 24);
  return formatter.format(days, "day");
}

function formatTimestamp(value: string | null) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatAiStatus(status?: PdfDocument["ai_index_status"]) {
  switch (status) {
    case "ready":
      return "AI Ready";
    case "processing":
      return "Indexing";
    case "failed":
      return "Index Failed";
    default:
      return "Pending Index";
  }
}

function AiStatusBadge({ status }: { status?: string }) {
  const isReady = status === "ready";
  const isProcessing = status === "processing";
  const isFailed = status === "failed";

  let dotClass = "bg-gray-400";
  let text = "Pending Index";
  
  if (isReady) {
    dotClass = "bg-emerald-500";
    text = "AI Ready";
  } else if (isProcessing) {
    dotClass = "bg-amber-400 animate-pulse";
    text = "Indexing";
  } else if (isFailed) {
    dotClass = "bg-rose-500";
    text = "Index Failed";
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
      <span>{text}</span>
    </span>
  );
}

function formatFilename(rawName?: string) {
  if (!rawName) return "";
  return rawName.replace(/^\d+-/, "");
}

function compareByLatestUpload(a: PdfDocument, b: PdfDocument) {
  return new Date(b.uploaded_at || 0).getTime() - new Date(a.uploaded_at || 0).getTime();
}

function getPreferredDocument(docs: PdfDocument[], current?: PdfDocument | null, preferredFileName?: string) {
  if (docs.length === 0) return null;

  if (preferredFileName) {
    const exactMatch = docs.find((doc) => doc.filename === preferredFileName);
    if (exactMatch) return exactMatch;
  }

  if (current) {
    const preserved = docs.find((doc) => doc.key === current.key);
    if (preserved) return preserved;
  }

  return [...docs].sort(compareByLatestUpload)[0];
}

function getApiErrorMessage(error: unknown, fallback: string) {
  const axiosError = error as AxiosError<{ msg?: string }>;
  return axiosError.response?.data?.msg || fallback;
}

export default function Workspace() {
  const { role, logout } = useAuth();
  const canManageTeam = role === "admin";

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [currentSection, setCurrentSection] = useState<AppSection>(() => getInitialSection(canManageTeam));
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [commandSelectionIndex, setCommandSelectionIndex] = useState(0);
  const [toasts, setToasts] = useState<Array<{ id: string; title: string; detail: string; type: string }>>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);

  const [documents, setDocuments] = useState<PdfDocument[]>([]);
  const [overview, setOverview] = useState<WorkspaceOverview | null>(null);
  const [users, setUsers] = useState<WorkspaceUser[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<PdfDocument | null>(null);

  const [selectedForExtraction, setSelectedForExtraction] = useState<Set<string>>(new Set());
  const [isExtractionModalOpen, setIsExtractionModalOpen] = useState(false);
  const [extractionPrompt, setExtractionPrompt] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [extractionResults, setExtractionResults] = useState<any[] | null>(null);

  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("recent");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sseConnected, setSseConnected] = useState(false);
  const [liveSyncEnabled] = useState(true);
  const [documentDelta, setDocumentDelta] = useState(0);

  const pushToast = (title: string, detail: string, type: "info" | "success" | "warning" = "info") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, title, detail, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((toast) => toast.id !== id)), 5000);
  };

  const loadWorkspace = async (showRefreshState = false, suppressLoading = false, preferredFileName?: string) => {
    if (showRefreshState) setRefreshing(true);
    else if (!suppressLoading) setLoading(true);
    setError(null);

    try {
      const requests = [api.get("/pdf/overview"), api.get("/pdf/library")];
      if (canManageTeam) requests.push(api.get("/auth/users"));

      const prevCount = overview?.stats.total_documents ?? 0;
      const [overRes, libRes, userRes] = await Promise.all(requests);

      setDocuments(libRes.data);
      setOverview(overRes.data);
      if (userRes) setUsers(userRes.data);

      setSelectedDocument((current) => getPreferredDocument(libRes.data, current, preferredFileName));
      setDocumentDelta(overRes.data.stats.total_documents - prevCount);
      return libRes.data;
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Unable to load workspace data."));
      return [];
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadWorkspace();
  }, [canManageTeam]);

  useEffect(() => {
    if (!liveSyncEnabled) {
      setSseConnected(false);
      return;
    }

    const token = localStorage.getItem("access_token");
    if (!token) return;

    const source = new EventSource(`${API_BASE_URL}/pdf/events?token=${encodeURIComponent(token)}`);
    source.onopen = () => setSseConnected(true);
    source.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      pushToast(payload.title || "Update", payload.detail || "Workspace refreshed.", payload.type || "info");
      void loadWorkspace(false, true);
    };
    source.onerror = () => {
      setSseConnected(false);
      source.close();
    };

    return () => source.close();
  }, [liveSyncEnabled]);

  const navigateTo = (section: AppSection) => {
    const next = section === "team" && !canManageTeam ? "overview" : section;
    setCurrentSection(next);
    window.location.hash = next;
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSelectDocument = (doc: PdfDocument) => {
    setSelectedDocument(doc);
    navigateTo("viewer");
  };

  const handleUploadComplete = async (uploadedFileName?: string) => {
    const refreshedDocuments = await loadWorkspace(true, false, uploadedFileName);
    const nextDocument = getPreferredDocument(refreshedDocuments, null, uploadedFileName);
    if (nextDocument) {
      setSelectedDocument(nextDocument);
      navigateTo("viewer");
      pushToast("Viewer updated", `${nextDocument.filename} is ready for review.`, "success");
    }
  };

  const filteredDocuments = useMemo(() => {
    const query = search.trim().toLowerCase();
    const result = documents.filter((doc) => doc.filename.toLowerCase().includes(query));

    return result.sort((a, b) => {
      if (sortBy === "name") return a.filename.localeCompare(b.filename);
      if (sortBy === "size") return b.size_bytes - a.size_bytes;
      return compareByLatestUpload(a, b);
    });
  }, [documents, search, sortBy]);

  const recentDocuments = useMemo(() => [...documents].sort(compareByLatestUpload), [documents]);
  // const latestDocument = recentDocuments[0] ?? null;

  const activeMembersCount = useMemo(
    () => users.filter((user) => user.is_active).length || overview?.stats.active_members || 1,
    [users, overview]
  );

  const summaryCards = [
    {
      label: "Documents",
      value: overview?.stats.total_documents ?? documents.length,
      icon: FileText,
      detail: `${filteredDocuments.length} in library`,
    },
    {
      label: "Storage",
      value: formatBytes(overview?.stats.total_storage_bytes ?? 0),
      icon: HardDrive,
      detail: "Encrypted footprint",
    },
    {
      label: "Members",
      value: activeMembersCount,
      icon: Users,
      detail: `${overview?.stats.verified_members ?? activeMembersCount} verified`,
    },
    {
      label: "Live Delta",
      value: documentDelta === 0 ? "Stable" : `${documentDelta > 0 ? "+" : ""}${documentDelta}`,
      icon: Sparkles,
      detail: "Updates this cycle",
    },
  ];

  const commandActions = [
    { id: "overview", label: "Go to Dashboard", shortcut: "1", action: () => navigateTo("overview") },
    { id: "library", label: "Go to Document Library", shortcut: "2", action: () => navigateTo("library") },
    { id: "viewer", label: "Go to Live Viewer", shortcut: "3", action: () => navigateTo("viewer") },
    { id: "team", label: "Go to Team Management", shortcut: "4", action: () => navigateTo("team"), disabled: !canManageTeam },
    { id: "refresh", label: "Refresh Data", shortcut: "Ctrl/Cmd + R", action: () => loadWorkspace(true, false) },
    { id: "invite", label: "Invite Team Member", action: () => setIsInviteOpen(true), disabled: !canManageTeam },
    {
      id: "search",
      label: "Search PDFs in Library",
      shortcut: "Ctrl/Cmd + K",
      action: () => {
        navigateTo("library");
        setTimeout(() => {
          const searchInput = document.querySelector('input[placeholder="Filter library..."]') as HTMLInputElement;
          if (searchInput) {
            searchInput.focus();
            searchInput.select();
          }
        }, 100);
      },
    },
  ];

  const filteredCommands = commandActions.filter(
    (command) => !command.disabled && command.label.toLowerCase().includes(commandQuery.toLowerCase())
  );

  useEffect(() => {
    if (filteredCommands.length === 0) {
      setCommandSelectionIndex(0);
      return;
    }
    setCommandSelectionIndex((current) => Math.min(Math.max(current, 0), filteredCommands.length - 1));
  }, [filteredCommands]);

  const handleCommandSelect = (action: () => void) => {
    action();
    setIsCommandPaletteOpen(false);
    setCommandQuery("");
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (!isCommandPaletteOpen && (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
        return;
      }

      const { key, ctrlKey, metaKey, shiftKey } = event;
      const cmdOrCtrl = ctrlKey || metaKey;

      if (cmdOrCtrl && key === "k") {
        event.preventDefault();
        setIsCommandPaletteOpen(true);
        setCommandQuery("");
      }

      if (cmdOrCtrl && key === "r") {
        event.preventDefault();
        void loadWorkspace(true, false);
      }

      if (!cmdOrCtrl && !shiftKey && ["1", "2", "3", "4"].includes(key)) {
        event.preventDefault();
        const sections: AppSection[] = ["overview", "library", "viewer", "team"];
        const index = parseInt(key, 10) - 1;
        if (sections[index]) {
          navigateTo(sections[index]);
        }
      }

      if (currentSection === "library" && filteredDocuments.length > 0) {
        const currentIndex = selectedDocument ? filteredDocuments.findIndex((doc) => doc.key === selectedDocument.key) : -1;

        if (key === "ArrowDown" && currentIndex < filteredDocuments.length - 1) {
          event.preventDefault();
          setSelectedDocument(filteredDocuments[currentIndex + 1]);
        } else if (key === "ArrowUp" && currentIndex > 0) {
          event.preventDefault();
          setSelectedDocument(filteredDocuments[currentIndex - 1]);
        } else if (key === "Enter" && selectedDocument) {
          event.preventDefault();
          handleSelectDocument(selectedDocument);
        }
      }

      if (key === "Escape") {
        if (isCommandPaletteOpen) {
          setIsCommandPaletteOpen(false);
          setCommandQuery("");
        } else if (search.trim()) {
          setSearch("");
        } else if (isInviteOpen) {
          setIsInviteOpen(false);
        }
      }

      if (isCommandPaletteOpen) {
        if (key === "ArrowDown") {
          event.preventDefault();
          setCommandSelectionIndex((previous) => {
            if (filteredCommands.length === 0) return 0;
            return (previous + 1) % filteredCommands.length;
          });
        } else if (key === "ArrowUp") {
          event.preventDefault();
          setCommandSelectionIndex((previous) => {
            if (filteredCommands.length === 0) return 0;
            return (previous - 1 + filteredCommands.length) % filteredCommands.length;
          });
        } else if (key === "Enter" && filteredCommands.length > 0) {
          event.preventDefault();
          handleCommandSelect(filteredCommands[commandSelectionIndex].action);
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [currentSection, filteredDocuments, selectedDocument, search, isInviteOpen, isCommandPaletteOpen, filteredCommands, commandSelectionIndex]);

  return (
    <div className="flex min-h-screen bg-[var(--workspace-shell)] text-[var(--text-strong)] transition-colors duration-300">
      <Sidebar
        currentSection={currentSection}
        onNavigate={navigateTo}
        canManageTeam={canManageTeam}
        documentCount={documents.length}
        teamCount={canManageTeam ? users.length : activeMembersCount}
        selectedDocumentName={selectedDocument?.filename}
        collapsed={isSidebarCollapsed}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 h-16 border-b border-[var(--workspace-divider)] bg-[var(--workspace-frame)] backdrop-blur-xl">
          <div className="flex h-full items-center justify-between gap-4 px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-4">
              <button
                type="button"
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="rounded-xl p-2 text-[var(--text-soft)] transition-all hover:bg-[var(--workspace-hover)] hover:text-[var(--text-strong)]"
                aria-label="Toggle sidebar"
              >
                {isSidebarCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
              </button>

              <div className="min-w-0">
                <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent)]/70">
                  SafeUp Workspace
                </span>
                <div className="flex min-w-0 items-center gap-2 text-sm">
                  <span className="truncate font-semibold text-[var(--text-strong)]">{sectionLabels[currentSection]}</span>
                  {currentSection === "viewer" && selectedDocument && (
                    <>
                      <span className="text-[var(--text-soft)] shrink-0">/</span>
                      <span className="truncate text-[var(--accent)]">{formatFilename(selectedDocument.filename)}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 sm:gap-4">
              <div className="hidden items-center gap-2.5 rounded-full border border-emerald-500/10 bg-emerald-500/5 px-3 py-1.5 md:flex">
                <div className={`h-1.5 w-1.5 rounded-full ${sseConnected ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
                <span className={`text-[10px] font-black uppercase tracking-widest ${sseConnected ? "text-emerald-500" : "text-rose-500"}`}>
                  {sseConnected ? "Live Sync" : "Offline"}
                </span>
              </div>

              <div className="flex items-center rounded-xl border border-[var(--workspace-border)] bg-[var(--workspace-input)] p-1">
                <button
                  type="button"
                  onClick={() => navigateTo("library")}
                  className="flex items-center gap-2 rounded-lg bg-[var(--button-primary-bg)] px-3 py-1.5 text-xs font-bold text-[var(--button-primary-text)] transition hover:bg-[var(--button-primary-hover)]"
                >
                  <Plus size={14} strokeWidth={3} />
                  Upload
                </button>
                <button
                  type="button"
                  onClick={() => void loadWorkspace(true)}
                  className="p-2 text-[var(--text-soft)] transition-colors hover:text-[var(--text-strong)]"
                  aria-label="Refresh workspace"
                >
                  <RefreshCcw size={18} className={refreshing ? "animate-spin" : ""} />
                </button>
              </div>

              <div className="hidden h-6 w-px bg-[var(--workspace-divider)] sm:block" />

              <div className="flex items-center gap-2">
                <ThemeToggle />
                {currentSection === 'viewer' && (
                  <button
                    type="button"
                    onClick={() => setIsChatOpen((open) => !open)}
                    className="rounded-lg bg-[var(--workspace-input)] p-2 text-[var(--text-soft)] hover:bg-[var(--workspace-hover)] hover:text-[var(--text-strong)] transition-colors"
                    title="AI Chat"
                    aria-label="Toggle AI assistant"
                  >
                    <Bot size={20} strokeWidth={2} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={logout}
                  className="rounded-lg bg-[var(--workspace-input)] p-2 text-[var(--text-soft)] hover:bg-[var(--workspace-hover)] hover:text-[var(--text-strong)] transition-colors"
                  title="Logout"
                  aria-label="Logout"
                >
                  <LogOut size={20} strokeWidth={2} />
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 lg:p-10">
          <div className="mx-auto max-w-7xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {loading ? (
              <div className="flex h-[60vh] items-center justify-center">
                <LoaderCircle size={40} className="animate-spin text-[var(--accent)]/60" />
              </div>
            ) : error ? (
              <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-6 text-sm text-rose-500">{error}</div>
            ) : (
              <>
                {currentSection === "overview" && (
                  <div className="space-y-8">
                    {documents.length === 0 ? (
                      <div className="flex flex-col items-center justify-center rounded-[2.5rem] border border-[var(--workspace-border)] bg-[var(--panel-solid)] p-12 py-20 text-center shadow-2xl shadow-black/5 animate-in fade-in slide-in-from-bottom-8">
                        <div className="mb-6 rounded-3xl bg-[var(--accent-soft)] p-6 text-[var(--accent)]">
                          <Sparkles size={48} strokeWidth={1.5} />
                        </div>
                        <h2 className="mb-4 text-4xl font-bold text-[var(--text-strong)] tracking-tight">Welcome to SafeUp</h2>
                        <p className="mb-10 max-w-lg text-lg text-[var(--text-soft)] leading-relaxed">
                          Your enterprise workspace is ready. To see the streaming PDF viewer and RAG AI in action, upload a document or instantly generate a dummy confidential document.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 items-center">
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                setLoading(true);
                                await api.post("/pdf/inject-sample");
                                await loadWorkspace(true);
                                pushToast("Sample Injected", "A sample document has been securely added.", "success");
                              } catch (e) {
                                pushToast("Error", "Failed to inject sample", "warning");
                              } finally {
                                setLoading(false);
                              }
                            }}
                            className="group flex items-center gap-3 rounded-2xl bg-gradient-to-r from-[var(--accent)] to-cyan-600 px-8 py-4 text-sm font-bold text-white shadow-xl shadow-[var(--accent)]/30 transition-transform hover:scale-105 active:scale-95"
                          >
                            <FileText size={20} />
                            Generate Sample Document
                            <ChevronRight size={18} className="transition-transform group-hover:translate-x-1" />
                          </button>
                          <p className="text-xs font-bold text-[var(--text-soft)] uppercase tracking-widest px-4">OR</p>
                          <button
                            type="button"
                            onClick={() => navigateTo("library")}
                            className="flex items-center gap-2 rounded-2xl border border-[var(--workspace-border)] bg-[var(--panel)] px-8 py-4 text-sm font-bold text-[var(--text-strong)] transition-colors hover:border-[var(--text-soft)] hover:bg-[var(--panel-muted)]"
                          >
                            Upload your own
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                          {summaryCards.map((card) => (
                            <div
                              key={card.label}
                              className="rounded-[2.5rem] border border-[var(--workspace-border)] bg-[var(--panel-solid)] p-6 shadow-2xl shadow-black/5"
                            >
                              <div className="mb-4 flex items-center justify-between">
                                <div className="rounded-2xl bg-[var(--accent-soft)] p-3 text-[var(--accent)]">
                                  <card.icon size={22} />
                                </div>
                              </div>
                              <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-[var(--text-soft)]">{card.label}</p>
                              <p className="mb-2 text-3xl font-bold text-[var(--text-strong)]">{card.value}</p>
                              <p className="text-xs text-[var(--text-soft)]">{card.detail}</p>
                            </div>
                          ))}
                        </section>

                    <section className="grid gap-8 lg:grid-cols-[1fr_400px]">
                      <div className="rounded-[2.5rem] border border-[var(--workspace-border)] bg-[var(--panel-solid)] p-6 shadow-2xl shadow-black/5">
                        <div className="mb-6 flex items-center justify-between">
                          <h3 className="text-xl font-bold text-[var(--text-strong)]">Recent Activity</h3>
                          <button onClick={() => navigateTo("library")} className="text-sm font-bold text-[var(--accent)] hover:underline">View Full History</button>
                        </div>
                        <div className="flex flex-col gap-3">
                          {overview?.documents.slice(0, 3).map((doc: PdfDocument) => (
                            <button
                              key={doc.key}
                              type="button"
                              onClick={() => handleSelectDocument(doc)}
                              className="group flex items-center justify-between rounded-2xl border border-[var(--workspace-border)] bg-[var(--panel)] px-4 py-3 text-left transition-all hover:border-[var(--accent)]/50 hover:bg-[var(--panel-muted)]"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-bold text-[var(--text-strong)] transition-colors group-hover:text-[var(--accent)]">
                                  {formatFilename(doc.filename)}
                                </p>
                                <div className="mt-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-soft)]">
                                  <span>{formatBytes(doc.size_bytes)}</span>
                                  <span>•</span>
                                  <span>{formatRelativeTime(doc.uploaded_at)}</span>
                                  <span>•</span>
                                  <span className="text-[var(--accent)]"><AiStatusBadge status={doc.ai_index_status} /></span>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-[2.5rem] border border-[var(--workspace-border)] bg-[var(--panel-solid)] p-8 shadow-2xl shadow-black/5">
                        <h3 className="mb-6 text-xl font-bold text-[var(--text-strong)]">Activity</h3>
                        <div className="space-y-4">
                          {overview?.activity.map((item: ActivityItem, index: number) => (
                            <div key={index} className="rounded-2xl border border-[var(--workspace-border)] bg-[var(--panel)] p-4">
                              <p className="text-sm font-bold text-[var(--text-strong)]">{item.title}</p>
                              <p className="mt-1 text-xs text-[var(--text-soft)]">{item.actor}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </section>

                    <section className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
                      <div className="rounded-[2.5rem] border border-[var(--workspace-border)] bg-[var(--panel-solid)] p-8 shadow-2xl shadow-black/5">
                        <div className="mb-5 flex items-center gap-3">
                          <div className="rounded-2xl bg-sky-500/10 p-3 text-sky-600">
                            <Bot size={20} />
                          </div>
                          <div>
                            <h3 className="text-xl font-bold text-[var(--text-strong)]">Workspace AI Agent</h3>
                            <p className="text-sm text-[var(--text-soft)]">
                              Ask about uploads, team activity, or search across indexed documents.
                            </p>
                          </div>
                        </div>
                        <ChatAI title="Workspace Agent" className="h-[420px]" />
                      </div>

                      <div className="rounded-[2.5rem] border border-[var(--workspace-border)] bg-[var(--panel-solid)] p-8 shadow-2xl shadow-black/5">
                        <h3 className="mb-6 text-xl font-bold text-[var(--text-strong)]">AI Readiness</h3>
                        <div className="space-y-4">
                          {recentDocuments.slice(0, 5).map((doc) => (
                            <div key={doc.key} className="rounded-2xl border border-[var(--workspace-border)] bg-[var(--panel)] p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-bold text-[var(--text-strong)]">{formatFilename(doc.filename)}</p>
                                  <p className="mt-1 text-xs text-[var(--text-soft)]">
                                    {doc.ai_chunk_count > 0 ? `${doc.ai_chunk_count} chunks indexed` : "Awaiting first ingest"}
                                  </p>
                                </div>
                                <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[var(--accent)]">
                                  <AiStatusBadge status={doc.ai_index_status} />
                                </span>
                              </div>
                              {doc.ai_error ? (
                                <p className="mt-3 text-xs text-rose-500">{doc.ai_error}</p>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    </section>
                  </>
                )}
              </div>
            )}

                {currentSection === "library" && (
                  <div className="space-y-8">
                    <Uploader onUploadComplete={handleUploadComplete} />
                    <div className="rounded-[2.5rem] border border-[var(--workspace-border)] bg-[var(--panel-solid)] p-8 shadow-2xl shadow-black/5">
                      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row">
                        <div className="relative max-w-md flex-1">
                          <Search className="absolute top-1/2 left-4 -translate-y-1/2 text-[var(--text-soft)]" size={18} />
                          <input
                            className="w-full rounded-2xl border border-[var(--workspace-border)] bg-[var(--workspace-input)] py-3 pr-4 pl-12 text-sm text-[var(--text-strong)] outline-none transition focus:border-[var(--accent)]"
                            placeholder="Filter library..."
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                          />
                        </div>
                        <select
                          className="rounded-2xl border border-[var(--workspace-border)] bg-[var(--workspace-input)] px-4 py-3 text-sm text-[var(--text-strong)] outline-none transition focus:border-[var(--accent)]"
                          value={sortBy}
                          onChange={(event) => setSortBy(event.target.value as SortOption)}
                        >
                          <option value="recent">Recent</option>
                          <option value="name">Name</option>
                          <option value="size">Size</option>
                        </select>
                      </div>

                      <div className="grid gap-4 lg:grid-cols-3 pb-24">
                        {filteredDocuments.map((doc) => (
                          <div key={doc.key} className={`relative rounded-3xl border ${selectedForExtraction.has(doc.key) ? 'border-[var(--accent)] bg-[var(--accent)]/5' : 'border-[var(--workspace-border)] bg-[var(--panel)]'} p-6 transition-all`}>
                            <div className="absolute top-4 right-4 z-10">
                              <input 
                                type="checkbox" 
                                className="h-5 w-5 rounded border-gray-300 accent-[var(--accent)] cursor-pointer"
                                checked={selectedForExtraction.has(doc.key)}
                                onChange={(e) => {
                                  const newSet = new Set(selectedForExtraction);
                                  if (e.target.checked) newSet.add(doc.key);
                                  else newSet.delete(doc.key);
                                  setSelectedForExtraction(newSet);
                                }}
                              />
                            </div>
                            <p className="mb-4 truncate font-bold text-[var(--text-strong)] pr-8">{formatFilename(doc.filename)}</p>
                            <p className="mb-4 text-[10px] font-black uppercase tracking-widest text-[var(--accent)]">
                              <AiStatusBadge status={doc.ai_index_status} />
                            </p>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => handleSelectDocument(doc)}
                                className="flex-1 rounded-xl bg-[var(--button-primary-bg)] py-2 text-xs font-bold text-[var(--button-primary-text)] transition hover:bg-[var(--button-primary-hover)]"
                              >
                                View
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {selectedForExtraction.size > 0 && (
                      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-8">
                        <div className="flex items-center gap-6 rounded-full border border-[var(--workspace-border)] bg-[var(--panel-solid)] px-8 py-4 shadow-2xl shadow-black/20">
                          <span className="text-sm font-bold text-[var(--text-strong)]">
                            <span className="text-[var(--accent)]">{selectedForExtraction.size}</span> document{selectedForExtraction.size !== 1 ? 's' : ''} selected
                          </span>
                          <div className="h-6 w-px bg-[var(--workspace-divider)]" />
                          <button
                            onClick={() => {
                              setSelectedForExtraction(new Set());
                              setExtractionResults(null);
                            }}
                            className="text-xs font-bold uppercase tracking-widest text-[var(--text-soft)] hover:text-[var(--text-strong)] transition-colors"
                          >
                            Clear
                          </button>
                          <button
                            onClick={() => setIsExtractionModalOpen(true)}
                            className="flex items-center gap-2 rounded-full bg-gradient-to-r from-[var(--accent)] to-cyan-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-[var(--accent)]/30 transition-transform hover:scale-105 active:scale-95"
                          >
                            <Sparkles size={16} />
                            Extract Data
                          </button>
                        </div>
                      </div>
                    )}

                    {isExtractionModalOpen && (
                      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm animate-in fade-in">
                        <div className="w-full max-w-4xl overflow-hidden rounded-[2.5rem] border border-[var(--workspace-border)] bg-[var(--panel-solid)] shadow-2xl flex flex-col max-h-[90vh]">
                          <div className="flex items-center justify-between border-b border-[var(--workspace-divider)] p-6">
                            <h2 className="text-xl font-bold text-[var(--text-strong)] flex items-center gap-2">
                              <Sparkles className="text-[var(--accent)]" size={24} />
                              Smart Data Extraction
                            </h2>
                            <button onClick={() => setIsExtractionModalOpen(false)} className="rounded-lg p-2 text-[var(--text-soft)] hover:bg-[var(--workspace-hover)] hover:text-[var(--text-strong)] transition-colors">
                              <X size={20} />
                            </button>
                          </div>
                          
                          <div className="flex-1 overflow-y-auto p-8 space-y-6">
                            {!extractionResults ? (
                              <>
                                <div>
                                  <label className="mb-2 block text-sm font-bold text-[var(--text-strong)]">What data do you want to extract?</label>
                                  <p className="mb-4 text-xs text-[var(--text-soft)]">
                                    Describe the fields you want to pull from the {selectedForExtraction.size} selected document{selectedForExtraction.size !== 1 ? 's' : ''}. The AI will read the documents and output structured data.
                                  </p>
                                  <textarea
                                    value={extractionPrompt}
                                    onChange={(e) => setExtractionPrompt(e.target.value)}
                                    placeholder="e.g. Invoice Number, Total Amount, Due Date, and Vendor Name"
                                    className="h-32 w-full rounded-2xl border border-[var(--workspace-border)] bg-[var(--workspace-input)] p-4 text-sm text-[var(--text-strong)] outline-none transition focus:border-[var(--accent)]"
                                  />
                                </div>
                                <div className="rounded-2xl bg-[var(--accent-soft)] p-4 text-sm text-[var(--accent)] flex items-start gap-3">
                                  <Bot size={20} className="shrink-0 mt-0.5" />
                                  <p><strong>Pro Tip:</strong> Be specific about the data types. E.g., "Total Amount (number only), Date (YYYY-MM-DD)".</p>
                                </div>
                              </>
                            ) : (
                              <div className="overflow-x-auto rounded-2xl border border-[var(--workspace-border)] bg-[var(--workspace-input)]">
                                <table className="w-full text-left text-sm">
                                  <thead className="border-b border-[var(--workspace-divider)] bg-[var(--panel-muted)]">
                                    <tr>
                                      {Array.from(new Set(extractionResults.flatMap(r => Object.keys(r)))).map(key => (
                                        <th key={key} className="p-4 font-bold text-[var(--text-strong)]">{key}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-[var(--workspace-divider)]">
                                    {extractionResults.map((row, i) => (
                                      <tr key={i} className="hover:bg-[var(--panel-solid)] transition-colors">
                                        {Array.from(new Set(extractionResults.flatMap(r => Object.keys(r)))).map((key, j) => (
                                          <td key={j} className="p-4 text-[var(--text-soft)]">
                                            {typeof row[key] === 'object' && row[key] !== null 
                                              ? JSON.stringify(row[key]) 
                                              : String(row[key] ?? '-')}
                                          </td>
                                        ))}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                          
                          <div className="border-t border-[var(--workspace-divider)] p-6 flex justify-end gap-4 bg-[var(--panel)]">
                            {!extractionResults ? (
                              <button
                                onClick={async () => {
                                  if (!extractionPrompt) return;
                                  setExtracting(true);
                                  try {
                                    const res = await api.post("/ai/extract", {
                                      document_keys: Array.from(selectedForExtraction),
                                      schema_prompt: extractionPrompt
                                    });
                                    setExtractionResults(res.data.data);
                                    pushToast("Extraction Complete", "Successfully extracted data.", "success");
                                  } catch (e) {
                                    pushToast("Extraction Failed", getApiErrorMessage(e, "Failed to extract data"), "warning");
                                  } finally {
                                    setExtracting(false);
                                  }
                                }}
                                disabled={extracting || !extractionPrompt.trim()}
                                className="flex items-center gap-2 rounded-xl bg-[var(--button-primary-bg)] px-6 py-3 text-sm font-bold text-[var(--button-primary-text)] transition hover:bg-[var(--button-primary-hover)] disabled:opacity-50"
                              >
                                {extracting ? <LoaderCircle className="animate-spin" size={18} /> : <Sparkles size={18} />}
                                {extracting ? "Extracting Data..." : "Run Extraction"}
                              </button>
                            ) : (
                              <>
                                <button
                                  onClick={() => setExtractionResults(null)}
                                  className="px-6 py-3 text-sm font-bold text-[var(--text-soft)] transition hover:text-[var(--text-strong)]"
                                >
                                  Start Over
                                </button>
                                <button
                                  onClick={() => {
                                    if (!extractionResults || extractionResults.length === 0) return;
                                    const allKeys = Array.from(new Set(extractionResults.flatMap(r => Object.keys(r))));
                                    const csvContent = [
                                      allKeys.join(','),
                                      ...extractionResults.map(row => allKeys.map(k => {
                                        let val = row[k];
                                        if (val === null || val === undefined) val = "";
                                        else if (typeof val === 'object') val = JSON.stringify(val);
                                        return `"${String(val).replace(/"/g, '""')}"`;
                                      }).join(','))
                                    ].join('\n');
                                    
                                    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                                    const link = document.createElement('a');
                                    link.href = URL.createObjectURL(blob);
                                    link.download = `extracted_data_${new Date().getTime()}.csv`;
                                    link.click();
                                  }}
                                  className="flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 text-sm font-bold text-white transition hover:bg-emerald-600 shadow-lg shadow-emerald-500/30"
                                >
                                  <HardDrive size={18} />
                                  Download CSV
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {currentSection === "viewer" && (
                  <div className={`grid gap-6 ${isChatOpen ? "xl:grid-cols-[minmax(0,1fr)_380px]" : "grid-cols-1"} min-h-[calc(100vh-8rem)] xl:h-[calc(100vh-8rem)]`}>
                    <div className="flex flex-col gap-6 overflow-hidden">
                      <div className="flex flex-shrink-0 gap-8 overflow-x-auto rounded-2xl border border-[var(--workspace-border)] bg-[var(--panel-solid)] px-6 py-5 shadow-xl shadow-black/5">
                        <div className="min-w-[120px]">
                          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-soft)]">Selected file</p>
                          <p className="mt-1 truncate text-sm font-bold text-[var(--text-strong)] max-w-xs">{selectedDocument ? formatFilename(selectedDocument.filename) : "No file selected"}</p>
                        </div>
                        <div className="min-w-[120px]">
                          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-soft)]">Uploaded</p>
                          <p className="mt-1 text-sm font-bold text-[var(--text-strong)]">{selectedDocument ? formatTimestamp(selectedDocument.uploaded_at) : "Not available"}</p>
                        </div>
                        <div className="min-w-[120px]">
                          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-soft)]">AI status</p>
                          <p className="mt-1 text-sm font-bold text-[var(--text-strong)]"><AiStatusBadge status={selectedDocument?.ai_index_status} /></p>
                        </div>
                      </div>

                      <div className="flex-1 overflow-hidden min-h-[500px] xl:min-h-0 rounded-[2.5rem] border border-[var(--workspace-border)] bg-[var(--viewer-bg)] shadow-2xl shadow-black/5">
                        {selectedDocument ? (
                          <Suspense fallback={<div className="flex h-full items-center justify-center text-[var(--text-soft)]">Loading PDF...</div>}>
                            <PdfViewer url={ `${API_BASE_URL}/pdf/stream/${encodeURIComponent(selectedDocument.filename)}`} />
                          </Suspense>
                        ) : (
                          <div className="flex h-full flex-col items-center justify-center text-[var(--text-soft)]">
                            <Shield size={48} className="mb-4 opacity-20" />
                            <p>Select a document from the library to begin review.</p>
                            <button onClick={() => navigateTo("library")} className="mt-4 rounded-xl bg-[var(--button-primary-bg)] px-4 py-2 text-sm font-bold text-[var(--button-primary-text)] transition hover:bg-[var(--button-primary-hover)]">Go to Library</button>
                          </div>
                        )}
                      </div>
                    </div>

                    {isChatOpen && (
                      <div className="flex flex-col overflow-hidden min-h-[500px] xl:min-h-0">
                        <div className="flex flex-1 flex-col overflow-hidden rounded-[2.5rem] border border-[var(--workspace-border)] bg-[var(--panel-solid)] shadow-2xl shadow-black/5">
                          <div className="flex items-center justify-between border-b border-[var(--workspace-divider)] px-6 py-4">
                            <div className="flex items-center gap-2">
                              <Bot size={18} className="text-[var(--accent)]" />
                              <h3 className="text-lg font-bold text-[var(--text-strong)]">AI Insights</h3>
                            </div>
                            <button onClick={() => setIsChatOpen(false)} className="rounded-lg p-2 text-[var(--text-soft)] hover:bg-[var(--workspace-hover)] hover:text-[var(--text-strong)] transition-colors">
                              <X size={18} />
                            </button>
                          </div>
                          <div className="flex-1 overflow-hidden p-0">
                            {selectedDocument ? (
                              <ChatAI docKey={selectedDocument.key} title="Document AI" className="h-full !border-0 !rounded-none shadow-none" />
                            ) : (
                              <ChatAI title="Workspace Agent" className="h-full !border-0 !rounded-none shadow-none" />
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {currentSection === "team" && canManageTeam && (
                  <div className="rounded-[2.5rem] border border-[var(--workspace-border)] bg-[var(--panel-solid)] p-8 shadow-2xl shadow-black/5">
                    <div className="mb-8 flex items-center justify-between">
                      <h3 className="text-xl font-bold text-[var(--text-strong)]">Member Access</h3>
                      <button
                        type="button"
                        onClick={() => setIsInviteOpen(true)}
                        className="rounded-xl border border-[var(--button-secondary-border)] bg-[var(--button-secondary-bg)] px-4 py-2 text-xs font-bold text-[var(--button-secondary-text)] transition hover:bg-[var(--button-secondary-hover)]"
                      >
                        Invite New
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className="border-b border-[var(--workspace-divider)] text-[10px] font-black uppercase tracking-widest text-[var(--text-soft)]">
                          <tr>
                            <th className="pb-4">User</th>
                            <th className="pb-4">Role</th>
                            <th className="pb-4">Status</th>
                          </tr>
                        </thead>
                        <tbody className="text-sm">
                          {users.map((user) => (
                            <tr key={user._id} className="border-b border-[var(--workspace-border)]">
                              <td className="py-4 font-bold text-[var(--text-strong)]">{user.name}</td>
                              <td className="py-4 capitalize text-[var(--text-soft)]">{user.role}</td>
                              <td className="py-4">
                                <span
                                  className={`rounded-md px-2 py-1 text-[10px] font-bold ${
                                    user.is_active ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                                  }`}
                                >
                                  {user.is_active ? "Active" : "Inactive"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>

      <InviteModal
        isOpen={isInviteOpen}
        onClose={() => {
          setIsInviteOpen(false);
          void loadWorkspace(true);
        }}
      />

      <div className="fixed right-8 bottom-8 z-[100] flex flex-col items-end gap-4">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="animate-in slide-in-from-right rounded-2xl border border-[var(--workspace-border)] bg-[var(--panel-solid)] px-6 py-4 shadow-2xl shadow-black/10 duration-300 w-80"
          >
            <p className="mb-1 text-xs font-black uppercase tracking-widest text-[var(--accent)]">{toast.title}</p>
            <p className="text-sm text-[var(--text-strong)]">{toast.detail}</p>
          </div>
        ))}

        {/* Global Floating AI Modal */}
        {isChatOpen && currentSection !== "viewer" && (
          <div className="animate-in slide-in-from-bottom-4 mb-2 flex h-[500px] w-[380px] flex-col overflow-hidden rounded-[2.5rem] border border-[var(--workspace-border)] bg-[var(--panel-solid)] shadow-2xl shadow-black/20">
            <div className="flex items-center justify-between border-b border-[var(--workspace-divider)] px-6 py-4">
              <div className="flex items-center gap-2">
                <Bot size={18} className="text-[var(--accent)]" />
                <h3 className="text-lg font-bold text-[var(--text-strong)]">Workspace Agent</h3>
              </div>
              <button onClick={() => setIsChatOpen(false)} className="rounded-lg p-2 text-[var(--text-soft)] hover:bg-[var(--workspace-hover)] hover:text-[var(--text-strong)] transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-hidden p-0">
              <ChatAI title="Workspace Agent" className="h-full !border-0 !rounded-none shadow-none" />
            </div>
          </div>
        )}

        {/* Floating AI Action Button */}
        {!(isChatOpen && currentSection === "viewer") && (
          <button
            type="button"
            onClick={() => setIsChatOpen((prev) => !prev)}
            className="group flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[var(--accent)] to-cyan-600 text-white shadow-xl shadow-[var(--accent)]/30 transition-transform hover:scale-110 active:scale-95"
            aria-label="Toggle AI Assistant"
          >
            {isChatOpen ? <X size={24} /> : <Bot size={24} className="transition-transform group-hover:scale-110" />}
          </button>
        )}
      </div>

      {isCommandPaletteOpen && (
        <div className="fixed inset-0 z-[200] flex items-start justify-center bg-black/40 px-4 pt-20 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-[var(--border-strong)] bg-[var(--panel)] shadow-2xl">
            <div className="border-b border-[var(--border-strong)] p-4">
              <input
                id="command-palette-input"
                type="text"
                placeholder="Type a command..."
                value={commandQuery}
                onChange={(event) => setCommandQuery(event.target.value)}
                className="w-full bg-transparent text-[var(--text-strong)] outline-none placeholder:text-[var(--text-soft)]"
                autoFocus
              />
            </div>
            <div className="max-h-80 overflow-y-auto">
              {filteredCommands.map((command, index) => (
                <button
                  key={command.id}
                  type="button"
                  onClick={() => handleCommandSelect(command.action)}
                  className={`flex w-full items-center justify-between px-4 py-3 text-left transition-colors ${
                    index === commandSelectionIndex
                      ? "bg-[var(--panel-muted)] text-[var(--text-strong)]"
                      : "hover:bg-[var(--panel-muted)]"
                  }`}
                >
                  <span className="text-[var(--text-strong)]">{command.label}</span>
                  {command.shortcut && (
                    <span className="rounded bg-[var(--panel-muted)] px-2 py-1 font-mono text-xs text-[var(--text-soft)]">
                      {command.shortcut}
                    </span>
                  )}
                </button>
              ))}
              {filteredCommands.length === 0 && <div className="px-4 py-8 text-center text-[var(--text-soft)]">No commands found</div>}
            </div>
            <div className="border-t border-[var(--border-strong)] p-4 text-xs text-[var(--text-soft)]">
              <div className="flex justify-between">
                <span>Arrow keys</span>
                <span>Enter to select</span>
                <span>Esc to close</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
