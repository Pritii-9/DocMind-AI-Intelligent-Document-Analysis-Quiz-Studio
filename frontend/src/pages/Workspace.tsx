import { useState } from "react";
import { User } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import Dashboard from "../components/Dashboard";
import Library from "../components/Library";
import Team from "../components/Team";
import AiChat from "../components/AiChat";
import QuizView from "../components/Quiz";
import SystemTelemetry from "../components/SystemTelemetry";
import Sidebar from "../components/Sidebar";
import type { Tab } from "../components/Sidebar";
import SignOutModal from "../components/SignOutModal";
import ProfileModal from "../components/ProfileModal";

const ACCENT = "oklch(45% 0.033 256.848)";

const TAB_TITLES: Record<Tab, string> = {
  dashboard: "Dashboard",
  library: "Library",
  chat: "Ask AI",
  quiz: "Quizzes",
  team: "Team",
  system: "System Telemetry",
};

export default function Workspace() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  const confirmSignOut = () => {
    setShowSignOutModal(false);
    logout();
    toast.info("Signed out of workspace.");
  };

  return (
    <div style={{ display: "flex", height: "100vh", background: "#f8fafc", overflow: "hidden", fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ── Profile Modal ── */}
      <ProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
      />

      {/* ── Sign Out Modal ── */}
      <SignOutModal
        isOpen={showSignOutModal}
        onClose={() => setShowSignOutModal(false)}
        onConfirm={confirmSignOut}
      />

      {/* ── Sidebar Component ── */}
      <Sidebar
        tab={tab}
        setTab={setTab}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        onOpenSignOut={() => setShowSignOutModal(true)}
        onOpenProfile={() => setShowProfileModal(true)}
      />

      {/* ── Main Workspace Content ── */}
      <main style={{ flex: 1, overflowY: "auto", background: "#f8fafc", display: "flex", flexDirection: "column" }}>
        {/* Header Bar */}
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
              {TAB_TITLES[tab] || "Workspace"}
            </p>
            <p
              onClick={() => setShowProfileModal(true)}
              style={{ fontSize: 11, color: "#94a3b8", marginTop: 2, cursor: "pointer" }}
              title="View Account Details"
            >
              Welcome back, <span style={{ color: ACCENT, fontWeight: 600 }}>{user?.name}</span>
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={() => setShowProfileModal(true)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                background: "#ffffff", border: "1px solid #cbd5e1",
                borderRadius: 8, padding: "5px 11px", fontSize: 11, fontWeight: 600,
                color: "#475569", cursor: "pointer", transition: "all 0.15s",
              }}
            >
              <User size={13} /> Account
            </button>
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

        {/* Tab View Routing */}
        <div style={{ flex: 1 }}>
          {tab === "dashboard" && <Dashboard onNavigate={setTab} />}
          {tab === "library"   && <Library />}
          {tab === "chat"      && <AiChat />}
          {tab === "quiz"      && <QuizView />}
          {tab === "team"      && <Team />}
          {tab === "system"    && <SystemTelemetry />}
        </div>
      </main>
    </div>
  );
}

