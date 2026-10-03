"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Bell,
  BellOff,
  BookOpen,
  Briefcase,
  CheckCheck,
  Circle,
  CircleCheck,
  Heart,
  MessageCircle,
  ShieldAlert,
  Sparkles,
  Trash2,
  Trophy,
  UserPlus,
  Users,
  Video,
} from "lucide-react";
import { api } from "@/lib/api";
import { useShellActions, useUser } from "../shell";
import { useRealtime, useSocketEvent } from "../realtime";
import { Heading, UserAvatar } from "../ui";

const PAGE_SIZE = 20;

const CATEGORY_LABELS = {
  social: "Social",
  jobs: "Jobs",
  contests: "Contests",
  courses: "Courses",
  webinars: "Webinars",
  communities: "Communities",
  system: "System",
  admin: "Admin",
};
const CATEGORIES_BY_ROLE = {
  learner: ["social", "jobs", "contests", "courses", "webinars", "communities", "system"],
  hirer: ["social", "jobs", "system"],
  admin: ["admin", "social", "system"],
};
const TYPE_ICONS = {
  post_like: Heart,
  comment_like: Heart,
  post_comment: MessageCircle,
  post_removed: ShieldAlert,
  report_update: ShieldAlert,
  report_received: ShieldAlert,
  hirer_registered: UserPlus,
  welcome: Sparkles,
};
const CATEGORY_ICONS = {
  jobs: Briefcase,
  contests: Trophy,
  courses: BookOpen,
  webinars: Video,
  communities: Users,
  admin: ShieldAlert,
  social: Heart,
};
const iconFor = (item) => TYPE_ICONS[item.type] || CATEGORY_ICONS[item.category] || Bell;

