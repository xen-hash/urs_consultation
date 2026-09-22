import { useEffect, useState } from "react";

import api from "../lib/httpClient.js";

/**
 * How many faculty are free right now, for the front page.
 *
 * The landing page used to be a static menu of three sign-in buttons, which
 * says nothing a poster could not. The one thing this system knows that nobody
 * else does is who is free at this minute, so the front page says it — and in
 * saying it, proves the thing is working before anyone signs in.
 *
 * Reads the same public endpoint the availability board does. No session, no
 * socket: the board keeps a live connection because it is watched for minutes
 * at a time; the front page is looked at for seconds and one fetch is plenty.
 */

/**
 * Available and total, from the board's payload.
 *
 * Exported for its own sake: getting this wrong means the front page states a
 * number about staff availability that is not true, which is worse than
 * showing nothing.
 */
export function countAvailable(departments) {
  const professors = (departments || []).flatMap(d => d?.professors || []);
  return {
    available: professors.filter(p => p?.status === "Available").length,
    total: professors.length,
  };
}

/**
 * Returns `{ state, available, total }`.
 *
 * `state` is "loading", "ready" or "unavailable", and the distinction matters:
 * nobody being free and the server not answering both produce a zero, and
 * rendering "0 faculty available right now" when the backend is simply down is
 * a confident lie. Only "ready" may show a number.
 */
export default function useLiveAvailability() {
  const [result, setResult] = useState({ state: "loading", available: 0, total: 0 });

  useEffect(() => {
    let cancelled = false;

    // Same reasoning as navi-live.js: the shared client's patient retries are
    // for dashboards that are useless until they load. This is one line on a
    // landing page, and shimmering for sixteen seconds to eventually say
    // nothing is worse than saying nothing promptly.
    api.get("/teacher-logs", { timeout: 8000, __noRetry: true })
      .then(({ data }) => {
        if (cancelled) return;
        const { available, total } = countAvailable(data);
        // An empty roster is not something to boast about either way, and it
        // means the seed has not run. Treat it as nothing to say.
        setResult(total > 0
          ? { state: "ready", available, total }
          : { state: "unavailable", available: 0, total: 0 });
      })
      .catch(() => {
        if (!cancelled) setResult({ state: "unavailable", available: 0, total: 0 });
      });

    return () => { cancelled = true; };
  }, []);

  return result;
}
