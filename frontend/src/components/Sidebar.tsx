import { LayoutDashboard, Briefcase, BriefcaseBusiness, Share2, Settings, LogOut, ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useCompany } from "../context/CompanyContext";

export type Tab = "pipeline" | "jobs" | "hire" | "apply" | "settings";

const NAV: { id: Tab; label: string; icon: any }[] = [
  { id: "pipeline", label: "Dashboard",        icon: LayoutDashboard },
  { id: "jobs",     label: "Job Openings",     icon: Briefcase },
  { id: "hire",     label: "Quick Screen",     icon: BriefcaseBusiness },
  { id: "apply",    label: "Public Portal",    icon: Share2 },
  { id: "settings", label: "Settings",         icon: Settings },
];

interface SidebarProps {
  tab: Tab;
  setTab: (tab: Tab) => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  onOpenSignOut: () => void;
  onOpenProfile?: () => void;
}

export default function Sidebar({
  tab,
  setTab,
  collapsed,
  setCollapsed,
  onOpenSignOut,
  onOpenProfile,
}: SidebarProps) {
  const { user } = useAuth();
  const { branding } = useCompany();

  return (
    <aside
      className="relative z-20 flex flex-col bg-white border-r border-slate-200/80 shrink-0 transition-all duration-200 select-none"
      style={{ width: collapsed ? 64 : 240 }}
    >
      {/* Brand Header */}
      <div
        className="h-14 flex items-center border-b border-slate-100 shrink-0 px-4"
        style={{ justifyContent: collapsed ? "center" : "space-between" }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-xs tracking-wider shrink-0 shadow-xs overflow-hidden">
            {branding.logoUrl ? (
              <img src={branding.logoUrl} alt={branding.name} className="w-full h-full object-contain p-1" />
            ) : (
              branding.name.slice(0, 2).toUpperCase() || "HM"
            )}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm tracking-tight text-slate-900 leading-none truncate">
                  {branding.name}
                </span>
                {branding.name === "HireMind AI" && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100 leading-none">
                    AI
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 font-normal leading-none mt-1 truncate" title={branding.tagline}>
                {branding.tagline || "Candidate Intelligence"}
              </p>
            </div>
          )}
        </div>

        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            title="Collapse sidebar"
            className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md p-1 transition-colors cursor-pointer"
          >
            <ChevronLeft size={16} />
          </button>
        )}
      </div>

      {/* Expand button when collapsed */}
      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          title="Expand sidebar"
          className="absolute top-4 -right-3 w-6 h-6 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-500 hover:text-slate-900 z-30 cursor-pointer transition-colors"
        >
          <ChevronRight size={12} />
        </button>
      )}

      {/* Navigation List */}
      <nav className="flex-1 px-3 py-3 flex flex-col gap-1 overflow-y-auto">
        {!collapsed && (
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-2 py-1">
            Workspace
          </p>
        )}

        {NAV.map(({ id, label, icon: Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              title={collapsed ? label : undefined}
              className={[
                "flex items-center rounded-lg cursor-pointer transition-all duration-150 w-full text-left text-sm",
                collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2",
                active
                  ? "bg-slate-100 text-slate-900 font-semibold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium",
              ].join(" ")}
            >
              <Icon
                size={16}
                className={active ? "text-slate-900 shrink-0" : "text-slate-500 shrink-0"}
              />
              {!collapsed && (
                <span className="truncate">{label}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* User Footer */}
      <div className="border-t border-slate-100 p-3 shrink-0 flex flex-col gap-1.5">
        <div
          onClick={onOpenProfile}
          title="Account Settings"
          className={`flex items-center rounded-lg hover:bg-slate-100 cursor-pointer transition-colors ${
            collapsed ? "justify-center p-1.5" : "gap-2.5 p-2"
          }`}
        >
          <div className="w-8 h-8 rounded-full bg-slate-900 text-white text-xs font-semibold shrink-0 flex items-center justify-center shadow-xs">
            {user?.name?.charAt(0).toUpperCase() || "U"}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-900 truncate leading-snug">
                {user?.name || "Hiring Lead"}
              </p>
              <p className="text-[11px] text-slate-500 capitalize leading-snug truncate">
                {user?.role || "Recruiter"}
              </p>
            </div>
          )}
        </div>

        <button
          onClick={onOpenSignOut}
          title={collapsed ? "Sign out" : undefined}
          className={`flex items-center rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 text-xs font-medium cursor-pointer transition-colors ${
            collapsed ? "justify-center p-2" : "gap-2.5 px-3 py-2 w-full"
          }`}
        >
          <LogOut size={15} />
          {!collapsed && <span>Sign out</span>}
        </button>
      </div>
    </aside>
  );
}