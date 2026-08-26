// Screen chrome shared across the portals.
//
// The primitives (Button, Card, Badge, Modal, Toast, …) now live in ui/. This
// file re-exports them so existing imports keep working, and adds the page-level
// pieces that only make sense here.

import { Link } from "react-router-dom";
import { LogOut, ArrowLeft } from "lucide-react";
import ursLogo from "./URS_LOGO.png";
import { IconButton } from "./ui/index.jsx";

export { default as ConfirmSplash } from "./ui/ConfirmSplash.jsx";
export { default as ErrorSplash, classifyAuthError } from "./ui/ErrorSplash.jsx";
export {
  Button, IconButton, Card, CardHeader, StatusBadge, RequestBadge, Badge,
  Spinner, Skeleton, SkeletonRows, EmptyState, Alert, Modal, ConfirmModal,
  Drawer, Tabs, Pagination, Toast, useToastState, useScrollLock,
  ConfirmMark, AlertMark, useConfirmed,
} from "./ui/index.jsx";

/** Top bar for a signed-in area. `pt-safe` keeps it clear of the iOS notch —
 *  the PWA draws behind a translucent status bar. */
export function URSHeader({ title, subtitle, user, onLogout, backTo }) {
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
        <img src={ursLogo} alt="" aria-hidden="true" className="w-8 h-8 object-contain shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm text-fg truncate">{title || "University of Rizal System"}</p>
          {subtitle && <p className="text-xs text-muted-fg truncate">{subtitle}</p>}
        </div>
        {(person || onLogout) && (
          <div className="flex items-center gap-2 min-w-0">
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
    <main className={`flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 pb-safe ${className}`}>
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
