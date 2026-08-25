import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useScrollLock, IconButton } from "./index.jsx";

/**
 * The sections that do not fit the bottom bar, as a sheet from the bottom.
 *
 * A side drawer is desktop furniture wearing a phone costume: it slides in from
 * an edge nobody's thumb is near, and it duplicates navigation the bottom bar
 * already owns. This rises from the bar that opened it, so the interaction
 * starts and ends in the same place.
 */
export default function MoreSheet({ open, onClose, items, active, onSelect, footer }) {
  useScrollLock(open);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = e => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-brand-900/50 animate-fade" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="More sections"
        className="relative bg-surface rounded-t-xl shadow-lg animate-rise max-h-[80dvh] flex flex-col"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <h2 className="font-semibold text-fg">More</h2>
          <IconButton icon={X} label="Close" onClick={onClose} className="-mr-2" size={17} />
        </div>

        <ul className="overflow-y-auto p-2">
          {items.map(item => {
            const selected = item.id === active;
            return (
              <li key={item.id}>
                <button
                  onClick={() => { onSelect(item.id); onClose(); }}
                  aria-current={selected ? "page" : undefined}
                  className={`w-full flex items-center gap-3 px-3 min-h-[52px] rounded-lg text-sm font-medium
                    transition-colors duration-150
                    ${selected ? "bg-brand-50 text-brand" : "text-fg hover:bg-surface-2"}`}
                >
                  <item.icon size={19} aria-hidden="true" className="shrink-0" />
                  <span className="truncate">{item.label}</span>
                  {item.badge > 0 && (
                    <span className="ml-auto text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-accent text-brand-900">
                      {item.badge}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        {footer && (
          <div className="border-t border-border p-2 pb-safe shrink-0">{footer}</div>
        )}
      </div>
    </div>,
    document.body
  );
}
