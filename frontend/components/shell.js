"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  Bell,
  Bot,
  BookOpen,
  Briefcase,
  ClipboardList,
  EllipsisVertical,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trophy,
  UserRound,
  Users,
  Video,
  X,
} from "lucide-react";
import { ThemeToggle } from "./theme";
import { UserAvatar } from "./ui";
import { api } from "@/lib/api";
import { RealtimeContext, useOnConnect, useRealtimeConnection, useSocketEvent } from "./realtime";
import GlobalSearch from "./global-search";
import InterestGate from "./interest-gate";
import { allowedCategorizedSections, canAccess, sections } from "@/lib/roles";

const UserContext = createContext(null);
const ShellActionsContext = createContext({ setDetailSubtitle: () => {}, setUnreadCount: () => {} });
export const useUser = () => useContext(UserContext);
export const useShellActions = () => useContext(ShellActionsContext);

const icons = {
  dashboard: LayoutDashboard,
  showcase: Sparkles,
  courses: BookOpen,
  contests: Trophy,
  webinars: Video,
  communities: Users,
  jobs: Briefcase,
  messages: MessageCircle,
  notifications: Bell,
  profile: UserRound,
  admin: SlidersHorizontal,
  moderation: ShieldCheck,
  settings: Settings,
  ai: Bot,
  "job-management": ClipboardList,
};

// Keeps the unread badge exact: +1 for every pushed notification, a recount after anything else.
function UnreadSync({ setUnread, loadUnread }) {
  useSocketEvent("notification", () => setUnread((value) => value + 1));
  useSocketEvent("notification:removed", () => loadUnread());
  useSocketEvent("notification:changed", () => loadUnread());
  useOnConnect(loadUnread);
  return null;
}

