import { BarChart3, FileText, ShieldCheck, Users } from "lucide-react";

import { useAuth } from "../context/AuthContext";

export type AppSection = "overview" | "library" | "viewer" | "team";

type SidebarProps = {
  currentSection: AppSection;
  onNavigate: (section: AppSection) => void;
  canManageTeam: boolean;
  documentCount: number;
  teamCount: number;
  selectedDocumentName?: string;
  collapsed?: boolean;
};

const navItems = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "library", label: "Document Library", icon: FileText },
  { id: "viewer", label: "Live Viewer", icon: ShieldCheck },
  { id: "team", label: "Team Management", icon: Users },
] as const;

export default function Sidebar({
  currentSection,
  onNavigate,
  canManageTeam,
  documentCount,
  teamCount,
  selectedDocumentName,
  collapsed = false,
}: SidebarProps) {
  const { role, userName } = useAuth();

  return (
    <aside className={`w-full shrink-0 border-b border-black/5 bg-[var(--panel-strong)] text-white shadow-2xl lg:h-screen lg:border-b-0 lg:border-r lg:border-white/10 overflow-hidden ${collapsed ? "lg:w-20" : "lg:w-80"}`}>
      <div className="flex h-full flex-col">
        <div className={`border-b border-white/10 ${collapsed ? "py-5" : "px-4 py-5"}`}>
          <div className={`flex items-center ${collapsed ? "justify-center" : "justify-center gap-3"}`}>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--accent)] text-sm font-black shadow-lg shadow-cyan-950/40">
              SV
            </div>
            {!collapsed && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100/60">
                  Enterprise Workspace
                </p>
                <h1 className="font-display text-2xl font-bold tracking-tight">SafeUp</h1>
              </div>
            )}
          </div>
        </div>

        {!collapsed && (
          <div className="px-6 py-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-cyan-100/55">Documents</p>
                <p className="mt-2 text-2xl font-semibold text-white">{documentCount}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-cyan-100/55">Team</p>
                <p className="mt-2 text-2xl font-semibold text-white">{teamCount}</p>
              </div>
            </div>
          </div>
        )}

        <nav className="px-4 pb-4">
          <p className="px-3 pb-3 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100/45">
            Navigation
          </p>
          <div className="grid gap-2">
            {navItems
              .filter((item) => canManageTeam || item.id !== "team")
              .map((item) => {
                const Icon = item.icon;
                const active = currentSection === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onNavigate(item.id)}
                    className={`group flex items-center justify-between rounded-2xl px-4 py-3 text-left transition ${active ? "bg-white text-slate-950 shadow-lg" : "bg-white/0 text-slate-200 hover:bg-white/8 hover:text-white"}`}
                  >
                    <span className="flex items-center gap-3 font-medium">
                      <Icon size={18} />
                      {!collapsed && item.label}
                    </span>
                    {active && !collapsed ? <span className="h-2.5 w-2.5 rounded-full bg-[var(--accent)]" /> : null}
                  </button>
                );
              })}
          </div>
        </nav>

        {!collapsed && (
          <div className="mx-6 rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-cyan-100/45">Active Focus</p>
            <p className="mt-3 text-lg font-semibold text-white">
              {selectedDocumentName || "No document selected"}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Use the library to search documents, then open the live viewer for a boardroom-friendly walkthrough.
            </p>
          </div>
        )}

        <div className="mt-auto border-t border-white/10 px-6 py-5">
          {collapsed ? (
            <div className="flex items-center justify-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-sm font-bold text-white">
                {userName?.charAt(0).toUpperCase() || "U"}
              </div>
            </div>
          ) : (
            <>
              <div className="mb-2 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-sm font-bold text-white">
                  {userName?.charAt(0).toUpperCase() || "U"}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-white">{userName}</p>
                  <p className="text-xs uppercase tracking-[0.24em] text-cyan-100/50">{role}</p>
                </div>
              </div>
              <p className="text-xs text-cyan-100/60">Use top header for quick sign out / theme switch.</p>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
