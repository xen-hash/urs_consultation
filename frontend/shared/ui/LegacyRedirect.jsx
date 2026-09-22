import { Navigate, useLocation } from "react-router-dom";

/**
 * Answering an address from before the apps were split.
 *
 * Student, faculty and administration used to be three paths inside one site:
 * /student/dashboard, /teacher/dashboard, /dean/dashboard. They are now three
 * origins, and each app's screens sit at its own root. Every one of those old
 * addresses is in somebody's bookmarks, in an installed app's shortcut, and in
 * the QR codes already printed on the faculty ID cards.
 *
 * So they still work. Each app keeps a route for the old path it used to own
 * and sends it to the new one — which is a redirect rather than a second route
 * rendering the same screen, so the address bar ends up holding the address
 * worth bookmarking next time.
 *
 * `Navigate to="/dashboard"` on its own would drop everything after the path,
 * and the part it drops is the part that says which tab: /student/dashboard#inbox
 * is a link somebody sent to a specific screen. The search and hash are carried
 * across so the link lands where it was aimed.
 */
export default function LegacyRedirect({ to }) {
  const { search, hash } = useLocation();
  return <Navigate to={{ pathname: to, search, hash }} replace />;
}
