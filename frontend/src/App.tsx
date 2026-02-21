import Login from "./pages/Login";
import Viewer from "./pages/Viewer";
import { AuthProvider, useAuth } from "./context/AuthContext";
import "./App.css";

function AppContent() {
  const { token } = useAuth();
  // If no token, show login. If token exists, show the PDF viewer.
  return !token ? <Login /> : <Viewer />;
}

export default function App() {
  return (
    <AuthProvider>
      <div className="App">
        <h1>🔐 Secure PDF Streamer</h1>
        <AppContent />
      </div>
    </AuthProvider>
  );
}