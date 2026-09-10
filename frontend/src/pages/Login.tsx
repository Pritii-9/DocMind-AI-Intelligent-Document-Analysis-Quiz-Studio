import LoginAuthCard from "../components/LoginAuthCard";

export default function Login() {
  return (
    <div
      className="relative min-h-screen flex flex-col items-center justify-center px-5 py-10 font-[Inter,system-ui,sans-serif] text-slate-900 overflow-hidden"
      style={{ background: "radial-gradient(circle at 50% 0%, var(--brand-light) 0%, #f8fafc 70%)" }}
    >
      {/* Dot grid background */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{ backgroundImage: "radial-gradient(#e2e8f0 1px, transparent 1px)", backgroundSize: "24px 24px" }}
      />

      <div className="w-full max-w-[410px] relative z-10 animate-in">
        {/* Brand header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-[52px] h-[52px] rounded-2xl bg-white shadow-md border border-slate-200 mb-4">
            <img src="/logo.svg" alt="DocMind Logo" className="w-[34px] h-[34px] rounded-[9px]" />
          </div>
          <h1 className="text-[22px] font-extrabold tracking-[-0.03em] text-slate-900 mb-1">DocMind</h1>
          <p className="text-[13px] text-slate-500 font-medium">Intelligent Document Analysis &amp; Quiz Studio</p>
        </div>

        {/* Auth Card */}
        <div className="shadow-[0_20px_35px_-10px_rgba(15,23,42,0.06),0_1px_3px_rgba(0,0,0,0.03)]">
          <LoginAuthCard />
        </div>

        {/* Footer note */}
        <p className="text-center mt-7 text-xs text-slate-400 font-medium">
          Encrypted S3 storage · DocMind AI Workspace
        </p>
      </div>
    </div>
  );
}