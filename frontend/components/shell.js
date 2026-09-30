"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
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
import { allowedCategorizedSections, canAccess, sections } from "@/lib/roles";

const UserContext = createContext(null);
const ShellActionsContext = createContext({ setDetailSubtitle: () => {} });
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
  profile: UserRound,
  admin: SlidersHorizontal,
  moderation: ShieldCheck,
  settings: Settings,
  ai: Bot,
  "job-management": ClipboardList,
};

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
  const profileRef = useRef(null);
  const updateDetailSubtitle = useCallback((value) => setDetailSubtitle(value || ""), []);
  const allowed = allowedCategorizedSections(user.role);

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
    <ShellActionsContext.Provider value={{ setDetailSubtitle: updateDetailSubtitle }}>
      <UserContext.Provider value={user}>
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
                <div className="row"><ThemeToggle /></div>
              </> : <>
                <div className="row">
                  <button className="icon-button mobile-menu" onClick={() => setOpen(true)} aria-label="Open navigation"><Menu /></button>
                  <span className="title">{sections[path] || "Workspace"}</span>
                </div>
                <div className="row"><ThemeToggle /></div>
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
      </UserContext.Provider>
    </ShellActionsContext.Provider>
  );
}
