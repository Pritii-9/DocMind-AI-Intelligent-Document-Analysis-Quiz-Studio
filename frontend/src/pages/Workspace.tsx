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

const TAB_TITLES: Record<Tab, string> = {
  dashboard: "Dashboard",
  library:   "Library",
  chat:      "Ask AI",
  quiz:      "Quizzes",
  team:      "Team",
  system:    "System Telemetry",
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
    <div className="flex h-screen bg-slate-50 overflow-hidden font-[Inter,system-ui,sans-serif]">

      <ProfileModal isOpen={showProfileModal} onClose={() => setShowProfileModal(false)} />
      <SignOutModal
        isOpen={showSignOutModal}
        onClose={() => setShowSignOutModal(false)}
        onConfirm={confirmSignOut}
      />

      <Sidebar
        tab={tab}
        setTab={setTab}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        onOpenSignOut={() => setShowSignOutModal(true)}
        onOpenProfile={() => setShowProfileModal(true)}
      />

      <main className="flex-1 overflow-y-auto bg-slate-50 flex flex-col">
        {/* Header */}
        <header className="h-[60px] flex items-center justify-between px-7 border-b border-slate-200 bg-white/85 backdrop-blur-[10px] sticky top-0 z-10 shrink-0">
          <div>
            <p className="text-[15px] font-bold text-slate-900 leading-none">{TAB_TITLES[tab] || "Workspace"}</p>
            <p
              className="text-[11px] text-slate-400 mt-0.5 cursor-pointer"
              onClick={() => setShowProfileModal(true)}
              title="View Account"
            >
              Welcome back,{" "}
              <span className="font-semibold" style={{ color: "var(--brand)" }}>{user?.name}</span>
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShowProfileModal(true)}
              className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-[11px] font-semibold text-slate-600 cursor-pointer hover:border-slate-400 hover:text-slate-800 transition-colors"
            >
              <User size={13} /> Account
            </button>
            <div className="flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-full px-2.5 py-1">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
              <span className="text-[11px] text-green-700 font-semibold">System active</span>
            </div>
          </div>
        </header>

        {/* Tab content */}
        <div className="flex-1">
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
