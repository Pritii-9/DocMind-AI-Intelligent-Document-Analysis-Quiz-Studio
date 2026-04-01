import {
  ArrowRight,
  ArrowUpRight,
  Clock3,
  FileText,
  Filter,
  FolderOpen,
  HardDrive,
  LoaderCircle,
  RefreshCcw,
  Search,
  Shield,
  Sparkles,
  UserCog,
  UserPlus,
  Users,
} from "lucide-react";
import { Suspense, lazy, useEffect, useMemo, useState } from "react";

import api, { API_BASE_URL } from "../api/axios";
import InviteModal from "../components/InviteModal";
import Sidebar, { type AppSection } from "../components/Sidebar";
import ThemeToggle from "../components/ThemeToggle";
import Uploader from "../components/Uploader";
import { useAuth } from "../context/AuthContext";
import type { ActivityItem, PdfDocument, WorkspaceOverview } from "../types/pdf";
import type { WorkspaceUser } from "../types/user";

const sectionLabels: Record<AppSection, string> = {
  overview: "Workspace Overview",
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
    if (hash === "team" && !canManageTeam) {
      return "overview";
    }
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

function formatTimestamp(value: string | null) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
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

export default function Workspace() {
  const { role, userName } = useAuth();
  const canManageTeam = role === "admin";
  const [currentSection, setCurrentSection] = useState<AppSection>(() => getInitialSection(canManageTeam));
  const [documents, setDocuments] = useState<PdfDocument[]>([]);
  const [overview, setOverview] = useState<WorkspaceOverview | null>(null);
  const [users, setUsers] = useState<WorkspaceUser[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<PdfDocument | null>(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("recent");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInviteOpen, setIsInviteOpen] = useState(false);

  const loadWorkspace = async (showRefreshState = false) => {
    if (showRefreshState) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const requests: Promise<unknown>[] = [
        api.get<WorkspaceOverview>("/pdf/overview"),
        api.get<PdfDocument[]>("/pdf/library"),
      ];

      if (canManageTeam) {
        requests.push(api.get<WorkspaceUser[]>("/auth/users"));
      }

      const responses = await Promise.all(requests);
      const overviewResponse = responses[0] as { data: WorkspaceOverview };
      const libraryResponse = responses[1] as { data: PdfDocument[] };
      const usersResponse = canManageTeam ? (responses[2] as { data: WorkspaceUser[] }) : null;

      const nextDocuments = libraryResponse.data;
      setDocuments(nextDocuments);
      setOverview(overviewResponse.data);
      setUsers(usersResponse?.data ?? []);
      setSelectedDocument((current) => {
        if (nextDocuments.length === 0) return null;
        if (!current) return nextDocuments[0];
        return nextDocuments.find((item) => item.key === current.key) ?? nextDocuments[0];
      });
      return nextDocuments;
    } catch (err) {
      if (typeof err === "object" && err !== null && "response" in err) {
        const response = (err as { response?: { data?: { msg?: string } } }).response;
        setError(response?.data?.msg || "Unable to load workspace data.");
      } else {
        setError("Unable to load workspace data.");
      }
      return [];
    } finally {
      setLoading(false);
      setRefreshing(false);
    }

    return [];
  };

  useEffect(() => {
    void loadWorkspace();
  }, [canManageTeam]);

  useEffect(() => {
    const onHashChange = () => setCurrentSection(getInitialSection(canManageTeam));
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [canManageTeam]);

  const navigateTo = (section: AppSection) => {
    const next = section === "team" && !canManageTeam ? "overview" : section;
    setCurrentSection(next);
    window.location.hash = next;
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSelectDocument = (document: PdfDocument) => {
    setSelectedDocument(document);
    navigateTo("viewer");
  };

  const filteredDocuments = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    const result = documents.filter((document) => document.filename.toLowerCase().includes(normalized));

    result.sort((a, b) => {
      if (sortBy === "name") return a.filename.localeCompare(b.filename);
      if (sortBy === "size") return b.size_bytes - a.size_bytes;
      return new Date(b.uploaded_at || 0).getTime() - new Date(a.uploaded_at || 0).getTime();
    });

    return result;
  }, [documents, search, sortBy]);

  const activeMembers = useMemo(
    () => users.filter((user) => user.is_active).length || overview?.stats.active_members || 1,
    [overview?.stats.active_members, users]
  );

  const summaryCards = [
    { label: "Protected documents", value: overview?.stats.total_documents ?? documents.length, detail: `${filteredDocuments.length} visible in library`, icon: FileText },
    { label: "Storage footprint", value: formatBytes(overview?.stats.total_storage_bytes ?? 0), detail: "Indexed for reporting and fast access", icon: HardDrive },
    { label: "Active members", value: activeMembers, detail: `${overview?.stats.verified_members ?? activeMembers} verified accounts`, icon: Users },
    { label: "Last upload", value: formatRelativeTime(overview?.stats.last_upload_at ?? null), detail: formatTimestamp(overview?.stats.last_upload_at ?? null), icon: Clock3 },
  ];

  const activity = overview?.activity ?? [];
  const recentDocuments = overview?.documents ?? documents.slice(0, 6);
  const mobileSections = canManageTeam ? validSections : validSections.filter((section) => section !== "team");

  return (
    <div className="min-h-screen lg:flex">
      <Sidebar
        currentSection={currentSection}
        onNavigate={navigateTo}
        canManageTeam={canManageTeam}
        documentCount={documents.length}
        teamCount={canManageTeam ? users.length : activeMembers}
        selectedDocumentName={selectedDocument?.filename}
      />

      <main className="min-w-0 flex-1">
        <div className="sticky top-0 z-20 border-b border-black/5 bg-[var(--app-bg)]/85 backdrop-blur dark:border-white/10">
          <div className="mx-auto max-w-7xl px-6 py-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-soft)]">Welcome, {userName}</p>
                <h2 className="mt-1 font-display text-3xl font-semibold text-[var(--text-strong)]">{sectionLabels[currentSection]}</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">Smoothly navigate between analytics, documents, viewer controls, and access management in one executive-ready workspace.</p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => void loadWorkspace(true)} className="inline-flex items-center gap-2 rounded-full bg-[var(--panel)] px-4 py-2 text-sm font-semibold text-[var(--text-strong)] shadow-sm transition hover:text-[var(--accent)]">
                  <RefreshCcw size={16} className={refreshing ? "animate-spin" : ""} />
                  Refresh data
                </button>
                <ThemeToggle />
              </div>
            </div>

            <div className="mt-4 flex gap-3 overflow-x-auto pb-1 lg:hidden">
              {mobileSections.map((section) => (
                <button key={section} type="button" onClick={() => navigateTo(section)} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${currentSection === section ? "bg-[var(--accent)] text-white" : "bg-[var(--panel)] text-[var(--text-soft)]"}`}>
                  {sectionLabels[section]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-6 py-8">
          {loading ? (
            <div className="flex min-h-[60vh] items-center justify-center">
              <div className="flex items-center gap-3 rounded-full bg-[var(--panel)] px-5 py-3 text-sm font-medium text-[var(--text-soft)] shadow-sm">
                <LoaderCircle size={18} className="animate-spin" />
                Loading workspace
              </div>
            </div>
          ) : error ? (
            <div className="rounded-[2rem] border border-rose-200 bg-rose-50 p-6 text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-200">{error}</div>
          ) : (
            <div className="animate-[fade-slide_320ms_ease] space-y-8">
              {currentSection === "overview" && (
                <div className="space-y-8">
                  <section className="grid gap-4 xl:grid-cols-4">
                    {summaryCards.map((card) => {
                      const Icon = card.icon;
                      return (
                        <article key={card.label} className="rounded-[2rem] border border-black/5 bg-[var(--panel)] p-6 shadow-sm dark:border-white/10">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-soft)]">{card.label}</p>
                              <p className="mt-3 font-display text-3xl font-semibold text-[var(--text-strong)]">{card.value}</p>
                            </div>
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]"><Icon size={20} /></div>
                          </div>
                          <p className="mt-4 text-sm leading-6 text-[var(--text-soft)]">{card.detail}</p>
                        </article>
                      );
                    })}
                  </section>

                  <section className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
                    <article className="rounded-[2rem] border border-black/5 bg-[var(--panel)] p-6 shadow-sm dark:border-white/10">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-soft)]">Recent uploads</p>
                          <h3 className="mt-2 font-display text-2xl font-semibold text-[var(--text-strong)]">Latest document activity</h3>
                        </div>
                        <button type="button" onClick={() => navigateTo("library")} className="inline-flex items-center gap-2 rounded-full bg-[var(--panel-muted)] px-4 py-2 text-sm font-semibold text-[var(--text-strong)] transition hover:text-[var(--accent)]">Open library<ArrowUpRight size={16} /></button>
                      </div>

                      <div className="mt-6 grid gap-4 md:grid-cols-2">
                        {recentDocuments.length === 0 ? (
                          <div className="rounded-3xl border border-dashed border-[var(--border-strong)] bg-[var(--panel-muted)] p-8 text-sm text-[var(--text-soft)] md:col-span-2">Upload your first PDF to populate analytics, viewer insights, and team activity.</div>
                        ) : (
                          recentDocuments.map((document) => (
                            <button key={document.key} type="button" onClick={() => handleSelectDocument(document)} className="rounded-3xl border border-black/5 bg-[var(--panel-muted)] p-5 text-left transition hover:-translate-y-0.5 hover:border-[var(--accent)]/30 hover:shadow-lg dark:border-white/10">
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <p className="font-semibold text-[var(--text-strong)]">{document.filename}</p>
                                  <p className="mt-2 text-sm text-[var(--text-soft)]">Uploaded by {document.uploaded_by_name || document.uploaded_by || "workspace member"}</p>
                                </div>
                                <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[var(--accent)] shadow-sm dark:bg-slate-950">{formatBytes(document.size_bytes)}</div>
                              </div>
                              <p className="mt-4 text-xs font-medium uppercase tracking-[0.22em] text-[var(--text-soft)]">{formatTimestamp(document.uploaded_at)}</p>
                            </button>
                          ))
                        )}
                      </div>
                    </article>

                    <article className="rounded-[2rem] border border-black/5 bg-[var(--panel)] p-6 shadow-sm dark:border-white/10">
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-soft)]">Operational feed</p>
                      <h3 className="mt-2 font-display text-2xl font-semibold text-[var(--text-strong)]">Workspace activity</h3>
                      <div className="mt-6 space-y-4">
                        {activity.length === 0 ? (
                          <div className="rounded-3xl border border-dashed border-[var(--border-strong)] bg-[var(--panel-muted)] p-6 text-sm leading-6 text-[var(--text-soft)]">Activity will appear here as documents are uploaded and team members join the workspace.</div>
                        ) : (
                          activity.map((item: ActivityItem, index) => (
                            <div key={`${item.title}-${index}`} className="rounded-3xl border border-black/5 bg-[var(--panel-muted)] p-4 dark:border-white/10">
                              <p className="font-semibold text-[var(--text-strong)]">{item.title}</p>
                              <p className="mt-2 text-sm text-[var(--text-soft)]">{item.actor || "Workspace event"}</p>
                              <p className="mt-2 text-xs font-medium uppercase tracking-[0.22em] text-[var(--text-soft)]">{formatRelativeTime(item.timestamp)}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </article>
                  </section>
                </div>
              )}

              {currentSection === "library" && (
                <div className="space-y-8">
                  <Uploader
                    onUploadComplete={async (uploadedFileName) => {
                      const nextDocuments = await loadWorkspace(true);
                      if (!uploadedFileName) return;
                      const uploadedDocument = nextDocuments.find(
                        (document) => document.filename === uploadedFileName
                      );
                      if (uploadedDocument) {
                        handleSelectDocument(uploadedDocument);
                      }
                    }}
                  />

                  <section className="rounded-[2rem] border border-black/5 bg-[var(--panel)] p-6 shadow-sm dark:border-white/10">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-soft)]">Document intelligence</p>
                        <h3 className="mt-2 font-display text-2xl font-semibold text-[var(--text-strong)]">Search, sort, and open workspace documents</h3>
                      </div>
                      <div className="flex flex-col gap-3 sm:flex-row">
                        <label className="relative min-w-[16rem]"><Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-soft)]" size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by filename" className="w-full rounded-2xl border border-black/5 bg-[var(--panel-muted)] py-3 pl-11 pr-4 text-sm text-[var(--text-strong)] outline-none transition focus:border-[var(--accent)] dark:border-white/10" /></label>
                        <label className="relative min-w-[12rem]"><Filter className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-soft)]" size={16} /><select value={sortBy} onChange={(event) => setSortBy(event.target.value as SortOption)} className="w-full appearance-none rounded-2xl border border-black/5 bg-[var(--panel-muted)] py-3 pl-11 pr-10 text-sm text-[var(--text-strong)] outline-none transition focus:border-[var(--accent)] dark:border-white/10"><option value="recent">Sort by recent</option><option value="name">Sort by name</option><option value="size">Sort by size</option></select></label>
                      </div>
                    </div>

                    <div className="mt-6 grid gap-4 xl:grid-cols-3">
                      {filteredDocuments.length === 0 ? (
                        <div className="rounded-3xl border border-dashed border-[var(--border-strong)] bg-[var(--panel-muted)] p-10 text-center text-[var(--text-soft)] xl:col-span-3"><FolderOpen className="mx-auto mb-3" size={30} />No documents match your current search.</div>
                      ) : (
                        filteredDocuments.map((document) => (
                          <article key={document.key} className="rounded-3xl border border-black/5 bg-[var(--panel-muted)] p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:border-white/10">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <p className="font-semibold text-[var(--text-strong)]">{document.filename}</p>
                                <p className="mt-2 text-sm text-[var(--text-soft)]">Uploaded by {document.uploaded_by_name || document.uploaded_by || "workspace member"}</p>
                              </div>
                              <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[var(--accent)] shadow-sm dark:bg-slate-950">{formatBytes(document.size_bytes)}</div>
                            </div>

                            <div className="mt-5 space-y-2 text-sm text-[var(--text-soft)]">
                              <p>Uploaded: {formatTimestamp(document.uploaded_at)}</p>
                              <p>Last viewed: {formatRelativeTime(document.last_accessed_at)}</p>
                            </div>

                            <div className="mt-6 flex items-center gap-3">
                              <button type="button" onClick={() => handleSelectDocument(document)} className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110">Open viewer<ArrowRight size={16} /></button>
                              <button type="button" onClick={() => setSelectedDocument(document)} className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-[var(--text-strong)] shadow-sm transition hover:text-[var(--accent)] dark:bg-slate-950">Inspect<Sparkles size={16} /></button>
                            </div>
                          </article>
                        ))
                      )}
                    </div>
                  </section>
                </div>
              )}

              {currentSection === "viewer" && (
                <div className="grid gap-6 xl:grid-cols-[0.36fr_0.64fr]">
                  <section className="space-y-6">
                    <article className="rounded-[2rem] border border-black/5 bg-[var(--panel)] p-6 shadow-sm dark:border-white/10">
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-soft)]">Selected document</p>
                      <h3 className="mt-2 font-display text-2xl font-semibold text-[var(--text-strong)]">{selectedDocument?.filename || "Choose a document from the library"}</h3>
                      <div className="mt-5 space-y-3 text-sm text-[var(--text-soft)]">
                        <p>Size: {selectedDocument ? formatBytes(selectedDocument.size_bytes) : "-"}</p>
                        <p>Uploaded: {formatTimestamp(selectedDocument?.uploaded_at ?? null)}</p>
                        <p>Last viewed: {formatRelativeTime(selectedDocument?.last_accessed_at ?? null)}</p>
                      </div>
                      <button type="button" onClick={() => navigateTo("library")} className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--panel-muted)] px-4 py-2 text-sm font-semibold text-[var(--text-strong)] transition hover:text-[var(--accent)]">Browse other files<ArrowUpRight size={16} /></button>
                    </article>

                    <article className="rounded-[2rem] border border-black/5 bg-[var(--panel)] p-6 shadow-sm dark:border-white/10">
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-soft)]">Quick pick</p>
                      <div className="mt-4 space-y-3">
                        {documents.slice(0, 6).map((document) => (
                          <button key={document.key} type="button" onClick={() => setSelectedDocument(document)} className={`w-full rounded-2xl border px-4 py-3 text-left transition ${selectedDocument?.key === document.key ? "border-[var(--accent)]/40 bg-[var(--accent-soft)]" : "border-black/5 bg-[var(--panel-muted)] hover:border-[var(--accent)]/30 dark:border-white/10"}`}>
                            <p className="font-medium text-[var(--text-strong)]">{document.filename}</p>
                            <p className="mt-1 text-xs uppercase tracking-[0.22em] text-[var(--text-soft)]">{formatRelativeTime(document.uploaded_at)}</p>
                          </button>
                        ))}
                      </div>
                    </article>
                  </section>

                  <section>
                    {selectedDocument ? (
                      <Suspense
                        fallback={
                          <div className="flex min-h-[60vh] items-center justify-center rounded-[2rem] border border-black/5 bg-[var(--panel)] text-[var(--text-soft)] shadow-sm dark:border-white/10">
                            <div className="flex items-center gap-3 rounded-full bg-[var(--panel-muted)] px-5 py-3 text-sm font-medium">
                              <LoaderCircle size={18} className="animate-spin" />
                              Loading viewer
                            </div>
                          </div>
                        }
                      >
                        <PdfViewer
                          url={`${API_BASE_URL}/pdf/stream/${encodeURIComponent(
                            selectedDocument.filename
                          )}`}
                        />
                      </Suspense>
                    ) : (
                      <div className="flex min-h-[60vh] flex-col items-center justify-center rounded-[2rem] border border-dashed border-[var(--border-strong)] bg-[var(--panel)] p-10 text-center text-[var(--text-soft)]"><Shield size={28} /><p className="mt-4 text-lg font-semibold text-[var(--text-strong)]">No document selected</p><p className="mt-2 max-w-lg text-sm leading-6">Open the document library to choose a PDF, then come back here for a clean, protected viewing experience.</p></div>
                    )}
                  </section>
                </div>
              )}

              {currentSection === "team" && canManageTeam && (
                <section className="rounded-[2rem] border border-black/5 bg-[var(--panel)] p-6 shadow-sm dark:border-white/10">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-soft)]">Access management</p>
                      <h3 className="mt-2 font-display text-2xl font-semibold text-[var(--text-strong)]">Manage workspace members</h3>
                    </div>
                    <button type="button" onClick={() => setIsInviteOpen(true)} className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"><UserPlus size={16} />Invite member</button>
                  </div>

                  <div className="mt-6 overflow-hidden rounded-3xl border border-black/5 dark:border-white/10">
                    <table className="min-w-full divide-y divide-black/5 text-left dark:divide-white/10">
                      <thead className="bg-[var(--panel-muted)] text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-soft)]"><tr><th className="px-5 py-4">User</th><th className="px-5 py-4">Role</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Action</th></tr></thead>
                      <tbody className="divide-y divide-black/5 bg-[var(--panel)] dark:divide-white/10">
                        {users.map((user) => (
                          <tr key={user._id}>
                            <td className="px-5 py-4"><p className="font-medium text-[var(--text-strong)]">{user.name}</p><p className="text-sm text-[var(--text-soft)]">{user.email}</p></td>
                            <td className="px-5 py-4 text-sm text-[var(--text-soft)]">{user.role}</td>
                            <td className="px-5 py-4"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${user.is_active ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300" : "bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300"}`}>{user.is_active ? (user.verified ? "Active" : "Pending") : "Inactive"}</span></td>
                            <td className="px-5 py-4">{user.role === "admin" ? <span className="text-sm text-[var(--text-soft)]">Owner</span> : <button type="button" onClick={async () => { try { await api.post(`/auth/users/${user._id}/status`); await loadWorkspace(true); } catch (err) { if (typeof err === "object" && err !== null && "response" in err) { const response = (err as { response?: { data?: { msg?: string } } }).response; setError(response?.data?.msg || "Unable to update user status."); } else { setError("Unable to update user status."); } } }} className="inline-flex items-center gap-2 rounded-full bg-[var(--panel-muted)] px-3 py-2 text-sm font-semibold text-[var(--text-strong)] transition hover:text-[var(--accent)]"><UserCog size={16} />{user.is_active ? "Deactivate" : "Activate"}</button>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </main>

      <InviteModal isOpen={isInviteOpen} onClose={() => { setIsInviteOpen(false); void loadWorkspace(true); }} />
    </div>
  );
}
