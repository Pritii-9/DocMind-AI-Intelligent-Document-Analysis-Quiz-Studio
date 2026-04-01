import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type ThemeMode = "light" | "dark";

function getInitialTheme(): ThemeMode {
  const saved = localStorage.getItem("theme");
  if (saved === "light" || saved === "dark") {
    return saved;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);

  useEffect(() => {
    const html = document.documentElement;
    html.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-white/70 bg-white/75 p-1 shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-950/70">
      <button
        type="button"
        onClick={() => setTheme("light")}
        className={`rounded-full p-2 transition ${theme === "light" ? "bg-[var(--accent)] text-white" : "text-[var(--text-soft)] hover:text-[var(--text-strong)]"}`}
        aria-label="Use light theme"
      >
        <Sun size={16} />
      </button>
      <button
        type="button"
        onClick={() => setTheme("dark")}
        className={`rounded-full p-2 transition ${theme === "dark" ? "bg-[var(--accent)] text-white" : "text-[var(--text-soft)] hover:text-[var(--text-strong)]"}`}
        aria-label="Use dark theme"
      >
        <Moon size={16} />
      </button>
      <span className="hidden items-center gap-2 px-2 text-xs font-semibold text-[var(--text-soft)] sm:inline-flex">
        <Monitor size={14} />
        Theme
      </span>
    </div>
  );
}
