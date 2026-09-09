"use client";
import { createContext, useContext, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Sparkles,
  BookOpen,
  Trophy,
  Video,
  Users,
  Briefcase,
  MessageCircle,
  UserRound,
  Settings,
  LogOut,
  Menu,
  X,
  ArrowUpRight,
} from "lucide-react";
import { ThemeToggle } from "./theme";
import { allowedSections, sections, canAccess } from "@/lib/roles";
const UserContext = createContext();
export const useUser = () => useContext(UserContext);
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
  admin: Settings,
};
export default function Shell({ user, children }) {
  const path = usePathname().split("/")[1];
  const [open, setOpen] = useState(false);
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/login");
  }
  const allowed = allowedSections(user.role);
  return (
    <UserContext.Provider value={user}>
      <div className="app-shell">
        {open && (
          <button
            className="sidebar-overlay"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
          />
        )}
        <aside className={`sidebar ${open ? "open" : ""}`}>
          <Link href="/dashboard" className="brand">
            <span className="brand-symbol">
              u<span>✦</span>
            </span>
            uddeepto<span className="brand-dot">.</span>
          </Link>
          <button
            className="mobile-close icon-button"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
          >
            <X />
          </button>
          <p className="nav-caption">YOUR WORKSPACE</p>
          <nav>
            {allowed.map((key) => {
              const Icon = icons[key];
              return (
                <Link
                  onClick={() => setOpen(false)}
                  className={path === key ? "active" : ""}
                  href={`/${key}`}
                  key={key}
                >
                  <Icon size={20} />
                  {sections[key]}
                  {path === key && <span className="active-mark" />}
                </Link>
              );
            })}
          </nav>
          <div className="sidebar-bottom">
            <div className="growth-note">
              <Sparkles size={22} />
              <h4>Small steps. Big growth.</h4>
              <p>Make room for something new today.</p>
            </div>
            <button className="logout" onClick={logout}>
              <LogOut size={18} /> Sign out
            </button>
          </div>
        </aside>
        <div className="workspace">
          <header className="topbar">
            <div className="row">
              <button
                className="icon-button mobile-menu"
                onClick={() => setOpen(true)}
                aria-label="Open navigation"
              >
                <Menu />
              </button>
              <span className="breadcrumb">
                Workspace <span>/</span>{" "}
                <strong>{sections[path] || "Explore"}</strong>
              </span>
            </div>
            <div className="row">
              <ThemeToggle />
              <span className="top-divider" />
              <div className="user-summary">
                <span className="avatar">{user.name?.slice(0, 1)}</span>
                <div>
                  <strong>{user.name}</strong>
                  <small>{user.role}</small>
                </div>
              </div>
            </div>
          </header>
          <main className="workspace-main">
            {canAccess(user.role, path) ? (
              children
            ) : (
              <div className="card">
                <h1>Access restricted</h1>
                <p>This page isn’t available for your role.</p>
                <Link className="button" href="/dashboard">
                  Back to dashboard <ArrowUpRight size={18} />
                </Link>
              </div>
            )}
          </main>
        </div>
      </div>
    </UserContext.Provider>
  );
}
