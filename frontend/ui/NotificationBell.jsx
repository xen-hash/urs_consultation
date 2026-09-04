import { useCallback, useEffect, useState } from "react";
import {
  Bell, CalendarCheck, CheckCircle2, Inbox, ShieldCheck, UserCheck, XCircle,
} from "lucide-react";

import { Drawer, EmptyState, Spinner } from "../SharedUI.jsx";
import api from "../httpClient.js";
import { formatAgo } from "./datetime.js";

/**
 * The bell, and the panel behind it.
 *
 * Read state lives on the server, not in this browser. The student inbox used
 * to keep what had been read in localStorage, so opening the app on a phone
 * after reading everything on a laptop showed it all as unread again.
 *
 * The panel is the `Drawer` from ui/index.jsx, which was written for the admin
 * sidebar, exported, and then never used by anything.
 */

const ICONS = {
  "request.new":       Inbox,
  "request.accepted":  UserCheck,
  "request.declined":  XCircle,
  "request.done":      CheckCircle2,
  "request.cancelled": XCircle,
  "appointment.set":   CalendarCheck,
  "account.verified":  ShieldCheck,
};

export default function NotificationBell({ socket, className = "" }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);

  const refreshCount = useCallback(async () => {
    try {
      const { data } = await api.get("/notifications/unread-count");
      setUnread(data.unread || 0);
    } catch (_) { /* offline: leave the badge as it was */ }
  }, []);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/notifications?limit=20");
      setItems(data.data || []);
      setUnread(data.unread || 0);
    } catch (_) { /* the empty state covers this */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refreshCount(); }, [refreshCount]);

  // The socket carries the new notification, so the badge moves as it happens
  // rather than on the next poll. The poll stays as the fallback for a dropped
  // connection, at a much longer interval than it would otherwise need.
  useEffect(() => {
    if (!socket) return;
    const onNotification = () => {
      refreshCount();
      if (open) loadItems();
    };
    socket.on("notification", onNotification);
    return () => socket.off("notification", onNotification);
  }, [socket, open, refreshCount, loadItems]);

  useEffect(() => {
    const iv = setInterval(refreshCount, 120000);
    return () => clearInterval(iv);
  }, [refreshCount]);

  const openPanel = () => { setOpen(true); loadItems(); };

  const markRead = async (id) => {
    // Optimistic: the row is already on screen, and a failed write only means
    // it comes back unread on the next load.
    setItems(p => p.map(n => (n.id === id ? { ...n, read_at: n.read_at || "now" } : n)));
    setUnread(u => Math.max(0, u - 1));
    try {
      const { data } = await api.post(`/notifications/${id}/read`);
      setUnread(data.unread || 0);
    } catch (_) { refreshCount(); }
  };

  const markAllRead = async () => {
    setItems(p => p.map(n => ({ ...n, read_at: n.read_at || "now" })));
    setUnread(0);
    try { await api.post("/notifications/read-all"); }
    catch (_) { refreshCount(); }
  };

  return (
    <>
      <button
        type="button"
        onClick={openPanel}
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        className={`relative inline-flex items-center justify-center w-9 h-9 rounded-lg
                    hover:bg-surface-2 transition-colors ${className}`}
      >
        <Bell size={18} aria-hidden="true" />
        {unread > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full
                       bg-danger text-[10px] font-bold text-white grid place-items-center"
            // The label on the button already says the number; this would
            // otherwise be read out twice.
            aria-hidden="true"
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      <Drawer open={open} onClose={() => setOpen(false)} label="Notifications">
        <div className="flex items-center justify-between px-1 pb-3 mb-2 border-b border-border">
          <h2 className="font-semibold text-fg">Notifications</h2>
          {unread > 0 && (
            <button onClick={markAllRead}
              className="text-xs font-semibold text-brand hover:underline">
              Mark all read
            </button>
          )}
        </div>

        {loading && items.length === 0 ? (
          <div className="py-10 grid place-items-center"><Spinner /></div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="Nothing yet"
            description="Replies to your requests will show up here."
          />
        ) : (
          <ul className="space-y-1.5">
            {items.map(n => {
              const Icon = ICONS[n.kind] || Bell;
              const isUnread = !n.read_at;
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => isUnread && markRead(n.id)}
                    className={`w-full text-left flex gap-3 rounded-lg px-3 py-2.5 transition-colors
                                ${isUnread ? "bg-brand-50 hover:bg-brand-100"
                                           : "hover:bg-surface-2"}`}
                  >
                    <span className={`shrink-0 mt-0.5 ${isUnread ? "text-brand" : "text-muted-fg"}`}>
                      <Icon size={16} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block text-sm ${isUnread ? "font-semibold text-fg" : "text-muted-fg"}`}>
                        {n.title}
                      </span>
                      {n.body && (
                        <span className="block text-xs text-muted-fg mt-0.5 line-clamp-2">
                          {n.body}
                        </span>
                      )}
                      <span className="block text-[11px] text-subtle-fg mt-1">
                        {formatAgo(n.created_at)}
                      </span>
                    </span>
                    {isUnread && (
                      <span className="shrink-0 w-2 h-2 rounded-full bg-brand mt-1.5"
                        aria-hidden="true" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Drawer>
    </>
  );
}
