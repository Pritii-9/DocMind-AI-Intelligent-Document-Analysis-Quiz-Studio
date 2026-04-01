import { useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import Workspace from "./pages/Workspace";

export default function App() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-[var(--text-strong)] transition-colors duration-300">
      {isAuthenticated ? <Workspace /> : <Login />}
    </div>
  );
}
