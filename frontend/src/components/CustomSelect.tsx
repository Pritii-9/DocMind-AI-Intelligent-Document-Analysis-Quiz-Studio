import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, FileText } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
  icon?: any;
}

interface CustomSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  fullWidth?: boolean;
}

export default function CustomSelect({
  options,
  value,
  onChange,
  placeholder = "Select an option…",
  label,
  fullWidth = true,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedOpt = options.find(o => o.value === value);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={`relative ${fullWidth ? "w-full" : "w-auto"}`}>
      {label && (
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500 mb-2">{label}</p>
      )}

      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={[
          "w-full flex items-center justify-between gap-2.5 bg-white rounded-[10px] px-3.5 py-[11px] text-[13.5px] outline-none cursor-pointer transition-all duration-150",
          "border",
          open
            ? "border-[var(--brand)] ring-[3px] ring-[var(--brand)]/15"
            : "border-slate-200 shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
          selectedOpt ? "font-semibold text-slate-900" : "font-normal text-slate-400",
        ].join(" ")}
      >
        <div className="flex items-center gap-2.5 min-w-0 overflow-hidden">
          {selectedOpt?.icon ? (
            <selectedOpt.icon size={16} style={{ color: "var(--brand)", flexShrink: 0 }} />
          ) : (
            <FileText size={16} style={{ color: selectedOpt ? "var(--brand)" : "#94a3b8", flexShrink: 0 }} />
          )}
          <span className="overflow-hidden text-ellipsis whitespace-nowrap">
            {selectedOpt ? selectedOpt.label : placeholder}
          </span>
        </div>
        <ChevronDown
          size={16}
          className="text-slate-400 shrink-0 transition-transform duration-200"
          style={{ transform: open ? "rotate(180deg)" : "none" }}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="animate-in absolute top-[calc(100%+6px)] left-0 right-0 z-[90] bg-white border border-slate-200 rounded-xl shadow-[0_12px_30px_-5px_rgba(0,0,0,0.12),0_4px_6px_-2px_rgba(0,0,0,0.04)] max-h-60 overflow-y-auto p-1.5">
          {options.length === 0 ? (
            <p className="px-3.5 py-3 text-[13px] text-slate-400 text-center">No options available</p>
          ) : (
            options.map(opt => {
              const isSel = opt.value === value;
              const OptIcon = opt.icon || FileText;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { onChange(opt.value); setOpen(false); }}
                  className={[
                    "w-full flex items-center justify-between gap-2.5 px-3 py-[9px] rounded-lg border-none text-left text-[13px] cursor-pointer transition-all duration-[120ms]",
                    isSel
                      ? "font-semibold"
                      : "font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                  ].join(" ")}
                  style={
                    isSel
                      ? { background: "var(--brand-light)", color: "var(--brand)" }
                      : undefined
                  }
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <OptIcon size={15} style={{ color: isSel ? "var(--brand)" : "#94a3b8", flexShrink: 0 }} />
                    <div>
                      <p className="m-0 overflow-hidden text-ellipsis whitespace-nowrap">{opt.label}</p>
                      {opt.sublabel && <p className="m-0 text-[11px] text-slate-400">{opt.sublabel}</p>}
                    </div>
                  </div>
                  {isSel && <Check size={15} style={{ color: "var(--brand)", flexShrink: 0 }} />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
