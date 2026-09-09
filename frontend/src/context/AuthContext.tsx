import React, { createContext, useContext, useState, useMemo, useEffect } from "react";

interface AuthUser {
  name: string;
  role: string;
  workspace_owner: string;
}

interface AuthContextType {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (token: string, name: string, role: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"));
  const [user, setUser] = useState<AuthUser | null>(() => {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  });

  useEffect(() => {
    if (!token) return;

    const workspacePath = "/workspace";
    window.history.replaceState({ appShell: true }, "", workspacePath);
    window.history.pushState({ appShell: true }, "", workspacePath);

    const keepWorkspaceOpen = () => {
      window.history.pushState({ appShell: true }, "", workspacePath);
    };

    window.addEventListener("popstate", keepWorkspaceOpen);
    return () => window.removeEventListener("popstate", keepWorkspaceOpen);
  }, [token]);

  const login = (t: string, name: string, role: string) => {
    const payload = JSON.parse(atob(t.split(".")[1]));
    const u: AuthUser = { name, role, workspace_owner: payload.workspace_owner || payload.sub };
    setToken(t);
    setUser(u);
    localStorage.setItem("token", t);
    localStorage.setItem("user", JSON.stringify(u));
  };

  const logout = () => {
    localStorage.clear();
    sessionStorage.clear();
    setToken(null);
    setUser(null);
    window.location.replace("/");
  };

  const value = useMemo(
    () => ({ token, user, isAuthenticated: !!token, login, logout }),
    [token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
