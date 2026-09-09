import { useState } from "react";
import {
  LayoutDashboard, FileText, Bot, BookOpen, Users,
  LogOut, ChevronLeft, ChevronRight, Brain, X
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import Dashboard from "../components/Dashboard";
import Library from "../components/Library";
import Team from "../components/Team";
import AiChat from "../components/AiChat";
import QuizView from "../components/Quiz";

type Tab = "dashboard" | "library" | "chat" | "team" | "quiz";

const ACCENT        = "oklch(45% 0.033 256.848)";
const ACCENT_LIGHT  = "oklch(96% 0.015 256.848)";

const NAV: { id: Tab; label: string; icon: any }[] = [
  { id: "dashboard", label: "Dashboard",   icon: LayoutDashboard },
  { id: "library",   label: "Library",     icon: FileText },
  { id: "chat",      label: "Ask AI",      icon: Bot },
  { id: "quiz",      label: "Quizzes",     icon: BookOpen },
  { id: "team",      label: "Team",        icon: Users },
];

export default function Workspace() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const isAdmin = user?.role === "admin";

  const confirmSignOut = () => {
    setShowSignOutModal(false);
    logout();
    toast.info("Signed out of workspace.");
  };

  return (
    <div style={{ display: "flex", height: "100vh", background: "#f8fafc", overflow: "hidden", fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ── Sign Out Confirmation Dialog ── */}
      {showSignOutModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 10000,
          background: "rgba(15, 23, 42, 0.5)",
          backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 20,
        }} className="fade-in">
          <div style={{
            background: "#ffffff",
            borderRadius: 16,
            boxShadow: "0 20px 40px -10px rgba(0,0,0,0.15)",
            border: "1px solid #e2e8f0",
            maxWidth: 400, width: "100%", padding: 24,
            position: "relative",
          }} className="animate-in">
            <button
              onClick={() => setShowSignOutModal(false)}
              style={{ position: "absolute", right: 18, top: 18, background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}
            >
              <X size={16} />
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div style={{
                width: 40, height: 40, borderRadius: "50%",
                background: "#fee2e2", border: "1px solid #fca5a5",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <LogOut size={18} color="#dc2626" />
              </div>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", margin: 0 }}>
                  Sign out of workspace?
                </h3>
                <p style={{ fontSize: 12, color: "#64748b", margin: "2px 0 0 0" }}>
                  Active session
                </p>
              </div>
            </div>

            <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6, margin: "0 0 22px 0" }}>
              Are you sure you want to sign out? You'll need to enter your credentials to log back in.
            </p>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowSignOutModal(false)}
                style={{
                  background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 8,
                  padding: "9px 16px", fontSize: 13, fontWeight: 600, color: "#475569",
                  cursor: "pointer", transition: "all 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "#94a3b8"; e.currentTarget.style.color = "#0f172a"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "#cbd5e1"; e.currentTarget.style.color = "#475569"; }}
              >
                Cancel
              </button>
              <button
                onClick={confirmSignOut}
                style={{
                  background: "#dc2626", border: "none", borderRadius: 8,
                  padding: "9px 18px", fontSize: 13, fontWeight: 600, color: "#ffffff",
                  cursor: "pointer", boxShadow: "0 2px 8px rgba(220,38,38,0.25)",
                  transition: "all 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "#b91c1c"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "#dc2626"; }}
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Sidebar ── */}
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
            <div style={{
              width: 32, height: 32, borderRadius: 8, flexShrink: 0,
              background: ACCENT,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Brain size={16} color="#fff" />
            </div>
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
          <div style={{
            display: "flex", alignItems: "center",
            gap: collapsed ? 0 : 10,
            justifyContent: collapsed ? "center" : "flex-start",
            padding: collapsed ? "8px 0" : "8px 10px",
            borderRadius: 8, background: "#f8fafc",
          }}>
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
          <button onClick={() => setShowSignOutModal(true)} title={collapsed ? "Sign out" : undefined}
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

      {/* ── Main Content Area ── */}
      <main style={{ flex: 1, overflowY: "auto", background: "#f8fafc", display: "flex", flexDirection: "column" }}>
        {/* Top Header Bar */}
        <header style={{
          height: 60, display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 28px",
          borderBottom: "1px solid #e2e8f0",
          background: "rgba(255,255,255,0.85)",
          backdropFilter: "blur(10px)",
          position: "sticky", top: 0, zIndex: 10, flexShrink: 0,
        }}>
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", lineHeight: 1 }}>
              {NAV.find(n => n.id === tab)?.label || "Workspace"}
            </p>
            <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
              Welcome back, <span style={{ color: ACCENT, fontWeight: 600 }}>{user?.name}</span>
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "#f0fdf4", border: "1px solid #bbf7d0",
              borderRadius: 99, padding: "4px 10px",
            }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#16a34a" }} />
              <span style={{ fontSize: 11, color: "#15803d", fontWeight: 600 }}>System active</span>
            </div>
          </div>
        </header>

        <div style={{ flex: 1 }}>
          {tab === "dashboard" && <Dashboard onNavigate={setTab} />}
          {tab === "library"   && <Library />}
          {tab === "chat"      && <AiChat />}
          {tab === "quiz"      && <QuizView />}
          {tab === "team"      && <Team />}
        </div>
      </main>
    </div>
  );
}
