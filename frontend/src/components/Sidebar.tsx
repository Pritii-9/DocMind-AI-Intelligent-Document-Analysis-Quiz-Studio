import { LayoutDashboard, FileText, Bot, BookOpen, Users, LogOut, ChevronLeft, ChevronRight, Cpu } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export type Tab = "dashboard" | "library" | "chat" | "team" | "quiz" | "system";

const ACCENT        = "oklch(45% 0.033 256.848)";
const ACCENT_LIGHT  = "oklch(96% 0.015 256.848)";

const NAV: { id: Tab; label: string; icon: any }[] = [
  { id: "dashboard", label: "Dashboard",   icon: LayoutDashboard },
  { id: "library",   label: "Library",     icon: FileText },
  { id: "chat",      label: "Ask AI",      icon: Bot },
  { id: "quiz",      label: "Quizzes",     icon: BookOpen },
  { id: "team",      label: "Team",        icon: Users },
  { id: "system",    label: "Telemetry",   icon: Cpu },
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
    <aside style={{
      width: collapsed ? 64 : 220,
      flexShrink: 0,
      display: "flex", flexDirection: "column",
      background: "#ffffff",
      borderRight: "1px solid #e2e8f0",
      transition: "width 0.2s ease",
      position: "relative", zIndex: 20,
    }}>

      {/* Brand Header */}
      <div style={{
        height: 60, display: "flex", alignItems: "center",
        justifyContent: collapsed ? "center" : "space-between",
        padding: collapsed ? "0 14px" : "0 16px 0 20px",
        borderBottom: "1px solid #f1f5f9", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src="/logo.svg" alt="DocMind Logo" style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0 }} />
          {!collapsed && (
            <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: "-0.02em", color: "#0f172a" }}>
              DocMind
            </span>
          )}
        </div>
        {!collapsed && (
          <button onClick={() => setCollapsed(true)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 4, display: "flex" }}
            onMouseEnter={e => e.currentTarget.style.color = "#64748b"}
            onMouseLeave={e => e.currentTarget.style.color = "#94a3b8"}
          >
            <ChevronLeft size={15} />
          </button>
        )}
      </div>

      {/* Expand button when collapsed */}
      {collapsed && (
        <button onClick={() => setCollapsed(false)} style={{
          position: "absolute", top: 18, right: -12,
          width: 24, height: 24, borderRadius: "50%",
          background: "#ffffff", border: "1px solid #e2e8f0",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", color: "#94a3b8", zIndex: 30,
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
        }}>
          <ChevronRight size={12} />
        </button>
      )}

      {/* Nav */}
      <nav style={{ flex: 1, padding: "12px 8px", display: "flex", flexDirection: "column", gap: 2 }}>
        {!collapsed && (
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#cbd5e1", padding: "6px 12px" }}>
            Workspace
          </p>
        )}
        {NAV.filter(n => isAdmin || n.id !== "team").map(({ id, label, icon: Icon }) => {
          const active = tab === id;
          return (
            <button key={id} onClick={() => setTab(id)} title={collapsed ? label : undefined}
              style={{
                display: "flex", alignItems: "center",
                gap: collapsed ? 0 : 10,
                justifyContent: collapsed ? "center" : "flex-start",
                width: "100%", padding: collapsed ? "10px 0" : "9px 12px",
                borderRadius: 8, border: "none", cursor: "pointer",
                transition: "all 0.15s",
                background: active ? ACCENT_LIGHT : "transparent",
                color: active ? ACCENT : "#64748b",
                position: "relative",
              }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.background = "#f8fafc"; e.currentTarget.style.color = "#0f172a"; } }}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#64748b"; } }}
            >
              {active && (
                <div style={{
                  position: "absolute", left: 0, top: "20%", bottom: "20%",
                  width: 3, borderRadius: "0 3px 3px 0", background: ACCENT,
                }} />
              )}
              <Icon size={16} />
              {!collapsed && <span style={{ fontSize: 13, fontWeight: active ? 600 : 500, flex: 1, textAlign: "left" }}>{label}</span>}
            </button>
          );
        })}
      </nav>

      {/* User footer */}
      <div style={{ borderTop: "1px solid #f1f5f9", padding: "10px 8px", flexShrink: 0 }}>
        <div
          onClick={onOpenProfile}
          title="Click to view Account & Security Specs"
          style={{
            display: "flex", alignItems: "center",
            gap: collapsed ? 0 : 10,
            justifyContent: collapsed ? "center" : "flex-start",
            padding: collapsed ? "8px 0" : "8px 10px",
            borderRadius: 8, background: "#f8fafc",
            cursor: "pointer", transition: "all 0.15s",
          }}
          onMouseEnter={e => e.currentTarget.style.background = ACCENT_LIGHT}
          onMouseLeave={e => e.currentTarget.style.background = "#f8fafc"}
        >
          <div style={{
            width: 28, height: 28, borderRadius: 7, flexShrink: 0,
            background: ACCENT,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 700, color: "#fff",
          }}>
            {user?.name?.charAt(0).toUpperCase() || "U"}
          </div>
          {!collapsed && (
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.name}</p>
              <p style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600, marginTop: 1 }}>{user?.role}</p>
            </div>
          )}
        </div>
        <button onClick={onOpenSignOut} title={collapsed ? "Sign out" : undefined}
          style={{
            display: "flex", alignItems: "center",
            gap: collapsed ? 0 : 9,
            justifyContent: collapsed ? "center" : "flex-start",
            width: "100%", marginTop: 4,
            padding: collapsed ? "9px 0" : "8px 12px",
            borderRadius: 8, border: "none",
            background: "transparent", color: "#94a3b8",
            fontSize: 13, fontWeight: 500, cursor: "pointer", transition: "all 0.15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "#fee2e2"; e.currentTarget.style.color = "#dc2626"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#94a3b8"; }}
        >
          <LogOut size={15} />
          {!collapsed && "Sign out"}
        </button>
      </div>
    </aside>
  );
}