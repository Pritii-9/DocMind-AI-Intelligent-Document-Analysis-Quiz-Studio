import { LogOut, Menu, X } from "lucide-react";
import { useState } from "react";
import ThemeToggle from "./ThemeToggle";

interface LayoutProps {
  children: React.ReactNode;
  userName: string;
  onLogout: () => void;
}

export default function Layout({ children, userName, onLogout }: LayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-black/5 bg-[var(--app-bg)]/95 backdrop-blur dark:border-white/10">
        <div className="mx-auto flex max-w-full items-center justify-between gap-4 px-6 py-3.5">
          {/* Logo/Brand */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--accent)] to-cyan-600 text-xs font-bold text-white shadow-md">
              SV
            </div>
            <div className="hidden sm:block">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-soft)]">
                SafeUp
              </p>
              <p className="text-sm font-bold text-[var(--text-strong)]">Workspace</p>
            </div>
          </div>

          {/* Center - User Info (Desktop) */}
          <div className="hidden flex-1 items-center justify-center lg:flex">
            <p className="text-sm font-medium text-[var(--text-soft)]">
              Welcome, <span className="text-[var(--text-strong)]">{userName}</span>
            </p>
          </div>

          {/* Right - Actions */}
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button
              type="button"
              onClick={onLogout}
              className="hidden inline-flex items-center gap-2 rounded-lg bg-[var(--panel)] px-3 py-2 text-sm font-medium text-[var(--text-soft)] transition hover:text-rose-600 sm:inline-flex"
              title="Logout"
            >
              <LogOut size={16} />
              <span className="hidden md:inline">Logout</span>
            </button>

            {/* Mobile Menu Toggle */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="inline-flex rounded-lg bg-[var(--panel)] p-2 text-[var(--text-soft)] sm:hidden"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="border-t border-black/5 bg-[var(--panel)] px-6 py-4 dark:border-white/10">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-medium text-[var(--text-soft)]">
                Welcome, <span className="text-[var(--text-strong)]">{userName}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onLogout();
              }}
              className="flex w-full items-center gap-2 rounded-lg bg-[var(--panel-muted)] px-4 py-2.5 text-sm font-medium text-rose-600 transition hover:bg-rose-50/10 dark:hover:bg-rose-950/20"
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="border-t border-black/5 bg-[var(--panel)] dark:border-white/10">
        <div className="mx-auto max-w-full px-6 py-8">
          <div className="grid gap-8 md:grid-cols-3">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--accent)] to-cyan-600 text-xs font-bold text-white">
                  SV
                </div>
                <p className="font-bold text-[var(--text-strong)]">SafeUp</p>
              </div>
              <p className="mt-2 text-sm text-[var(--text-soft)]">
                Secure PDF workspace with live operations and team management.
              </p>
            </div>

            {/* Quick Links */}
            <div>
              <h3 className="font-semibold text-[var(--text-strong)]">Features</h3>
              <ul className="mt-3 space-y-2 text-sm text-[var(--text-soft)]">
                <li>Secure document streaming</li>
                <li>Team collaboration</li>
                <li>Real-time monitoring</li>
                <li>Access management</li>
              </ul>
            </div>

            {/* Info */}
            <div>
              <h3 className="font-semibold text-[var(--text-strong)]">About</h3>
              <ul className="mt-3 space-y-2 text-sm text-[var(--text-soft)]">
                <li>Enterprise-grade security</li>
                <li>Built for teams</li>
                <li>Fast and reliable</li>
                <li>Always available</li>
              </ul>
            </div>
          </div>

          {/* Bottom */}
          <div className="mt-8 border-t border-black/10 pt-6 text-center text-sm text-[var(--text-soft)] dark:border-white/10">
            <p>© 2024 SafeUp. Secure document management for teams that care about trust and control.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
