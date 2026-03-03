import { useState } from "react";

import { AuthProvider, useAuth } from "./context/AuthContext";
import type { AdminView } from "./components/Sidebar";
import AdminDashboard from "./pages/AdminDashboard";
import Login from "./pages/Login";
import Viewer from "./pages/Viewer";

function AppContent() {
  const { token, role } = useAuth();
  const [adminView, setAdminView] = useState<AdminView>("documents");

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans antialiased text-slate-900 dark:text-slate-100 transition-colors duration-300">
      {!token ? (
        <div className="flex flex-col items-center justify-center pt-20 px-4">
          <div className="flex items-center gap-3 mb-8">
            <div className="bg-blue-600 p-2.5 rounded-xl shadow-lg shadow-blue-200">
              <span className="text-xs font-black text-white">SV</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-slate-800 dark:text-white">
              SecureVault
            </h1>
          </div>
          <Login />
        </div>
      ) : role === "admin" ? (
        adminView === "documents" ? (
          <Viewer adminView={adminView} onChangeAdminView={setAdminView} />
        ) : (
          <AdminDashboard adminView={adminView} onChangeAdminView={setAdminView} />
        )
      ) : (
        <Viewer />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
