// Screen chrome shared across the portals.
//
// The primitives (Button, Card, Badge, Modal, Toast, …) now live in ui/. This
// file re-exports them so existing imports keep working, and adds the page-level
// pieces that only make sense here.

import { Link } from "react-router-dom";
import { LogOut, ArrowLeft, HelpCircle } from "lucide-react";
import { IconButton } from "./ui/index.jsx";
import HomeBrand from "./ui/HomeBrand.jsx";

export { default as ConfirmSplash } from "./ui/ConfirmSplash.jsx";
export { default as ErrorSplash, classifyAuthError } from "./ui/ErrorSplash.jsx";
export {
  Button, IconButton, Card, CardHeader, StatusBadge, RequestBadge, Badge,
  Spinner, Skeleton, SkeletonRows, EmptyState, Alert, Modal, ConfirmModal,
  Drawer, Tabs, Pagination, Toast, useToastState, useScrollLock,
  ConfirmMark, AlertMark, useConfirmed, NumberField,
} from "./ui/index.jsx";

/** Top bar for a signed-in area. `pt-safe` keeps it clear of the iOS notch —
 *  the PWA draws behind a translucent status bar. */
export function URSHeader({ title, subtitle, user, onLogout, backTo, onHelp, actions }) {
  // Callers pass either a display string or { name, sub } — the dashboards use
  // the object form to show who is signed in and their ID or department.
  // Rendering the object directly is a React crash, which unmounts the whole
  // route to a blank page rather than failing locally.
  const person = typeof user === "string" ? { name: user } : user || null;

  return (
    <header className="sticky top-0 z-30 bg-surface header-blend header-blend-canvas pt-safe">
      <div className="flex items-center gap-3 px-4 sm:px-6 py-3">
        {backTo && (
          <Link to={backTo} aria-label="Back"
            className="w-11 h-11 grid place-items-center -ml-2 rounded-lg text-muted-fg hover:text-fg hover:bg-surface-2">
            <ArrowLeft size={18} aria-hidden="true" />
          </Link>
        )}
        {/* The name is the way back to the front page — signed in, it asks
            first and signs you out on the way. */}
        <HomeBrand title={title || "University of Rizal System"} subtitle={subtitle}
          className="flex-1" confirmSignOut />
        {(person || onLogout || onHelp || actions) && (
          <div className="flex items-center gap-2 min-w-0">
            {/* Anything role-specific that belongs in the top bar — the
                notification bell, today. Placed before the identity block
                so sign-out stays the last thing on the row. */}
            {actions}
            {/* The walkthrough has to be reachable after it is dismissed —
                otherwise the only way back to it is clearing site data. */}
            {onHelp && <IconButton icon={HelpCircle} label="Show the guide" onClick={onHelp} />}
            {person?.name && (
              <div className="hidden sm:block text-right min-w-0">
                <p className="text-sm font-medium text-fg truncate max-w-[200px]">{person.name}</p>
                {person.sub && (
                  <p className="text-xs text-muted-fg truncate max-w-[200px]">{person.sub}</p>
                )}
              </div>
            )}
            {onLogout && <IconButton icon={LogOut} label="Sign out" onClick={onLogout} />}
          </div>
        )}
      </div>
    </header>
  );
}

/** Standard page column: full height, safe-area aware, capped width. */
export function PageWrapper({ children, className = "" }) {
  return <div className={`min-h-dvh bg-canvas flex flex-col ${className}`}>{children}</div>;
}

export function ContentArea({ children, className = "" }) {
  return (
    <main className={`flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] ${className}`}>
      {children}
    </main>
  );
}

export function PageHeading({ title, description, action }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
      <div className="min-w-0">
        <h1 className="text-title font-bold text-fg">{title}</h1>
        {description && <p className="text-muted-fg mt-1 text-sm">{description}</p>}
      </div>
      {action}
    </div>
  );
}
