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
  updateUser: (name: string) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"));
  const [user, setUser] = useState<AuthUser | null>(() => {
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const appPath = token ? "/workspace" : "/";
    const appState = token ? { appShell: "workspace" } : { appShell: "login" };

    if (token) {
      if (window.location.pathname === "/") {
        // Keep the login entry as an in-app sentinel so Back cannot leave the SPA.
        window.history.replaceState({ appShell: "login-sentinel" }, "", "/");
        window.history.pushState(appState, "", appPath);
      } else if (window.location.pathname !== appPath || window.history.state?.appShell !== appState.appShell) {
        window.history.replaceState(appState, "", appPath);
        window.history.pushState(appState, "", appPath);
      } else {
        // Also arm the guard after a direct reload on /workspace.
        window.history.pushState(appState, "", appPath);
      }
    } else if (window.location.pathname !== appPath || window.history.state?.appShell !== appState.appShell) {
      window.history.replaceState(appState, "", appPath);
    }

    const restoreAppShell = () => {
      if (token) {
        // Browser Back reaches the sentinel; replace it with a fresh workspace entry.
        if (window.location.pathname !== appPath || window.history.state?.appShell !== appState.appShell) {
          window.history.replaceState(appState, "", appPath);
        }
        window.history.pushState(appState, "", appPath);
      } else if (window.location.pathname !== appPath || window.history.state?.appShell !== appState.appShell) {
        window.history.replaceState(appState, "", appPath);
      }
    };

    window.addEventListener("popstate", restoreAppShell);
    window.addEventListener("pageshow", restoreAppShell);
    return () => {
      window.removeEventListener("popstate", restoreAppShell);
      window.removeEventListener("pageshow", restoreAppShell);
    };
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

  const updateUser = (name: string) => {
    setUser(prev => {
      if (!prev) return null;
      const updated = { ...prev, name };
      localStorage.setItem("user", JSON.stringify(updated));
      return updated;
    });
  };

  const value = useMemo(
    () => ({ token, user, isAuthenticated: !!token, login, logout, updateUser }),
    [token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
