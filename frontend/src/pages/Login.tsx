import LoginAuthCard from "../components/LoginAuthCard";

export default function Login() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(circle at 50% 0%, oklch(96% 0.015 256.848) 0%, #f8fafc 70%)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "40px 20px",
      fontFamily: "'Inter', system-ui, sans-serif",
      color: "#0f172a",
      position: "relative",
      overflow: "hidden",
    }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Subtle Background Pattern Mesh */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "radial-gradient(#e2e8f0 1px, transparent 1px)",
        backgroundSize: "24px 24px",
        opacity: 0.4,
        pointerEvents: "none",
      }} />

      <div style={{ width: "100%", maxWidth: 410, position: "relative", zIndex: 10 }} className="animate-in">

        {/* Brand Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 52,
            height: 52,
            borderRadius: 14,
            background: "#ffffff",
            boxShadow: "0 4px 12px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
            border: "1px solid #e2e8f0",
            marginBottom: 16,
          }}>
            <img src="/logo.svg" alt="DocMind Logo" style={{ width: 34, height: 34, borderRadius: 9 }} />
          </div>
          <h1 style={{
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            color: "#0f172a",
            margin: "0 0 6px 0",
          }}>
            DocMind
          </h1>
          <p style={{
            fontSize: 13,
            color: "#64748b",
            margin: 0,
            fontWeight: 500,
          }}>
            Intelligent Document Analysis & Quiz Studio
          </p>
        </div>

        {/* Centered Auth Card */}
        <div style={{
          boxShadow: "0 20px 35px -10px rgba(15,23,42,0.06), 0 1px 3px rgba(0,0,0,0.03)",
        }}>
          <LoginAuthCard />
        </div>

        {/* Footer info */}
        <p style={{
          textAlign: "center",
          marginTop: 28,
          fontSize: 12,
          color: "#94a3b8",
          margin: "28px 0 0 0",
          fontWeight: 500,
        }}>
          Encrypted S3 storage · DocMind AI Workspace
        </p>

      </div>
    </div>
  );
}