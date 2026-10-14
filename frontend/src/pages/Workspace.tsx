import { useState } from "react";
import { Plus, Table2, ExternalLink, Settings } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import Sidebar from "../components/Sidebar";
import type { Tab } from "../components/Sidebar";
import SignOutModal from "../components/SignOutModal";
import ProfileModal from "../components/ProfileModal";
import CandidatePipeline from "../components/CandidatePipeline";
import Hire from "./Hire";
import ShareableApplyTab from "../components/ShareableApplyTab";
import JobOpeningsManager from "../components/JobOpeningsManager";
import SettingsTab from "../components/SettingsTab";
import type { JobOpening } from "../utils/jobStorage";

const TAB_TITLES: Record<Tab, string> = {
  pipeline: "Candidate Pipeline (ATS)",
  jobs:     "Job Openings & Requisitions",
  hire:     "Quick Screen — On-Demand Evaluation",
  apply:    "Public Apply Portal",
  settings: "Workspace & Company Settings",
};

export default function Workspace() {
  const { logout } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("pipeline");
  const [selectedJobForScreen, setSelectedJobForScreen] = useState<JobOpening | null>(null);
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
      <ProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        onNavigateToSettings={() => setTab("settings")}
      />
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

      <main className="flex-1 overflow-y-auto bg-slate-50 flex flex-col min-w-0">
        {/* Top Navigation */}
        <header className="h-14 flex items-center justify-between px-6 border-b border-slate-200/80 bg-white/90 backdrop-blur-md sticky top-0 z-10 shrink-0">
          {/* Breadcrumbs / Page Title */}
          <div className="flex items-center gap-2 text-xs text-slate-400 font-medium min-w-0">
            <span>Workspace</span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-900 font-semibold truncate text-sm">
              {TAB_TITLES[tab] || "Dashboard"}
            </span>
          </div>

          {/* Context Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTab("settings")}
              title="Workspace & Company Settings"
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-lg transition-colors cursor-pointer ${
                tab === "settings"
                  ? "bg-slate-900 text-white border-slate-900 font-semibold shadow-xs"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Settings size={13} className={tab === "settings" ? "text-white" : "text-slate-500"} />
              <span>Settings</span>
            </button>

            <a
              href="https://docs.google.com/spreadsheets/d/1RsYvMSI8Nte2OU7uzSYTjqyBidwgXbXs9uC6IIttqUg"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors"
              title="Open Live CRM Google Sheet"
            >
              <Table2 size={13} className="text-emerald-600" />
              <span>CRM Sheet</span>
              <ExternalLink size={11} className="text-slate-400" />
            </a>

            {tab !== "hire" && (
              <button
                onClick={() => setTab("hire")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                <Plus size={13} />
                <span>Quick Screen</span>
              </button>
            )}
          </div>
        </header>

        {/* Tab content */}
        <div className="flex-1">
          {tab === "pipeline" && <CandidatePipeline onSwitchToScreen={() => setTab("hire")} />}
          {tab === "jobs"     && (
            <JobOpeningsManager
              onSelectRoleForScreen={(job) => {
                setSelectedJobForScreen(job);
                setTab("hire");
              }}
            />
          )}
          {tab === "hire"     && <Hire initialJob={selectedJobForScreen} />}
          {tab === "apply"    && <ShareableApplyTab />}
          {tab === "settings" && <SettingsTab />}
        </div>
      </main>
    </div>
  );
}
