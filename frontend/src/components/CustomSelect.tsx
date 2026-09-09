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

const ACCENT        = "oklch(45% 0.033 256.848)";
const ACCENT_LIGHT  = "oklch(96% 0.015 256.848)";

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
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} style={{ position: "relative", width: fullWidth ? "100%" : "auto" }}>
      {label && (
        <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#64748b", marginBottom: 8 }}>
          {label}
        </p>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          width: "100%",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
          background: "#ffffff",
          border: `1px solid ${open ? ACCENT : "#e2e8f0"}`,
          borderRadius: 10,
          padding: "11px 14px",
          fontSize: 13.5,
          fontWeight: selectedOpt ? 600 : 400,
          color: selectedOpt ? "#0f172a" : "#94a3b8",
          cursor: "pointer",
          outline: "none",
          boxShadow: open
            ? "0 0 0 3px oklch(45% 0.033 256.848 / 0.15)"
            : "0 1px 2px rgba(0,0,0,0.04)",
          transition: "all 0.15s ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, overflow: "hidden" }}>
          {selectedOpt?.icon ? (
            <selectedOpt.icon size={16} color={ACCENT} style={{ flexShrink: 0 }} />
          ) : (
            <FileText size={16} color={selectedOpt ? ACCENT : "#94a3b8"} style={{ flexShrink: 0 }} />
          )}
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {selectedOpt ? selectedOpt.label : placeholder}
          </span>
        </div>
        <ChevronDown
          size={16}
          color="#94a3b8"
          style={{
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.2s ease",
            flexShrink: 0,
          }}
        />
      </button>

      {/* Popover Menu */}
      {open && (
        <div
          className="animate-in"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            zIndex: 90,
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            boxShadow: "0 12px 30px -5px rgba(0,0,0,0.12), 0 4px 6px -2px rgba(0,0,0,0.04)",
            maxHeight: 240,
            overflowY: "auto",
            padding: 6,
          }}
        >
          {options.length === 0 ? (
            <p style={{ padding: "12px 14px", fontSize: 13, color: "#94a3b8", margin: 0, textAlign: "center" }}>
              No options available
            </p>
          ) : (
            options.map(opt => {
              const isSel = opt.value === value;
              const OptIcon = opt.icon || FileText;

              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  style={{
                    width: "100%",
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: "none",
                    background: isSel ? ACCENT_LIGHT : "transparent",
                    color: isSel ? ACCENT : "#334155",
                    cursor: "pointer",
                    textAlign: "left",
                    fontSize: 13,
                    fontWeight: isSel ? 600 : 500,
                    transition: "all 0.12s ease",
                  }}
                  onMouseEnter={e => {
                    if (!isSel) {
                      e.currentTarget.style.background = "#f8fafc";
                      e.currentTarget.style.color = "#0f172a";
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isSel) {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = "#334155";
                    }
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                    <OptIcon size={15} color={isSel ? ACCENT : "#94a3b8"} style={{ flexShrink: 0 }} />
                    <div>
                      <p style={{ margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {opt.label}
                      </p>
                      {opt.sublabel && (
                        <p style={{ margin: 0, fontSize: 11, color: "#94a3b8" }}>{opt.sublabel}</p>
                      )}
                    </div>
                  </div>
                  {isSel && <Check size={15} color={ACCENT} style={{ flexShrink: 0 }} />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
