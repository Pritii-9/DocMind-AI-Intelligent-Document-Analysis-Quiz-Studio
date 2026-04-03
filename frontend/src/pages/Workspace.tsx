import { useEffect, useMemo, useState, Suspense, lazy } from "react";
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
} from "lucide-react";

import api, { API_BASE_URL } from "../api/axios";
import InviteModal from "../components/InviteModal";
import Sidebar, { type AppSection } from "../components/Sidebar";
import ThemeToggle from "../components/ThemeToggle";
import Uploader from "../components/Uploader";
import { useAuth } from "../context/AuthContext";
import type { PdfDocument, WorkspaceOverview } from "../types/pdf";
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

  const [documents, setDocuments] = useState<PdfDocument[]>([]);
  const [overview, setOverview] = useState<WorkspaceOverview | null>(null);
  const [users, setUsers] = useState<WorkspaceUser[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<PdfDocument | null>(null);

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
    } catch (err: any) {
      setError(err.response?.data?.msg || "Unable to load workspace data.");
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
  const latestDocument = recentDocuments[0] ?? null;

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
                      <span className="text-[var(--text-soft)]">/</span>
                      <span className="truncate text-[var(--accent)]">{selectedDocument.filename}</span>
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
                <button
                  type="button"
                  onClick={logout}
                  className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm font-medium text-rose-500 transition-colors hover:bg-rose-500/20 hover:text-rose-600"
                  title="Logout"
                  aria-label="Logout"
                >
                  <LogOut size={16} />
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
                      <div className="rounded-[2.5rem] border border-[var(--workspace-border)] bg-[var(--panel-solid)] p-8 shadow-2xl shadow-black/5">
                        <h3 className="mb-6 text-xl font-bold text-[var(--text-strong)]">Recent Documents</h3>
                        <div className="grid gap-4 sm:grid-cols-2">
                          {overview?.documents.map((doc: PdfDocument) => (
                            <button
                              key={doc.key}
                              type="button"
                              onClick={() => handleSelectDocument(doc)}
                              className="group rounded-3xl border border-[var(--workspace-border)] bg-[var(--panel)] p-5 text-left transition-all hover:border-[var(--accent)]/50 hover:bg-[var(--panel-muted)]"
                            >
                              <p className="truncate font-bold text-[var(--text-strong)] transition-colors group-hover:text-[var(--accent)]">
                                {doc.filename}
                              </p>
                              <p className="mt-1 text-xs text-[var(--text-soft)]">{formatBytes(doc.size_bytes)}</p>
                              <div className="mt-4 text-[10px] font-bold uppercase tracking-widest text-[var(--text-soft)]">
                                {formatRelativeTime(doc.uploaded_at)}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-[2.5rem] border border-[var(--workspace-border)] bg-[var(--panel-solid)] p-8 shadow-2xl shadow-black/5">
                        <h3 className="mb-6 text-xl font-bold text-[var(--text-strong)]">Activity</h3>
                        <div className="space-y-4">
                          {overview?.activity.map((item: any, index: number) => (
                            <div key={index} className="rounded-2xl border border-[var(--workspace-border)] bg-[var(--panel)] p-4">
                              <p className="text-sm font-bold text-[var(--text-strong)]">{item.title}</p>
                              <p className="mt-1 text-xs text-[var(--text-soft)]">{item.actor}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </section>
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

                      <div className="grid gap-4 lg:grid-cols-3">
                        {filteredDocuments.map((doc) => (
                          <div key={doc.key} className="rounded-3xl border border-[var(--workspace-border)] bg-[var(--panel)] p-6">
                            <p className="mb-4 truncate font-bold text-[var(--text-strong)]">{doc.filename}</p>
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
                  </div>
                )}

                {currentSection === "viewer" && (
                  <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
                    <aside className="rounded-[2.5rem] border border-[var(--workspace-border)] bg-[var(--panel-solid)] p-6 shadow-2xl shadow-black/5">
                      <div className="inline-flex items-center gap-2 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent)]">
                        <Sparkles size={14} />
                        Live Review
                      </div>
                      <h3 className="mt-4 text-xl font-bold text-[var(--text-strong)]">Recent document stream</h3>
                      <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">
                        Pick any uploaded PDF, jump to the newest file, and review changes without going back to the library.
                      </p>

                      <div className="mt-5 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                        <div className="rounded-2xl border border-[var(--workspace-border)] bg-[var(--panel)] p-4">
                          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-soft)]">Latest upload</p>
                          <p className="mt-2 truncate text-sm font-bold text-[var(--text-strong)]">
                            {latestDocument?.filename || "No documents yet"}
                          </p>
                          <p className="mt-1 text-xs text-[var(--text-soft)]">
                            {latestDocument ? formatRelativeTime(latestDocument.uploaded_at) : "Upload a PDF to begin"}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-[var(--workspace-border)] bg-[var(--panel)] p-4">
                          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-soft)]">Current file</p>
                          <p className="mt-2 truncate text-sm font-bold text-[var(--text-strong)]">
                            {selectedDocument?.filename || "Nothing selected"}
                          </p>
                          <p className="mt-1 text-xs text-[var(--text-soft)]">
                            {selectedDocument ? formatBytes(selectedDocument.size_bytes) : "Choose from the stream list"}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-[var(--workspace-border)] bg-[var(--panel)] p-4">
                          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-soft)]">Live sync</p>
                          <p className="mt-2 text-sm font-bold text-[var(--text-strong)]">{sseConnected ? "Connected" : "Waiting"}</p>
                          <p className="mt-1 text-xs text-[var(--text-soft)]">
                            {sseConnected ? "Workspace refresh is live." : "Reconnect to resume live updates."}
                          </p>
                        </div>
                      </div>

                      <div className="mt-6 flex gap-3">
                        <button
                          type="button"
                          onClick={() => latestDocument && handleSelectDocument(latestDocument)}
                          disabled={!latestDocument}
                          className="flex-1 rounded-2xl bg-[var(--button-primary-bg)] px-4 py-3 text-sm font-bold text-[var(--button-primary-text)] transition hover:bg-[var(--button-primary-hover)] disabled:opacity-50"
                        >
                          Open latest upload
                        </button>
                        <button
                          type="button"
                          onClick={() => navigateTo("library")}
                          className="rounded-2xl border border-[var(--button-secondary-border)] bg-[var(--button-secondary-bg)] px-4 py-3 text-sm font-bold text-[var(--button-secondary-text)] transition hover:bg-[var(--button-secondary-hover)]"
                        >
                          Library
                        </button>
                      </div>

                      <div className="mt-6 space-y-3">
                        {recentDocuments.length > 0 ? (
                          recentDocuments.slice(0, 8).map((doc) => {
                            const isActive = selectedDocument?.key === doc.key;
                            return (
                              <button
                                key={doc.key}
                                type="button"
                                onClick={() => handleSelectDocument(doc)}
                                className={`w-full rounded-2xl border p-4 text-left transition ${
                                  isActive
                                    ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                                    : "border-[var(--workspace-border)] bg-[var(--panel)] hover:bg-[var(--panel-muted)]"
                                }`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-bold text-[var(--text-strong)]">{doc.filename}</p>
                                    <p className="mt-1 text-xs text-[var(--text-soft)]">
                                      {doc.uploaded_by_name || doc.uploaded_by || "Unknown uploader"}
                                    </p>
                                  </div>
                                  <span className="shrink-0 rounded-full bg-[var(--workspace-input)] px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-[var(--text-soft)]">
                                    {formatBytes(doc.size_bytes)}
                                  </span>
                                </div>
                                <p className="mt-3 text-xs text-[var(--text-soft)]">{formatTimestamp(doc.uploaded_at)}</p>
                              </button>
                            );
                          })
                        ) : (
                          <div className="rounded-2xl border border-dashed border-[var(--workspace-border)] bg-[var(--panel)] p-6 text-center text-sm text-[var(--text-soft)]">
                            Upload a PDF and it will appear here for quick review.
                          </div>
                        )}
                      </div>
                    </aside>

                    <div className="space-y-6">
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="rounded-2xl border border-[var(--workspace-border)] bg-[var(--panel-solid)] p-5 shadow-xl shadow-black/5">
                          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-soft)]">Selected file</p>
                          <p className="mt-2 truncate text-base font-bold text-[var(--text-strong)]">
                            {selectedDocument?.filename || "No file selected"}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-[var(--workspace-border)] bg-[var(--panel-solid)] p-5 shadow-xl shadow-black/5">
                          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-soft)]">Uploaded</p>
                          <p className="mt-2 text-base font-bold text-[var(--text-strong)]">
                            {selectedDocument ? formatTimestamp(selectedDocument.uploaded_at) : "Not available"}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-[var(--workspace-border)] bg-[var(--panel-solid)] p-5 shadow-xl shadow-black/5">
                          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-soft)]">Uploaded by</p>
                          <p className="mt-2 truncate text-base font-bold text-[var(--text-strong)]">
                            {selectedDocument?.uploaded_by_name || selectedDocument?.uploaded_by || "Unknown uploader"}
                          </p>
                        </div>
                      </div>

                      <div className="h-[calc(100vh-18rem)] overflow-hidden rounded-[2.5rem] border border-[var(--workspace-border)] bg-[var(--viewer-bg)] shadow-2xl shadow-black/5">
                        {selectedDocument ? (
                          <Suspense fallback={<div className="flex h-full items-center justify-center text-[var(--text-soft)]">Loading PDF...</div>}>
                            <PdfViewer url={`${API_BASE_URL}/pdf/stream/${encodeURIComponent(selectedDocument.filename)}`} />
                          </Suspense>
                        ) : (
                          <div className="flex h-full flex-col items-center justify-center text-[var(--text-soft)]">
                            <Shield size={48} className="mb-4 opacity-20" />
                            <p>Select a document from the stream list to begin review.</p>
                          </div>
                        )}
                      </div>
                    </div>
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

      <div className="fixed right-8 bottom-8 z-[100] flex flex-col gap-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="animate-in slide-in-from-right rounded-2xl border border-[var(--workspace-border)] bg-[var(--panel-solid)] px-6 py-4 shadow-2xl shadow-black/10 duration-300"
          >
            <p className="mb-1 text-xs font-black uppercase tracking-widest text-[var(--accent)]">{toast.title}</p>
            <p className="text-sm text-[var(--text-strong)]">{toast.detail}</p>
          </div>
        ))}
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
