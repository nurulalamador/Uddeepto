"use client";

import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Briefcase,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Inbox,
  MessageCircle,
  Sparkles,
  Star,
  UserCheck,
  Users,
} from "lucide-react";
import { useUser } from "../shell";
import { Empty, State, UserAvatar, date, useResource } from "../ui";

const DAY = ["S", "M", "T", "W", "T", "F", "S"];
const greeting = () => {
  const hour = new Date().getHours();
  return hour < 5 ? "Working late" : hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : hour < 21 ? "Good evening" : "Good night";
};
const tone = (status) => (status === "accepted" ? "accepted" : status === "rejected" ? "rejected" : status === "shortlisted" ? "upcoming" : "judging");

function Card({ title, icon: Icon, href, linkLabel = "View all", children, className = "" }) {
  return (
    <section className={`ld-card ${className}`}>
      <header>
        <h2>
          {Icon && <Icon size={18} />} {title}
        </h2>
        {href && (
          <Link href={href}>
            {linkLabel} <ArrowRight size={14} />
          </Link>
        )}
      </header>
      {children}
    </section>
  );
}

export default function HirerDashboard() {
  const user = useUser();
  const resource = useResource("frontend/dashboard/hirer");
  return <State resource={resource}>{resource.data && <Body user={user} data={resource.data} />}</State>;
}

