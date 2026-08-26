/** @type {import('tailwindcss').Config} */
// Colours live once as CSS custom properties in index.css and are mapped to
// utility names here, so components never carry raw hex values.
//
// The tokens hold bare RGB channels ("0 51 102") rather than hex, because that
// is the only form Tailwind can apply an opacity modifier to — `bg-brand/10`
// and `border-border/70` both depend on the `<alpha-value>` placeholder below.
const rgb = (name) => `rgb(var(--${name}) / <alpha-value>)`;

const ramp = (prefix, stops) =>
  Object.fromEntries(stops.map(s => [s, rgb(`${prefix}-${s}`)]));

export default {
  content: ["./index.html", "./*.{js,jsx}", "./ui/**/*.{js,jsx}", "./admin/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        canvas:          rgb("canvas"),
        surface:         rgb("surface"),
        "surface-2":     rgb("surface-2"),
        fg:              rgb("fg"),
        "muted-fg":      rgb("muted-fg"),
        "subtle-fg":     rgb("subtle-fg"),
        border:          rgb("border"),
        "border-strong": rgb("border-strong"),
        "on-backdrop":   rgb("on-backdrop"),
        brand:   { DEFAULT: rgb("brand-600"),
                   ...ramp("brand", [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]) },
        accent:  { DEFAULT: rgb("accent"), fg: rgb("accent-fg"), 50: rgb("accent-50") },
        success: { DEFAULT: rgb("success"), 50: rgb("success-50") },
        warning: { DEFAULT: rgb("warning-fg"), fg: rgb("warning-fg"), 50: rgb("warning-50") },
        danger:  { DEFAULT: rgb("danger"), 50: rgb("danger-50") },
        info:    { DEFAULT: rgb("info"), 50: rgb("info-50") },
      },
      // text-* reads its own tokens. In dark mode a brand fill has to stay dark
      // under white button text while brand text has to be light on a dark
      // card; one scale cannot be both, so the text scale is its own.
      textColor: {
        brand:   { DEFAULT: rgb("brand-text"),
                   ...ramp("brand", [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]) },
        success: rgb("success-text"),
        danger:  rgb("danger-text"),
        info:    rgb("info-text"),
        warning: { DEFAULT: rgb("warning-text"), fg: rgb("warning-text") },
        accent:  { DEFAULT: rgb("accent"), fg: rgb("accent-text") },
      },
      borderColor:  { DEFAULT: rgb("border") },
      ringColor:    { DEFAULT: rgb("ring") },
      borderRadius: { sm: "var(--radius-sm)", DEFAULT: "var(--radius)",
                      md: "var(--radius)", lg: "var(--radius-lg)", xl: "var(--radius-lg)" },
      boxShadow:    { sm: "var(--shadow-sm)", DEFAULT: "var(--shadow)", lg: "var(--shadow-lg)" },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
      },
      // Headings step down on small screens instead of overflowing them.
      fontSize: {
        display: ["clamp(1.75rem, 1.2rem + 2.4vw, 2.5rem)",
                  { lineHeight: "1.15", letterSpacing: "-0.02em" }],
        title:   ["clamp(1.375rem, 1.1rem + 1.2vw, 1.75rem)",
                  { lineHeight: "1.25", letterSpacing: "-0.015em" }],
      },
      screens: { xs: "400px" },
    },
  },
  plugins: [],
};
