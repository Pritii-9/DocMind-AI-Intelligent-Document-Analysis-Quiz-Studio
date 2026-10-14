import { useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import Workspace from "./pages/Workspace";
import CandidateApply from "./pages/CandidateApply";

export default function App() {
  const { isAuthenticated } = useAuth();
  const isApplyRoute = window.location.pathname.startsWith("/apply");

  if (isApplyRoute) {
    return <CandidateApply />;
  }

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-[var(--text-strong)] transition-colors duration-300">
      {isAuthenticated ? <Workspace /> : <Login />}
    </div>
  );
}
