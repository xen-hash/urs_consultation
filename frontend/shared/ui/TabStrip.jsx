/**
 * The section switcher on a wide screen.
 *
 * Below `lg` this is not drawn at all — BottomNav is, because a row of tabs
 * across the top of a phone puts the thing you switch with at the far end of
 * your thumb's reach. The two take the same `tabs` array, so a section cannot
 * exist in one and not the other.
 *
 * This was written out twice, in the student dashboard and the faculty one,
 * identically down to the class names. The only difference between the copies
 * was that one carried a `data-tour` attribute and the other did not, which is
 * exactly the kind of difference two copies produce: not a decision, just the
 * half of a change that got made.
 *
 * The active tab is in the app's own colour rather than the brand's. It is the
 * element on a signed-in screen that the eye returns to most, so it is the
 * cheapest place to say which of the three apps this is — and, unlike the
 * sign-in badge, it costs no room at all.
 */
export default function TabStrip({ tabs, active, onSelect, tourPrefix, className = "" }) {
  return (
    <div className={`hidden lg:block bg-surface border-b border-border ${className}`}>
      <div className="max-w-5xl mx-auto px-4 flex gap-1">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            aria-current={active === t.id ? "page" : undefined}
            data-tour={tourPrefix ? `${tourPrefix}${t.id}` : undefined}
            className={`flex items-center gap-2 px-4 min-h-[44px] text-sm font-semibold
              border-b-2 -mb-px transition-colors duration-200
              ${active === t.id
                ? "text-role border-role"
                : "text-muted-fg border-transparent hover:text-fg"}`}
          >
            <t.icon size={16} aria-hidden="true" />
            {t.label}
            {t.badge > 0 && (
              <span className="bg-accent text-brand-900 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
