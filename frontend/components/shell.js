"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  Briefcase,
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
};

export default function Shell({ user, children }) {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  const path = segments[0];
  const postDetail = path === "showcase" && segments.length > 1;
  const adminPostDetail = user.role === "admin" && postDetail;
  const [open, setOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [detailSubtitle, setDetailSubtitle] = useState("Post");
  const profileRef = useRef(null);
  const updateDetailSubtitle = useCallback((value) => setDetailSubtitle(value || "Post"), []);
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
                      const active = adminPostDetail ? key === "moderation" : path === key;
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
                <span className="avatar">{user.name?.slice(0, 1)}</span>
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
                <Link className="post-detail-back" href={adminPostDetail ? "/moderation" : "/showcase"} aria-label={adminPostDetail ? "Back to moderation" : "Back to community"}><ArrowLeft size={19} /></Link>
                <div className="post-detail-topbar-title"><strong>Community</strong><small>{detailSubtitle}</small></div>
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
