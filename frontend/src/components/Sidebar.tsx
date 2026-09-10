import { LayoutDashboard, FileText, Bot, BookOpen, Users, LogOut, ChevronLeft, ChevronRight, Cpu } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export type Tab = "dashboard" | "library" | "chat" | "team" | "quiz" | "system";

const NAV: { id: Tab; label: string; icon: any }[] = [
  { id: "dashboard", label: "Dashboard",  icon: LayoutDashboard },
  { id: "library",   label: "Library",    icon: FileText },
  { id: "chat",      label: "Ask AI",     icon: Bot },
  { id: "quiz",      label: "Quizzes",    icon: BookOpen },
  { id: "team",      label: "Team",       icon: Users },
  { id: "system",    label: "Telemetry",  icon: Cpu },
];

interface SidebarProps {
  tab: Tab;
  setTab: (tab: Tab) => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  onOpenSignOut: () => void;
  onOpenProfile?: () => void;
}

export default function Sidebar({ tab, setTab, collapsed, setCollapsed, onOpenSignOut, onOpenProfile }: SidebarProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  return (
    <aside
      className="relative z-20 flex flex-col bg-white border-r border-slate-200 shrink-0 transition-all duration-200"
      style={{ width: collapsed ? 64 : 220 }}
    >
      {/* Brand header */}
      <div
        className="h-[60px] flex items-center border-b border-slate-100 shrink-0"
        style={{ justifyContent: collapsed ? "center" : "space-between", padding: collapsed ? "0 14px" : "0 16px 0 20px" }}
      >
        <div className="flex items-center gap-2.5">
          <img src="/logo.svg" alt="DocMind Logo" className="w-8 h-8 rounded-lg shrink-0" />
          {!collapsed && (
            <span className="font-extrabold text-[15px] tracking-tight text-slate-900">DocMind</span>
          )}
        </div>
        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1 cursor-pointer"
          >
            <ChevronLeft size={15} />
          </button>
        )}
      </div>

      {/* Expand button when collapsed */}
      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          className="absolute top-[18px] -right-3 w-6 h-6 rounded-full bg-white border border-slate-200 shadow flex items-center justify-center text-slate-400 hover:text-slate-600 z-30 cursor-pointer transition-colors"
        >
          <ChevronRight size={12} />
        </button>
      )}

      {/* Nav */}
      <nav className="flex-1 p-2 flex flex-col gap-0.5">
        {!collapsed && (
          <p className="text-[10px] font-bold tracking-[0.08em] uppercase text-slate-300 px-3 py-1.5">
            Workspace
          </p>
        )}
        {NAV.filter(n => isAdmin || n.id !== "team").map(({ id, label, icon: Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              title={collapsed ? label : undefined}
              className={[
                "relative flex items-center rounded-lg border-none cursor-pointer transition-all duration-150 w-full",
                collapsed ? "justify-center py-2.5 px-0" : "justify-start gap-2.5 py-[9px] px-3",
                active
                  ? "text-[var(--brand)]"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-800",
              ].join(" ")}
              style={{ background: active ? "var(--brand-light)" : undefined }}
            >
              {active && (
                <div
                  className="absolute left-0 top-[20%] bottom-[20%] w-[3px] rounded-r-md"
                  style={{ background: "var(--brand)" }}
                />
              )}
              <Icon size={16} />
              {!collapsed && (
                <span className={`text-[13px] flex-1 text-left ${active ? "font-semibold" : "font-medium"}`}>
                  {label}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="border-t border-slate-100 p-2 shrink-0">
        <div
          onClick={onOpenProfile}
          title="Account Settings"
          className="flex items-center rounded-lg bg-slate-50 cursor-pointer transition-all duration-150 hover:bg-[var(--brand-light)]"
          style={{
            gap: collapsed ? 0 : 10,
            justifyContent: collapsed ? "center" : "flex-start",
            padding: collapsed ? "8px 0" : "8px 10px",
          }}
        >
          <div
            className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center text-xs font-bold text-white"
            style={{ background: "var(--brand)" }}
          >
            {user?.name?.charAt(0).toUpperCase() || "U"}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-900 truncate">{user?.name}</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-[0.06em] font-semibold mt-px">{user?.role}</p>
            </div>
          )}
        </div>

        <button
          onClick={onOpenSignOut}
          title={collapsed ? "Sign out" : undefined}
          className="flex items-center w-full mt-1 rounded-lg border-none bg-transparent text-slate-400 text-[13px] font-medium cursor-pointer transition-all duration-150 hover:bg-red-50 hover:text-red-600"
          style={{
            gap: collapsed ? 0 : 9,
            justifyContent: collapsed ? "center" : "flex-start",
            padding: collapsed ? "9px 0" : "8px 12px",
          }}
        >
          <LogOut size={15} />
          {!collapsed && "Sign out"}
        </button>
      </div>
    </aside>
  );
}