export default function Shell({ user, children }) {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  const path = segments[0] === "instructors" ? "courses" : segments[0];
  const isMaterial = segments[0] === "courses" && segments[2] === "materials";
  const detail =
    segments.length > 1 && path === "showcase"
      ? { back: user.role === "admin" ? "/moderation" : "/showcase", label: user.role === "admin" ? "Back to moderation" : "Back to community", title: "Community", subtitle: "Post" }
      : isMaterial
        ? { back: `/courses/${segments[1]}`, label: "Back to course", title: "Course material", subtitle: "Material" }
        : segments[0] === "jobs" && segments.length > 1
          ? { back: user.role === "hirer" ? "/job-management" : "/jobs", label: user.role === "hirer" ? "Back to job management" : "Back to jobs", title: "Job", subtitle: "Details" }
          : segments[0] === "communities" && segments.length > 1
          ? { back: "/communities", label: "Back to communities", title: "Community", subtitle: "Channels" }
          : segments[0] === "webinars" && segments.length > 1
          ? { back: "/webinars", label: "Back to webinars", title: segments[1] === "previous" ? "Webinars" : "Webinar", subtitle: segments[1] === "previous" ? "Previous webinars" : "Details" }
          : segments[0] === "contests" && segments.length > 1
          ? { back: "/contests", label: "Back to contests", title: segments[1] === "previous" ? "Contests" : "Contest", subtitle: segments[1] === "previous" ? "Previous contests" : "Details" }
          : segments[0] === "courses" && segments.length > 1
          ? { back: "/courses", label: "Back to courses", title: "Course", subtitle: "Details" }
          : segments[0] === "instructors" && segments.length > 1
            ? { back: "/courses", label: "Back to courses", title: "Instructor", subtitle: "Profile" }
            : null;
  const postDetail = Boolean(detail);
  const adminPostDetail = user.role === "admin" && path === "showcase" && postDetail;
  const [open, setOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [detailSubtitle, setDetailSubtitle] = useState("");
  const [unread, setUnread] = useState(0);
  const realtime = useRealtimeConnection();
  const profileRef = useRef(null);
  const updateDetailSubtitle = useCallback((value) => setDetailSubtitle(value || ""), []);
  const allowed = allowedCategorizedSections(user.role);
  // Learners must pick at least one interest before using the workspace (hirers and admins can skip it).
  const needsInterests = user.role === "learner" && Array.isArray(user.interests) && user.interests.length === 0;

  // The unread badge: checked on load, every 45 seconds while the tab is visible, and when the tab regains focus.
  const connectedRef = useRef(false);
  connectedRef.current = realtime.connected;
  const loadUnread = useCallback(async () => {
    try {
      const result = await api("frontend/notifications/unread-count");
      setUnread(Number(result.count) || 0);
    } catch {
      /* the badge is a convenience; ignore failures */
    }
  }, []);
  useEffect(() => {
    loadUnread();
    // The socket keeps the badge current; polling is only the fallback while it is down.
    const timer = setInterval(() => document.visibilityState === "visible" && !connectedRef.current && loadUnread(), 45000);
    const onVisible = () => document.visibilityState === "visible" && loadUnread();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [loadUnread]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/login");
  }

  useEffect(() => {
    if (!profileMenuOpen) return;
    function closeOnOutsideClick(event) {
      if (!profileRef.current?.contains(event.target)) setProfileMenuOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [profileMenuOpen]);

  return (
    <ShellActionsContext.Provider value={{ setDetailSubtitle: updateDetailSubtitle, setUnreadCount: setUnread }}>
      <RealtimeContext.Provider value={realtime}>
      <UserContext.Provider value={user}>
        <UnreadSync setUnread={setUnread} loadUnread={loadUnread} />
        <div className={`app-shell${user.role === "admin" ? " admin-shell" : ""}${postDetail ? " post-detail-shell" : ""}`}>
          {open && <button className="sidebar-overlay" aria-label="Close navigation" onClick={() => setOpen(false)} />}
          <aside className={`sidebar ${open ? "open" : ""}`}>
            <div className="brand-container">
              <div>
                <Link href="/dashboard" className="brand">
                  <span className="brand-symbol">u<span>✦</span></span>
                  uddeepto<span className="brand-dot">.</span>
                </Link>
                {user.role === "admin" && <span className="admin-brand-label">ADMIN CONSOLE</span>}
              </div>
              <button className="mobile-close icon-button" onClick={() => setOpen(false)} aria-label="Close navigation"><X /></button>
            </div>
            <div className="scroll-container">
              {allowed.map((group) => (
                <div className="nav-container" key={group.title}>
                  <p className="nav-caption">{group.title}</p>
                  <nav>
                    {group.sections.map((key) => {
                      const Icon = icons[key];
                      const active = adminPostDetail ? key === "moderation" : path === key || (user.role === "hirer" && key === "job-management" && path === "jobs");
                      return (
                        <Link onClick={() => setOpen(false)} className={active ? "active" : ""} href={`/${key}`} key={key}>
                          <Icon size={20} />
                          {sections[key]}
                          {key === "notifications" && unread > 0 && (
                            <span className="nav-badge" aria-label={`${unread} unread`}>{unread > 99 ? "99+" : unread}</span>
                          )}
                          {active && <span className="active" />}
                        </Link>
                      );
                    })}
                  </nav>
                </div>
              ))}
            </div>
            <div className="profile" ref={profileRef}>
              <div className="user">
                <UserAvatar id={user.id} name={user.name} hasPicture={user.has_picture} />
                <div className="details"><div className="name">{user.name}</div><div className="role-label">{user.role}</div></div>
                <button onClick={() => setProfileMenuOpen((value) => !value)} aria-label="Open profile menu" aria-expanded={profileMenuOpen}><EllipsisVertical size={20} /></button>
              </div>
              {profileMenuOpen && <div className="floating-menu">
                <Link className="item" href="/profile" onClick={() => setProfileMenuOpen(false)}><UserRound size={16} /> Profile</Link>
                <button type="button" className="item red" onClick={logout}><LogOut size={16} /> Sign out</button>
              </div>}
            </div>
          </aside>
          <div className="main-content">
            <header className={`topbar${postDetail ? " post-detail-topbar" : ""}`}>
              {postDetail ? <>
                <Link className="post-detail-back" href={detail.back} aria-label={detail.label}><ArrowLeft size={19} /></Link>
                <div className="post-detail-topbar-title"><strong>{detail.title}</strong><small>{detailSubtitle || detail.subtitle}</small></div>
                <div className="row"><GlobalSearch /><ThemeToggle /></div>
              </> : <>
                <div className="row">
                  <button className="icon-button mobile-menu" onClick={() => setOpen(true)} aria-label="Open navigation"><Menu />{unread > 0 && <span className="menu-dot" aria-hidden="true" />}</button>
                  <span className="title">{sections[path] || "Workspace"}</span>
                </div>
                <div className="row"><GlobalSearch /><ThemeToggle /></div>
              </>}
            </header>
            <main className="content-container">
              {canAccess(user.role, path) || adminPostDetail ? children : <div className="card">
                <h1>Access restricted</h1>
                <p>This page isn’t available for your role.</p>
                <Link className="button" href="/dashboard">Back to dashboard <ArrowUpRight size={18} /></Link>
              </div>}
            </main>
          </div>
        </div>
        {needsInterests && <InterestGate role={user.role} />}
      </UserContext.Provider>
      </RealtimeContext.Provider>
    </ShellActionsContext.Provider>
  );
}
