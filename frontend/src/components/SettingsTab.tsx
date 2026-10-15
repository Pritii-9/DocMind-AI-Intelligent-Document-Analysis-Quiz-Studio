import { useState, useEffect, useRef } from "react";
import {
  Building,
  Upload,
  Save,
  Sparkles,
  ExternalLink,
  RotateCcw,
  Globe,
  Copy,
  Check,
  ShieldCheck,
  Table2,
  Mail,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import api from "../api/client";
import { useCompany, BRANDING_PRESETS } from "../context/CompanyContext";
import { useToast } from "../context/ToastContext";
import { getPublicApplyUrl, PRODUCTION_FRONTEND_URL } from "../utils/appUrl";

export default function SettingsTab() {
  const { branding, updateBranding, resetBranding } = useCompany();
  const { toast } = useToast();

  const [companyName, setCompanyName] = useState(branding.name);
  const [companyTagline, setCompanyTagline] = useState(branding.tagline);
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(branding.logoUrl);
  const [companyWebsite, setCompanyWebsite] = useState(branding.websiteUrl);
  const [saving, setSaving] = useState(false);
  const [copiedApplyLink, setCopiedApplyLink] = useState(false);
  const [defaultDispatchMode, setDefaultDispatchMode] = useState<"auto" | "manual">(() => {
    return (localStorage.getItem("hiremind_email_dispatch_mode") as "auto" | "manual") || "manual";
  });
  const [testingEmail, setTestingEmail] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCompanyName(branding.name);
    setCompanyTagline(branding.tagline);
    setCompanyLogoUrl(branding.logoUrl);
    setCompanyWebsite(branding.websiteUrl);
  }, [branding]);

  const publicApplyUrl = getPublicApplyUrl({ companyName: branding.name });

  const handleLogoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload a valid image file (PNG, JPG, SVG, WebP).");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image size must be less than 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setCompanyLogoUrl(reader.result);
        toast.info("Logo loaded. Click 'Save Changes' to update.");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    const trimmed = companyName.trim();
    if (!trimmed) {
      toast.error("Company name cannot be empty");
      return;
    }

    setSaving(true);
    try {
      await updateBranding({
        name: trimmed,
        tagline: companyTagline.trim(),
        logoUrl: companyLogoUrl,
        websiteUrl: companyWebsite.trim(),
      });
      localStorage.setItem("hiremind_email_dispatch_mode", defaultDispatchMode);
      toast.success("Settings & configuration saved successfully!");
    } catch (e) {
      toast.error("Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    await resetBranding();
    setCompanyName("HireMind AI");
    setCompanyTagline("Autonomous Tech Candidate Screening & Intelligence");
    setCompanyLogoUrl(null);
    setCompanyWebsite(PRODUCTION_FRONTEND_URL);
    setDefaultDispatchMode("manual");
    localStorage.setItem("hiremind_email_dispatch_mode", "manual");
    toast.info("Branding and dispatch policies reset to default.");
  };

  const handleTestEmail = async () => {
    setTestingEmail(true);
    try {
      const res = await api.post("/api/hire/test-email", {});
      if (res.data?.status === "sent") {
        toast.success(`Verification email delivered to ${res.data.target}!`);
      } else {
        toast.info(res.data?.message || "Test email processed.");
      }
    } catch (e: any) {
      toast.error(e.response?.data?.detail || "Email verification failed. Check SMTP configuration.");
    } finally {
      setTestingEmail(false);
    }
  };

  const handleCopyApply = () => {
    navigator.clipboard.writeText(publicApplyUrl);
    setCopiedApplyLink(true);
    setTimeout(() => setCopiedApplyLink(false), 2000);
  };

  return (
    <div className="px-6 py-5 max-w-7xl mx-auto space-y-3.5 font-[Inter,system-ui,sans-serif]">
      {/* ── Page Header with Inline Save Controls ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
        <div>
          <h1 className="text-base font-bold tracking-tight text-slate-900 leading-tight">
            Settings
          </h1>
          <p className="text-xs text-slate-500">
            Company branding, white-labeling, application portal &amp; workspace configuration
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-900 transition shadow-2xs cursor-pointer"
          >
            <RotateCcw size={12} />
            <span>Reset Defaults</span>
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white transition shadow-xs cursor-pointer disabled:opacity-50"
          >
            <Save size={13} />
            <span>{saving ? "Saving..." : "Save Settings"}</span>
          </button>
        </div>
      </div>

      {/* 1. Company & White-Labeling Card */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-6 shadow-xs space-y-5">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
          <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
            <Building size={15} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Company Identity &amp; Branding</h2>
            <p className="text-xs text-slate-500">
              Customize how your organization appears to candidates on application forms and inside the recruiter dashboard.
            </p>
          </div>
        </div>

        {/* Logo Upload Section */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
            Company Logo
          </label>
          <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div className="w-16 h-16 rounded-xl bg-white border border-slate-200 flex items-center justify-center p-2 shrink-0 overflow-hidden shadow-xs">
              {companyLogoUrl ? (
                <img
                  src={companyLogoUrl}
                  alt="Company Logo Preview"
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <div className="w-full h-full rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-lg">
                  {companyName.slice(0, 2).toUpperCase() || "HM"}
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                onChange={handleLogoFileSelect}
                className="hidden"
              />
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer shadow-2xs"
                >
                  <Upload size={13} />
                  <span>Upload Logo Image</span>
                </button>

                {companyLogoUrl && (
                  <button
                    type="button"
                    onClick={() => setCompanyLogoUrl(null)}
                    className="px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                  >
                    Remove Logo
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">
                PNG, SVG, or JPG under 2MB. Displayed on the sidebar, top navigation, and candidate apply portal.
              </p>
            </div>
          </div>
        </div>

        {/* Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Company / Organization Name
            </label>
            <input
              type="text"
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              placeholder="e.g. Acme Corp"
              className="w-full h-9 border border-slate-200 rounded-lg px-3 text-sm text-slate-900 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 bg-white transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Company Website (Optional)
            </label>
            <input
              type="url"
              value={companyWebsite}
              onChange={e => setCompanyWebsite(e.target.value)}
              placeholder="https://example.com"
              className="w-full h-9 border border-slate-200 rounded-lg px-3 text-sm text-slate-900 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 bg-white transition-colors"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Company Tagline / Subtitle
            </label>
            <input
              type="text"
              value={companyTagline}
              onChange={e => setCompanyTagline(e.target.value)}
              placeholder="e.g. Autonomous Tech Candidate Screening & Intelligence"
              className="w-full h-9 border border-slate-200 rounded-lg px-3 text-sm text-slate-900 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 bg-white transition-colors"
            />
          </div>
        </div>

        {/* Quick Presets */}
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Sparkles size={12} className="text-slate-500" />
            <span>Quick 1-Click Vendor Presets:</span>
          </label>
          <div className="flex flex-wrap gap-1.5">
            {BRANDING_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  setCompanyName(p.branding.name);
                  setCompanyTagline(p.branding.tagline);
                  setCompanyLogoUrl(p.branding.logoUrl);
                  setCompanyWebsite(p.branding.websiteUrl);
                }}
                className="px-2.5 py-1 text-xs font-medium rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              onClick={handleReset}
              className="px-2 py-1 text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors inline-flex items-center gap-1 cursor-pointer"
              title="Reset to default"
            >
              <RotateCcw size={11} /> Reset
            </button>
          </div>
        </div>

        {/* Live Preview Card */}
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            Live Preview of Public Candidate Portal (`/apply`)
          </p>
          <div className="bg-white p-3.5 rounded-lg border border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden shadow-2xs">
                {companyLogoUrl ? (
                  <img src={companyLogoUrl} alt="Logo" className="w-full h-full object-contain p-0.5" />
                ) : (
                  companyName.slice(0, 2).toUpperCase() || "HM"
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 leading-tight truncate">
                  {companyName || "Your Company"} Careers
                </p>
                <p className="text-[11px] text-slate-400 leading-tight truncate">
                  {companyTagline || "Open Positions"}
                </p>
              </div>
            </div>
            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full shrink-0">
              Accepting Applications
            </span>
          </div>
        </div>

        {/* Save Button */}
        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <Save size={13} />
            <span>{saving ? "Saving Changes…" : "Save Changes"}</span>
          </button>
        </div>
      </div>

      {/* 2. Portal & Integration Links Card */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <Globe size={16} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Application Links &amp; Integrations</h2>
            <p className="text-xs text-slate-500">
              Direct links for candidate ingestion and recruitment tracking.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {/* Public Link */}
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200 gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-900">Candidate Ingestion Portal</p>
              <p className="text-xs font-mono text-slate-500 truncate mt-0.5">{publicApplyUrl}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCopyApply}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                {copiedApplyLink ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                <span>{copiedApplyLink ? "Copied" : "Copy"}</span>
              </button>
              <a
                href={publicApplyUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <ExternalLink size={12} />
                <span>Open</span>
              </a>
            </div>
          </div>

          {/* CRM Link */}
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200 gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-900">Google Sheets CRM Integration</p>
              <p className="text-xs text-slate-500 truncate mt-0.5">Real-time candidate score logging spreadsheet</p>
            </div>
            <a
              href="https://docs.google.com/spreadsheets/d/1RsYvMSI8Nte2OU7uzSYTjqyBidwgXbXs9uC6IIttqUg"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors shrink-0"
            >
              <Table2 size={12} className="text-emerald-600" />
              <span>View Sheet</span>
            </a>
          </div>
        </div>

        <div className="pt-2 flex items-center gap-2 text-xs text-slate-500">
          <ShieldCheck size={14} className="text-emerald-600 shrink-0" />
          <span>All screening assessments and candidate scores are automatically encrypted and synchronized.</span>
        </div>
      </div>

      {/* 3. Candidate Email Dispatch & Automation Policy */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
              <Mail size={15} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Email Notification &amp; Dispatch Automation</h2>
              <p className="text-xs text-slate-500">
                Configure default dispatch behavior for candidate screening notifications and verify SMTP delivery.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleTestEmail}
            disabled={testingEmail}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-900 transition shadow-2xs cursor-pointer disabled:opacity-50"
          >
            {testingEmail ? <Loader2 size={12} className="animate-spin text-slate-600" /> : <Mail size={12} className="text-slate-500" />}
            <span>{testingEmail ? "Testing Delivery..." : "Test SMTP Delivery"}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          {/* Option: Manual Approval */}
          <div
            onClick={() => setDefaultDispatchMode("manual")}
            className={`cursor-pointer rounded-lg border p-3.5 transition-all flex flex-col justify-between ${
              defaultDispatchMode === "manual"
                ? "border-slate-900 bg-slate-50/60 ring-1 ring-slate-900/10"
                : "border-slate-200 hover:border-slate-300 bg-white"
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                  <CheckCircle2
                    size={14}
                    className={defaultDispatchMode === "manual" ? "text-slate-900" : "text-slate-300"}
                  />
                  Manual Recruiter Approval
                </span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                  Recommended
                </span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed mt-1">
                AI evaluation scores applicant resumes without sending emails. Recruiters review results first and click <strong className="text-slate-700 font-medium">"Send Shortlist Email"</strong> on demand.
              </p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center gap-1.5 text-[11px] text-slate-400">
              <span>Zero risk of accidental email dispatches during test runs or tuning.</span>
            </div>
          </div>

          {/* Option: Auto-Dispatch */}
          <div
            onClick={() => setDefaultDispatchMode("auto")}
            className={`cursor-pointer rounded-lg border p-3.5 transition-all flex flex-col justify-between ${
              defaultDispatchMode === "auto"
                ? "border-slate-900 bg-slate-50/60 ring-1 ring-slate-900/10"
                : "border-slate-200 hover:border-slate-300 bg-white"
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                  <CheckCircle2
                    size={14}
                    className={defaultDispatchMode === "auto" ? "text-slate-900" : "text-slate-300"}
                  />
                  Immediate Auto-Dispatch
                </span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                  High Volume
                </span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed mt-1">
                Automatically dispatches calendar booking invitations to shortlisted applicants as soon as AI analysis meets score thresholds.
              </p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center gap-1.5 text-[11px] text-slate-400">
              <span>Optimized for fast-moving high-volume inbound pipelines.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
