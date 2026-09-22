import { Link } from "react-router-dom";

import { isExternal } from "../lib/origins.js";

/**
 * A link that may or may not stay in this app.
 *
 * Since the split there are two kinds of address in the same lists: a path
 * inside this deployment, which the router handles without a reload, and a URL
 * on one of the other two origins, which the router knows nothing about.
 * Handing an absolute URL to react-router's Link produces a link to
 * "/https://faculty.example.com" — a 404 on this origin, and a link that looks
 * fine right up until it is clicked.
 *
 * So the caller keeps writing one `to` and this picks. Which kind it is comes
 * from shared/lib/origins.js, not from the call site, so a destination that
 * moves between apps needs no change here or anywhere else.
 */
export default function AppLink({ to, children, ...rest }) {
  if (isExternal(to)) {
    return <a href={to} {...rest}>{children}</a>;
  }
  return <Link to={to} {...rest}>{children}</Link>;
}
