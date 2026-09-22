import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { readTheme, setTheme } from "./theme.js";

/**
 * Light, dark, or follow the device.
 *
 * A segmented control rather than a single cycling button: a button that
 * advances through three states shows you the icon of the state you are in, or
 * the one you are going to, and neither is legible without pressing it to find
 * out. Three targets, one pressed, nothing to decode.
 *
 * `tone="dark"` is for a control sitting on the administration rail, which is
 * navy in both themes.
 */

const OPTIONS = [
  { id: "light",  label: "Light",  icon: Sun },
  { id: "dark",   label: "Dark",   icon: Moon },
  { id: "system", label: "System", icon: Monitor },
];

/** Keeps every mounted control in step, including across tabs. */
export function useThemeChoice() {
  const [theme, setThemeState] = useState(readTheme);

  useEffect(() => {
    const onLocal = e => setThemeState(e.detail);
    const onOtherTab = e => { if (e.key === "urs.theme") setThemeState(readTheme()); };
    window.addEventListener("urs:themechange", onLocal);
    window.addEventListener("storage", onOtherTab);
    return () => {
      window.removeEventListener("urs:themechange", onLocal);
      window.removeEventListener("storage", onOtherTab);
    };
  }, []);

  return [theme, choice => setThemeState(setTheme(choice))];
}

export default function ThemeToggle({ tone = "light", className = "" }) {
  const [theme, choose] = useThemeChoice();

  const styles = tone === "dark"
    ? { rail: "bg-white/10", on: "bg-white/20 text-white", off: "text-white/55 hover:text-white" }
    : { rail: "bg-surface-2", on: "bg-surface text-fg shadow-sm", off: "text-muted-fg hover:text-fg" };

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className={`inline-flex items-center gap-0.5 p-0.5 rounded-lg ${styles.rail} ${className}`}
    >
      {OPTIONS.map(({ id, label, icon: Icon }) => {
        const active = theme === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={active}
            // The icons alone are the whole control, so each needs its name.
            aria-label={label}
            title={label}
            onClick={() => choose(id)}
            className={`w-8 h-8 grid place-items-center rounded-md transition-colors duration-150
                        ${active ? styles.on : styles.off}`}
          >
            <Icon size={15} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
