// The single axios instance every component should use.
//
// It attaches the session token to each request and reacts to the server
// rejecting one, so an expired session ends at the login screen instead of a
// dashboard full of failed fetches.

import axios from "axios";
import { API_BASE } from "./constants.js";
import { getToken, clearSession, currentRole, loginPathFor } from "./auth.js";

// A cold start, not a slow query, is what this timeout is sized for. The
// backend sleeps when nobody has used it for a while, and the request that
// wakes it waits for the whole boot — database connection, schema check,
// roster seed. Anything shorter turns "the server is starting" into "the
// dashboard is broken".
const COLD_START_MS = 90000;

const api = axios.create({ baseURL: API_BASE, timeout: COLD_START_MS });

/**
 * Retry a read that failed before the server answered.
 *
 * Only GETs, and only for failures that carry no reply — a dropped connection,
 * a timeout, or a gateway saying the service behind it is not up yet. Those are
 * the shapes a waking or restarting backend produces, and one of them arriving
 * on the first load of a dashboard leaves every panel on it empty at once.
 * A 4xx is the server answering and is never retried; nor is anything that
 * changes state, which must not be sent twice.
 */
const RETRY_DELAYS_MS = [1500, 4000, 9000];

function worthRetrying(error) {
  const method = (error.config?.method || "get").toLowerCase();
  if (method !== "get") return false;
  const status = error.response?.status;
  if (status === undefined) return true;          // no reply at all
  return status === 502 || status === 503 || status === 504;
}

api.interceptors.response.use(undefined, async error => {
  const config = error.config;
  if (!config || !worthRetrying(error)) return Promise.reject(error);
  const attempt = config.__retry || 0;
  if (attempt >= RETRY_DELAYS_MS.length) return Promise.reject(error);
  config.__retry = attempt + 1;
  await new Promise(r => setTimeout(r, RETRY_DELAYS_MS[attempt]));
  return api(config);
});

api.interceptors.request.use(config => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  response => response,
  error => {
    const status = error.response?.status;
    const role = currentRole();

    // 401 and 403 mean the stored session cannot do what the page asked, so
    // drop it and return to that role's sign-in.
    //
    // Only when there IS a session. A login endpoint answers a wrong password
    // with 401 too, and treating that as an expiry redirected the browser away
    // from the form mid-submit — to /teacher, since loginPathFor(null) has no
    // role to key on. A failed sign-in belongs to the screen that asked for it.
    if ((status === 401 || status === 403) && role) {
      clearSession();
      const target = loginPathFor(role);
      if (window.location.pathname !== target) window.location.replace(target);
    }
    return Promise.reject(error);
  }
);

/**
 * True when the request never reached a working server.
 *
 * Worth separating from an ordinary error: "this backend build has no such
 * route" (404) is one panel being ahead of the deploy, while "nothing
 * answered" is the whole API being unreachable and every panel on the screen
 * being empty for the same reason. They need different things said about them.
 */
export function isUnreachable(error) {
  const status = error?.response?.status;
  return status === undefined || status === 502 || status === 503 || status === 504;
}

/** Message from an API error, falling back to something a person can act on. */
export function apiError(error, fallback = "Something went wrong. Please try again.") {
  if (error?.response?.status === 429) {
    return error.response.data?.error || "Too many attempts. Please wait and try again.";
  }
  return error?.response?.data?.error || fallback;
}

export default api;