function timeAgo(value) {
  const seconds = Math.max(0, (Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function NotificationRow({ item, onOpen, onToggle, onDelete }) {
  const Icon = iconFor(item);
  const lead = (
    <span className="nt-lead">
      {item.actor_id ? (
        <UserAvatar id={item.actor_id} name={item.actor_name} hasPicture={item.actor_has_picture} />
      ) : (
        <span className={`nt-icon nt-${item.category}`}>
          <Icon size={19} />
        </span>
      )}
      {item.actor_id && (
        <span className={`nt-badge nt-${item.category}`}>
          <Icon size={11} />
        </span>
      )}
    </span>
  );
  const text = (
    <span className="nt-text">
      <strong>{item.title}</strong>
      {item.body && <span className="nt-body">{item.body}</span>}
      <span className="nt-meta">
        <time dateTime={item.created_at} title={new Date(item.created_at).toLocaleString()}>
          {timeAgo(item.created_at)}
        </time>
        <span className={`nt-tag nt-${item.category}`}>{CATEGORY_LABELS[item.category] || item.category}</span>
      </span>
    </span>
  );
  return (
    <li className={`nt-item${item.read ? "" : " unread"}`}>
      {item.link ? (
        <Link className="nt-main" href={item.link} onClick={() => onOpen(item)}>
          {lead}
          {text}
          {!item.read && <span className="nt-dot" role="img" aria-label="Unread" />}
        </Link>
      ) : (
        <div className="nt-main">
          {lead}
          {text}
          {!item.read && <span className="nt-dot" role="img" aria-label="Unread" />}
        </div>
      )}
      <div className="nt-actions">
        <button
          type="button"
          className="icon-button"
          onClick={() => onToggle(item)}
          title={item.read ? "Mark as unread" : "Mark as read"}
          aria-label={item.read ? "Mark as unread" : "Mark as read"}
        >
          {item.read ? <Circle size={17} /> : <CircleCheck size={17} />}
        </button>
        <button type="button" className="icon-button danger" onClick={() => onDelete(item)} title="Delete" aria-label="Delete notification">
          <Trash2 size={17} />
        </button>
      </div>
    </li>
  );
}

export default function Notifications() {
  const user = useUser();
  const { setUnreadCount } = useShellActions();
  const [filter, setFilter] = useState("all");
  const [category, setCategory] = useState("");
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [byCategory, setByCategory] = useState({});
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const latest = useRef(0);
  const count = useRef(0);
  count.current = items.length;
  const categories = CATEGORIES_BY_ROLE[user.role] || CATEGORIES_BY_ROLE.learner;

  const apply = useCallback(
    (data) => {
      setUnread(data.unread);
      setByCategory(data.unread_by_category || {});
      setUnreadCount(data.unread);
    },
    [setUnreadCount],
  );
  const url = useCallback(
    (offset, limit) => {
      const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
      if (filter === "unread") params.set("filter", "unread");
      if (category) params.set("category", category);
      return `frontend/notifications?${params}`;
    },
    [filter, category],
  );

  // Reload from the top when the filter changes. Silent reloads keep what is on screen.
  const reload = useCallback(
    async ({ silent = false } = {}) => {
      const request = ++latest.current;
      if (!silent) setLoading(true);
      try {
        const limit = silent ? Math.min(100, Math.max(PAGE_SIZE, count.current)) : PAGE_SIZE;
        const data = await api(url(0, limit));
        if (request !== latest.current) return;
        setItems(data.items);
        setHasMore(data.has_more);
        apply(data);
        setError("");
      } catch (requestError) {
        if (request === latest.current && !silent) setError(requestError.message);
      } finally {
        if (request === latest.current) setLoading(false);
      }
    },
    [url, apply],
  );
  useEffect(() => {
    reload();
  }, [reload]);
  // Live: the server pushes new notifications, so polling is only the fallback while the socket is down.
  const { connected } = useRealtime();
  useEffect(() => {
    if (connected) return;
    const timer = setInterval(() => document.visibilityState === "visible" && reload({ silent: true }), 30000);
    return () => clearInterval(timer);
  }, [reload, connected]);
  const refreshTimer = useRef(null);
  const refreshSoon = useCallback(() => {
    clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => reload({ silent: true }), 250);
  }, [reload]);
  useEffect(() => () => clearTimeout(refreshTimer.current), []);
  useSocketEvent("notification", refreshSoon);
  useSocketEvent("notification:removed", refreshSoon);
  useSocketEvent("notification:changed", refreshSoon);
  const wasConnected = useRef(connected);
  useEffect(() => {
    if (connected && !wasConnected.current) refreshSoon();
    wasConnected.current = connected;
  }, [connected, refreshSoon]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const data = await api(url(items.length, PAGE_SIZE));
      setItems((current) => [...current, ...data.items.filter((item) => !current.some((known) => known.id === item.id))]);
      setHasMore(data.has_more);
      apply(data);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoadingMore(false);
    }
  }

  // Changes show immediately and are rolled back by a reload if the request fails.
  function bump(item, delta) {
    setUnread((value) => Math.max(0, value + delta));
    setUnreadCount((value) => Math.max(0, (Number(value) || 0) + delta));
    setByCategory((current) => ({ ...current, [item.category]: Math.max(0, (current[item.category] || 0) + delta) }));
  }
  async function setRead(item, read) {
    if (item.read === read) return;
    setItems((current) =>
      filter === "unread" && read ? current.filter((entry) => entry.id !== item.id) : current.map((entry) => (entry.id === item.id ? { ...entry, read } : entry)),
    );
    bump(item, read ? -1 : 1);
    try {
      await api(`frontend/notifications/${item.id}`, { method: "PATCH", body: { read } });
    } catch (requestError) {
      setError(requestError.message);
      reload({ silent: true });
    }
  }
  async function remove(item) {
    setItems((current) => current.filter((entry) => entry.id !== item.id));
    if (!item.read) bump(item, -1);
    try {
      await api(`frontend/notifications/${item.id}`, { method: "DELETE" });
    } catch (requestError) {
      setError(requestError.message);
      reload({ silent: true });
    }
  }
  async function markAll() {
    try {
      await api("frontend/notifications/read-all", { method: "POST", body: category ? { category } : {} });
      await reload({ silent: true });
    } catch (requestError) {
      setError(requestError.message);
    }
  }
  async function clearRead() {
    try {
      await api("frontend/notifications", { method: "DELETE" });
      await reload({ silent: true });
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  const hasRead = items.some((item) => item.read);
  const emptyText =
    filter === "unread"
      ? "You’re all caught up. New activity will show up here."
      : category
        ? `No ${CATEGORY_LABELS[category].toLowerCase()} notifications yet.`
        : "When something happens that concerns you, like a like, a reply or a result, you’ll see it here.";

  return (
    <div className="courses-page notifications-page">
      <Heading eyebrow="STAY IN THE LOOP" title="Notifications" description={unread ? `You have ${unread} unread notification${unread === 1 ? "" : "s"}.` : "You’re all caught up."}>
        <div className="nt-head-actions">
          <button type="button" className="button secondary" onClick={markAll} disabled={!(category ? byCategory[category] : unread)}>
            <CheckCheck size={17} /> Mark all as read
          </button>
          {hasRead && (
            <button type="button" className="button secondary" onClick={clearRead}>
              <Trash2 size={17} /> Clear read
            </button>
          )}
        </div>
      </Heading>

      <div className="tabs">
        {[
          ["all", "All"],
          ["unread", unread ? `Unread (${unread > 99 ? "99+" : unread})` : "Unread"],
        ].map(([value, label]) => (
          <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>
            {label}
          </button>
        ))}
      </div>

      <div className="nt-chips" role="group" aria-label="Filter by type">
        <button type="button" className={`nt-chip${category === "" ? " on" : ""}`} onClick={() => setCategory("")} aria-pressed={category === ""}>
          Everything
        </button>
        {categories.map((key) => (
          <button key={key} type="button" className={`nt-chip${category === key ? " on" : ""}`} onClick={() => setCategory(category === key ? "" : key)} aria-pressed={category === key}>
            {CATEGORY_LABELS[key]}
            {byCategory[key] > 0 && <b>{byCategory[key]}</b>}
          </button>
        ))}
      </div>

      {error && (
        <div className="notice error" role="alert">
          {error}
          <button type="button" onClick={() => reload()}>
            Try again
          </button>
        </div>
      )}

      {loading && !items.length ? (
        <div className="loading" role="status">
          <span className="spinner" /> Loading notifications…
        </div>
      ) : items.length ? (
        <>
          <ul className="nt-list" aria-live="polite">
            {items.map((item) => (
              <NotificationRow key={item.id} item={item} onOpen={(entry) => setRead(entry, true)} onToggle={(entry) => setRead(entry, !entry.read)} onDelete={remove} />
            ))}
          </ul>
          {hasMore && (
            <div className="nt-more">
              <button type="button" className="button secondary" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </>
      ) : (
        !error && (
          <div className="empty nt-empty">
            <BellOff size={32} />
            <h3>{filter === "unread" ? "Nothing new" : "No notifications"}</h3>
            <p>{emptyText}</p>
          </div>
        )
      )}
    </div>
  );
}
