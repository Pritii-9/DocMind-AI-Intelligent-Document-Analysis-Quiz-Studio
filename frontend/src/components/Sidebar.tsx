import { LayoutDashboard, FileText, ShieldCheck, Users } from "lucide-react";
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
  { id: "overview", label: "Dashboard", icon: LayoutDashboard },
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
  const { user } = useAuth();

  return (
    <aside 
      className={`hidden lg:flex flex-col h-screen sticky top-0 border-r border-[var(--border-strong)] bg-[var(--panel)] transition-all duration-300 ease-in-out ${
        collapsed ? "w-20" : "w-72"
      }`}
    >
      {/* 1. BRANDING AREA - Perfectly aligned with Header Height (h-16) */}
      <div className="h-16 flex items-center px-6 border-b border-[var(--border-strong)]">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--accent)] to-cyan-600 shadow-lg shadow-cyan-500/20 font-bold text-white">
            S
          </div>
          {!collapsed && (
            <span className="font-display text-xl font-bold tracking-tight text-[var(--text-strong)]">
              DocMind<span className="text-[var(--accent)]">.AI</span>
            </span>
          )}
        </div>
      </div>

      {/* 2. STATS OVERVIEW - Clean & Minimalist */}
      {!collapsed && (
        <div className="px-6 py-8">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-soft)]">Docs</p>
              <p className="text-xl font-bold text-[var(--text-strong)]">{documentCount}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-soft)]">Team</p>
              <p className="text-xl font-bold text-[var(--text-strong)]">{teamCount}</p>
            </div>
          </div>
        </div>
      )}

      {/* 3. NAVIGATION */}
      <nav className="flex-1 px-3 space-y-1">
        <p className={`px-3 pb-3 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-soft)] ${collapsed ? "text-center" : ""}`}>
          {collapsed ? "•••" : "Main Navigation"}
        </p>
        {navItems
          .filter((item) => canManageTeam || item.id !== "team")
          .map((item) => {
            const Icon = item.icon;
            const active = currentSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group ${
                  active 
                    ? "bg-[var(--accent-soft)] text-[var(--accent)] shadow-[inset_0_0_0_1px_var(--accent-border)]" 
                    : "text-[var(--text-soft)] hover:bg-[var(--panel-muted)] hover:text-[var(--text-strong)]"
                }`}
              >
                <Icon size={20} className={active ? "text-[var(--accent)]" : "group-hover:text-[var(--text-strong)] transition-colors"} />
                {!collapsed && <span className="font-medium text-sm">{item.label}</span>}
              </button>
            );
          })}
      </nav>

      {/* 4. ACTIVE FOCUS BOX */}
      {!collapsed && (
        <div className="mx-4 mb-6 p-4 rounded-2xl bg-[var(--panel-muted)] border border-[var(--border-strong)]">
          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--accent)]/60 mb-2">Active Focus</p>
          <p className="text-xs font-bold text-[var(--text-strong)] truncate leading-relaxed">
            {selectedDocumentName || "Standby Mode"}
          </p>
        </div>
      )}

      {/* 5. USER FOOTER */}
      <div className="p-4 border-t border-[var(--border-strong)] bg-[var(--panel-muted)]">
        <div className={`flex items-center gap-3 p-2 rounded-2xl ${collapsed ? "justify-center" : ""}`}>
          <div className="h-9 w-9 rounded-xl bg-[var(--panel)] border border-[var(--border-strong)] flex items-center justify-center text-xs font-bold text-[var(--text-soft)] shadow-inner">
            {user?.name?.charAt(0).toUpperCase() || "U"}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-xs font-bold text-[var(--text-strong)] truncate">{user?.name || "User"}</p>
              <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-soft)]">{user?.role || "Member"}</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}