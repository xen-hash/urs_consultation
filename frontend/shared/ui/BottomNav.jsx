import { MoreHorizontal } from "lucide-react";

/**
 * Bottom tab bar for small screens.
 *
 * Thumbs reach the bottom of a phone, not the top, so primary navigation
 * belongs there — the tab strip this replaces sat under the header, at the
 * furthest point from where anyone actually holds the device.
 *
 * Hidden from `lg` up, where the sidebar or top tabs have room to breathe.
 *
 * At most five slots: past that the targets get too narrow to hit reliably at
 * 320px. A longer list keeps its first four items and hands the rest to a
 * "More" action, which is expected to open the full navigation.
 */
export default function BottomNav({ items, active, onSelect, onMore, action, className = "" }) {
  // Six slots is the ceiling: at 320px that is ~53px each, which still clears
  // a comfortable touch target once the labels are kept short. Five sections
  // show and the sixth slot becomes More; below that everything fits.
  // `action` is a trailing slot that is not a section — the administration bar
  // ends in Sign out. It costs a slot, so it counts against the ceiling.
  const MAX_SLOTS = 6;
  const reserved = action ? 1 : 0;
  const fits = items.length + reserved <= MAX_SLOTS;
  const visible = fits ? items.length : MAX_SLOTS - 1 - reserved;
  const shown = items.slice(0, visible);
  const showMore = !fits;
  const overflowActive = items.slice(visible).some(i => i.id === active);

  return (
    <nav
      aria-label="Primary"
      className={`lg:hidden fixed bottom-0 inset-x-0 z-40 bg-surface border-t border-border pb-safe ${className}`}
    >
      <ul className="flex items-stretch">
        {shown.map(item => {
          const selected = item.id === active;
          return (
            <li key={item.id} className="flex-1 min-w-0">
              <button
                onClick={() => onSelect(item.id)}
                aria-current={selected ? "page" : undefined}
                data-tour={`nav-${item.id}`}
                className={`w-full h-full min-h-[64px] flex flex-col items-center justify-center gap-1.5
                  px-0.5 pt-2.5 pb-2 transition-colors duration-150 relative
                  ${selected ? "text-brand" : "text-muted-fg"}`}
              >
                {/* The active marker sits on the top edge so it reads as a tab
                    indicator rather than decoration under the label. */}
                <span
                  aria-hidden="true"
                  className={`absolute top-0 inset-x-3 h-0.5 rounded-full transition-opacity duration-150
                    ${selected ? "bg-brand opacity-100" : "opacity-0"}`}
                />
                <span className="relative shrink-0">
                  <item.icon size={22} className="xs:hidden" aria-hidden="true" />
                  <item.icon size={24} className="hidden xs:block" aria-hidden="true" />
                  {item.badge > 0 && (
                    <span
                      className="absolute -top-1.5 -right-2 min-w-[17px] h-[17px] px-1 rounded-full
                                 bg-accent text-brand-900 text-[10px] font-bold
                                 flex items-center justify-center"
                    >
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  )}
                </span>
                <span className={`text-[10px] xs:text-xs leading-none truncate max-w-full
                  ${selected ? "font-semibold" : "font-medium"}`}>
                  {item.label}
                </span>
              </button>
            </li>
          );
        })}

        {showMore && (
          <li className="flex-1 min-w-0">
            <button
              onClick={onMore}
              className={`w-full h-full min-h-[64px] flex flex-col items-center justify-center gap-1.5
                px-0.5 pt-2.5 pb-2 transition-colors duration-150 relative
                ${overflowActive ? "text-brand" : "text-muted-fg"}`}
            >
              <span
                aria-hidden="true"
                className={`absolute top-0 inset-x-3 h-0.5 rounded-full
                  ${overflowActive ? "bg-brand" : "opacity-0"}`}
              />
              <MoreHorizontal size={24} aria-hidden="true" />
              <span className={`text-[10px] xs:text-xs leading-none
                ${overflowActive ? "font-semibold" : "font-medium"}`}>
                More
              </span>
            </button>
          </li>
        )}
        {action && (
          <li className="flex-1 min-w-0">
            <button
              onClick={action.onClick}
              className="w-full h-full min-h-[64px] flex flex-col items-center justify-center gap-1.5
                         px-0.5 pt-2.5 pb-2 text-muted-fg hover:text-danger
                         transition-colors duration-150"
            >
              <action.icon size={22} className="xs:hidden shrink-0" aria-hidden="true" />
              <action.icon size={24} className="hidden xs:block shrink-0" aria-hidden="true" />
              <span className="text-[10px] xs:text-xs leading-none font-medium truncate max-w-full">
                {action.label}
              </span>
            </button>
          </li>
        )}
      </ul>
    </nav>
  );
}

/**
 * Spacer that keeps page content clear of the fixed bar.
 *
 * The bar is fixed, so without this the last rows of a list sit underneath it —
 * and on a phone the last row is often the one being reached for.
 */
export function BottomNavSpacer() {
  return <div aria-hidden="true" className="lg:hidden h-[calc(72px+env(safe-area-inset-bottom,0px))]" />;
}
