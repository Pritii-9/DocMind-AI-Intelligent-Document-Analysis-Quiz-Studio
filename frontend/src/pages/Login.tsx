import LoginAuthCard from "../components/LoginAuthCard";

export default function Login() {
  return (
    <div className="h-screen w-full max-h-screen overflow-hidden bg-[#f8fafc] flex flex-col items-center justify-center px-4 py-2 font-[Inter,system-ui,sans-serif] text-slate-900 antialiased">
      {/* Subtle ambient top glow */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-64 opacity-50"
        style={{
          background: "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(99, 102, 241, 0.08), transparent 70%)",
        }}
      />

      <div className="relative z-10 w-full max-w-[380px] my-auto">
        {/* Brand header */}
        <div className="text-center mb-3">
          <div className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-slate-900 text-white font-bold text-xs mb-1.5 shadow-xs ring-1 ring-slate-800">
            HM
          </div>
          <div className="flex items-center justify-center gap-1.5 mb-0.5">
            <h1 className="text-lg font-bold tracking-tight text-slate-900">HireMind</h1>
            <span className="px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              AI
            </span>
          </div>
          <p className="text-[11.5px] text-slate-500 font-normal">
            Autonomous Tech Candidate Screening &amp; ATS Intelligence
          </p>
        </div>

        {/* Core Auth Card */}
        <LoginAuthCard />

        {/* Candidate application link */}
        <div className="mt-3 text-center text-[11px] text-slate-500">
          Looking to apply for an open role?{" "}
          <a
            href="/apply"
            className="text-slate-700 hover:text-indigo-600 font-semibold underline underline-offset-2 transition-colors"
          >
            Public Application Portal (/apply)
          </a>
        </div>
      </div>
    </div>
  );
}