import { useEffect, useRef, useState, useCallback } from "react";
import api from "../httpClient.js";

/** Debounce a fast-changing value so typing doesn't fire a request per keystroke. */
export function useDebounced(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

/**
 * A paged, server-filtered collection.
 *
 * The old dashboard fetched page 1 of everything in a single callback whose
 * dependency array was empty while it closed over the page state, so paging
 * re-fetched page 1 forever and search only ever filtered the 20 rows already
 * on screen. Each collection owns its own query here, and every filter goes to
 * the server.
 */
export function usePagedResource(path, { params = {}, limit = 20, enabled = true } = {}) {
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Serialised so the effect compares by value, not by object identity.
  const key = JSON.stringify(params);
  const reqId = useRef(0);

  const load = useCallback(async () => {
    if (!enabled) return;
    const id = ++reqId.current;
    setLoading(true);
    try {
      const { data: body } = await api.get(path, {
        params: { page, limit, ...JSON.parse(key) },
      });
      // A slower earlier request must not overwrite a newer response.
      if (id !== reqId.current) return;
      const rows = body?.data ?? body ?? [];
      setData(rows);
      setTotal(body?.total ?? rows.length);
      setPages(body?.pages ?? 1);
      setError(null);
    } catch (e) {
      if (id === reqId.current) setError(e);
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [path, page, limit, key, enabled]);

  useEffect(() => { load(); }, [load]);

  // Any filter change invalidates the current page number.
  useEffect(() => { setPage(1); }, [key]);

  return { data, total, pages, page, setPage, loading, error, reload: load, limit };
}

/** Dashboard totals, computed in SQL rather than counted from the current page. */
export function useStats(refreshMs = 30000) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/admin/stats");
      setStats(data);
      setError(null);
    } catch (e) {
      // The numbers already on screen stay: a failed refresh should not blank a
      // dashboard that was reading correctly a moment ago. But the failure is
      // reported rather than swallowed — on the *first* load there are no last
      // good numbers, and silence there left the screen showing "—" over
      // "0 with an active card", which reads as a school with no faculty in it
      // rather than as a server that did not answer.
      setError(e);
    }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    if (!refreshMs) return undefined;
    const id = setInterval(load, refreshMs);
    return () => clearInterval(id);
  }, [load, refreshMs]);

  return { stats, loading, error, reload: load };
}

/** Faculty availability board, shared by the overview and faculty tabs. */
export function useDepartments(refreshMs = 30000) {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/teacher-logs");
      setDepartments(data || []);
      setError(null);
    } catch (e) {
      setError(e);   // Same reasoning as useStats: keep the rows, report the failure.
    }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    if (!refreshMs) return undefined;
    const id = setInterval(load, refreshMs);
    return () => clearInterval(id);
  }, [load, refreshMs]);

  return { departments, loading, error, reload: load };
}
