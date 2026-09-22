/**
 * Opening a dashboard on the tab that was asked for.
 *
 * The three dashboards keep their current tab in local state, which is right
 * for a tap on the tab strip and useless to anybody arriving from somewhere
 * else: "open my inbox" could only ever land on the dashboard's default tab
 * and leave the reader to find the rest themselves.
 *
 * So the tab is addressable — /student/dashboard#inbox — and this hook is what
 * reads it. A hash rather than a route or a query string: it needs no new
 * routes, it survives a refresh, and a link to a tab is a link anybody can
 * send. Which hashes a dashboard answers to is decided by navi-go.js, so the
 * names Navi navigates by and the names the dashboards accept cannot drift
 * apart.
 *
 * Unknown hashes are ignored rather than corrected. A URL carrying somebody
 * else's anchor is not a reason to move the tab they are looking at.
 */

import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

import { tabsFor } from "./navi-go.js";

/**
 * `onTab` is called with the tab id whenever the URL names one.
 *
 * It is held in a ref so a dashboard can pass an inline function — which every
 * one of them does — without the effect re-running on every render.
 */
export default function useHashTab(prefix, onTab) {
  const { hash, key, pathname } = useLocation();
  const handler = useRef(onTab);
  handler.current = onTab;

  useEffect(() => {
    if (pathname !== prefix) return;
    let want = "";
    try { want = decodeURIComponent(hash || ""); } catch { want = hash || ""; }
    want = want.replace(/^#/, "");
    if (want && tabsFor(prefix).includes(want)) handler.current(want);
    // `key` is a dependency on purpose. Asking for the same tab twice produces
    // the identical URL, so hash alone would not fire the second time — and
    // the second ask is usually somebody who wandered off the tab and wants it
    // back.
  }, [hash, key, pathname, prefix]);
}