function Body({ user, data }) {
  const { stats } = data;
  const firstName = user.name?.split(" ")[0] || "there";
  const week = data.activity.slice(-7).reduce((sum, day) => sum + day.count, 0);
  const peak = Math.max(1, ...data.activity.map((day) => day.count));
  const pending = Math.max(0, stats.applicants - stats.shortlisted - stats.accepted - stats.rejected);
  const pipeline = [
    ["applied", "New", stats.new_applicants],
    ["shortlisted", "Shortlisted", stats.shortlisted],
    ["accepted", "Accepted", stats.accepted],
    ["rejected", "Rejected", stats.rejected],
  ];
  const total = pipeline.reduce((sum, [, , count]) => sum + count, 0) || 1;
  const tiles = [
    [Briefcase, "Open positions", stats.open_jobs, "/job-management", "green"],
    [ClipboardList, "Total job posts", stats.jobs, "/job-management", "blue"],
    [Users, "Total applicants", stats.applicants, "/job-management", "purple"],
    [Inbox, "Awaiting review", stats.new_applicants, "/job-management", "orange"],
    [Star, "Shortlisted", stats.shortlisted, "/job-management", "gold"],
    [UserCheck, "Accepted", stats.accepted, "/job-management", "teal"],
  ];

  return (
    <div className="ld">
      <section className="ld-hero hirer">
        <div className="ld-hero-text">
          <p className="ld-eyebrow">{new Intl.DateTimeFormat("en", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}</p>
          <h1>
            {greeting()}, {firstName}!
          </h1>
          <p>
            {stats.jobs === 0
              ? "Post your first job and start meeting talented people."
              : stats.new_applicants > 0
                ? `You have ${stats.new_applicants} applicant${stats.new_applicants === 1 ? "" : "s"} waiting for review${week ? ` — ${week} new in the last 7 days` : ""}.`
                : "You’re all caught up. New applications will appear here as they arrive."}
          </p>
          <div className="ld-hero-actions">
            <Link className="button light" href="/job-management">
              {stats.new_applicants ? "Review applicants" : "Manage jobs"} <ArrowUpRight size={17} />
            </Link>
            <Link className="button ghost" href="/messages">
              <MessageCircle size={17} /> Messages
            </Link>
          </div>
        </div>
        <div className="ld-hero-stats">
          <div className="ld-streak" title="Applications received in the last 7 days">
            <Sparkles size={22} />
            <strong>{week}</strong>
            <span>new this week</span>
          </div>
          <div className="ld-streak" title="Jobs currently accepting applications">
            <Briefcase size={22} />
            <strong>{stats.open_jobs}</strong>
            <span>open jobs</span>
          </div>
        </div>
      </section>

      <section className="ld-tiles" aria-label="Hiring at a glance">
        {tiles.map(([Icon, label, value, href, colour]) => (
          <Link className={`ld-tile ${colour}`} href={href} key={label}>
            <span className="ld-tile-icon">
              <Icon size={20} />
            </span>
            <strong>{value}</strong>
            <span>{label}</span>
          </Link>
        ))}
      </section>

      <div className="ld-grid">
        <div className="ld-col">
          <Card title="Applicant pipeline" icon={Users} href="/job-management" linkLabel="Open applicants">
            <div className="hd-pipeline" role="img" aria-label="Applicants by status">
              {pipeline.map(([key, label, count]) => (
                <span key={key} className={`hd-seg ${key}`} style={{ flexGrow: count }} title={`${label}: ${count}`} />
              ))}
              {stats.applicants === 0 && <span className="hd-seg empty" style={{ flexGrow: 1 }} />}
            </div>
            <ul className="hd-legend">
              {pipeline.map(([key, label, count]) => (
                <li key={key}>
                  <i className={key} /> {label} <strong>{count}</strong>
                  <small>{stats.applicants ? `${Math.round((count / total) * 100)}%` : "0%"}</small>
                </li>
              ))}
            </ul>
            {pending > 0 && <p className="ld-muted">{pending} application{pending === 1 ? "" : "s"} with another status (for example withdrawn).</p>}
          </Card>

          <Card title="Applications received" icon={Inbox}>
            <div className="ld-chart" role="img" aria-label="Applications received in the last 14 days">
              {data.activity.map((day) => (
                <div className="ld-bar" key={day.day} title={`${day.count} application${day.count === 1 ? "" : "s"} on ${day.day}`}>
                  <span className="ld-bar-fill" style={{ height: `${day.count ? Math.max(10, (day.count / peak) * 100) : 4}%` }} data-empty={day.count === 0} />
                  <small>{DAY[new Date(`${day.day}T00:00:00Z`).getUTCDay()]}</small>
                </div>
              ))}
            </div>
            <p className="ld-chart-note">
              {week} in the last 7 days · {stats.applicants} in total
            </p>
          </Card>

          <Card title="Latest applicants" icon={UserCheck} href="/job-management" linkLabel="See all">
            {data.recent.length ? (
              <ul className="ld-list">
                {data.recent.map((person) => (
                  <li key={`${person.job_id}-${person.applicant_id}`}>
                    <Link href={`/profile/${person.uddeepto_id}`}>
                      <UserAvatar id={person.applicant_id} name={person.name} hasPicture={person.has_picture} size={38} />
                      <span className="ld-row-text">
                        <strong>{person.name}</strong>
                        <small>
                          {person.job_title} · {date(person.applied_at)}
                        </small>
                      </span>
                      <span className={`submission-status ${tone(person.status)}`}>{person.status}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty title="No applicants yet" text="Applications to your jobs will appear here." />
            )}
          </Card>
        </div>

        <aside className="ld-col">
          <Card title="Your job posts" icon={Briefcase} href="/job-management">
            {data.top_jobs.length ? (
              <ul className="ld-list">
                {data.top_jobs.map((job) => (
                  <li key={job.id}>
                    <Link href={`/jobs/${job.id}`}>
                      <span className="ld-badge job">
                        <Briefcase size={16} />
                      </span>
                      <span className="ld-row-text">
                        <strong>{job.title}</strong>
                        <small>
                          {job.application_count} applicant{job.application_count === 1 ? "" : "s"}
                          {job.new_count ? ` · ${job.new_count} new` : ""}
                        </small>
                      </span>
                      <span className={`phase-pill ${job.status === "open" ? "upcoming" : "previous"}`}>{job.status}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="ld-muted">
                No job posts yet. <Link href="/job-management">Post your first job</Link>.
              </p>
            )}
          </Card>

          <Card title="Closing soon" icon={CalendarClock}>
            {data.closing.length ? (
              <ul className="ld-list">
                {data.closing.map((job) => (
                  <li key={job.id}>
                    <Link href={`/jobs/${job.id}`}>
                      <span className="ld-badge contest">
                        <CalendarClock size={16} />
                      </span>
                      <span className="ld-row-text">
                        <strong>{job.title}</strong>
                        <small>Closes {date(job.application_deadline)}</small>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="ld-muted">No job deadlines in the next 7 days.</p>
            )}
          </Card>

          <Card title="Quick actions" icon={CheckCircle2}>
            <div className="hd-actions">
              <Link href="/job-management">
                <Briefcase size={17} /> Post or manage jobs
              </Link>
              <Link href="/job-management">
                <Users size={17} /> Review applicants
              </Link>
              <Link href="/messages">
                <MessageCircle size={17} /> Open messages
              </Link>
              <Link href="/showcase">
                <Sparkles size={17} /> Browse the showcase
              </Link>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
