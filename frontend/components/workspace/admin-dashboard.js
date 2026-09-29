"use client";

import Link from "next/link";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Briefcase,
  Flag,
  GraduationCap,
  ShieldCheck,
  Trophy,
  UserRound,
  Users,
  Video,
} from "lucide-react";
import { useResource, State, date } from "../ui";

const shortcuts = [
  [Users, "Manage users", "Review accounts and access", "/admin?tab=users"],
  [BookOpen, "Review courses", "Edit and publish learning content", "/courses"],
  [Flag, "Moderate reports", "Handle community reports", "/moderation"],
];

export default function AdminDashboard() {
  const resource = useResource("frontend/admin/overview");
  const stats = resource.data?.stats;
  const metrics = stats ? [
    [Users, "Total users", stats.total_users, "accounts", "green"],
    [GraduationCap, "Learners", stats.learners, "learning accounts", "orange"],
    [Briefcase, "Hirers", stats.hirers, "employer accounts", "blue"],
    [BookOpen, "Courses", stats.courses, `${stats.published_courses} published`, "green"],
    [Trophy, "Contests", stats.contests, `${stats.published_contests} published`, "orange"],
    [Video, "Live & upcoming", stats.active_webinars, `of ${stats.webinars} webinars`, "blue"],
    [Briefcase, "Open jobs", stats.open_jobs, `of ${stats.jobs} job posts`, "green"],
    [Flag, "Open reports", stats.open_reports, "need review", "red"],
  ] : [];
  const contentBars = stats ? [
    ["Courses published", Number(stats.published_courses), Number(stats.courses)],
    ["Contests published", Number(stats.published_contests), Number(stats.contests)],
    ["Active webinars", Number(stats.active_webinars), Number(stats.webinars)],
    ["Open jobs", Number(stats.open_jobs), Number(stats.jobs)],
  ] : [];

  return <div className="admin-dashboard">
    <header className="admin-page-heading"><div><p className="eyebrow">ADMIN CONSOLE</p><h1>Platform overview</h1></div><span className="admin-live-pill"><ShieldCheck size={16} /> Admin workspace</span></header>
    <State resource={resource}>
      {stats && <>
        <section className="admin-kpi-grid" aria-label="Platform statistics">
          {metrics.map(([Icon, label, value, note, shade]) => <article className="admin-kpi-card" key={label}>
            <span className={`admin-kpi-icon ${shade}`}><Icon size={19} /></span><span className="admin-kpi-label">{label}</span><strong>{Number(value).toLocaleString()}</strong><small>{note}</small>
          </article>)}
        </section>
        <div className="admin-dashboard-grid">
          <section className="card admin-panel admin-content-health">
            <div className="admin-panel-heading"><div><span className="admin-panel-icon"><Activity size={18} /></span><h2>Content health</h2></div><Link href="/courses" className="admin-text-link">Manage content <ArrowRight size={15} /></Link></div>
            <div className="admin-bars">{contentBars.map(([label, active, total]) => <div className="admin-bar-row" key={label}><div className="admin-bar-label"><span>{label}</span><strong>{active}<small> / {total}</small></strong></div><div className="admin-bar-track"><span style={{ width: `${total ? Math.min(100, active / total * 100) : 0}%` }} /></div></div>)}</div>
            <div className="admin-panel-footnote">{Number(stats.draft_courses)} course{Number(stats.draft_courses) === 1 ? " is" : "s are"} still in draft.</div>
          </section>
          <section className="card admin-panel admin-shortcuts">
            <div className="admin-panel-heading"><div><span className="admin-panel-icon orange"><ArrowUpRight size={18} /></span><h2>Quick actions</h2></div></div>
            <div className="admin-shortcut-list">{shortcuts.map(([Icon, title, description, href]) => <Link href={href} className="admin-shortcut" key={title}><span><Icon size={18} /></span><div><strong>{title}</strong><small>{description}</small></div><ArrowRight size={16} /></Link>)}</div>
          </section>
          <section className="card admin-panel admin-activity-panel">
            <div className="admin-panel-heading"><div><span className="admin-panel-icon orange"><Activity size={18} /></span><h2>Recent activity</h2></div><span className="admin-muted">Latest 12 events</span></div>
            {resource.data.activity?.length ? <ol className="admin-activity-list">{resource.data.activity.map((item) => <li key={`${item.kind}-${item.id}`}><span className={`activity-dot ${item.kind}`} /><div><strong>{item.title}</strong><small>{item.detail || "—"}</small></div><time dateTime={item.occurred_at}>{date(item.occurred_at)}</time></li>)}</ol> : <div className="admin-empty-inline"><Activity size={20} /><span>Activity will appear here as the platform grows.</span></div>}
          </section>
          <aside className="admin-security-note"><ShieldCheck size={20} /><div><strong>Admin access is isolated</strong><span>Only management, moderation and admin preferences are available in this workspace.</span></div><UserRound size={18} /></aside>
        </div>
      </>}
    </State>
  </div>;
}
