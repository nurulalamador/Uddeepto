"use client";

import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Award,
  BookOpen,
  Briefcase,
  CalendarClock,
  Check,
  Circle,
  Flame,
  GraduationCap,
  Sparkles,
  Trophy,
  Users,
  Video,
} from "lucide-react";
import { useUser } from "../shell";
import { Empty, State, date, money, useResource } from "../ui";
import { CategoryChips, ProgressBar } from "./courses";

const DAY = ["S", "M", "T", "W", "T", "F", "S"];
const greeting = () => {
  const hour = new Date().getHours();
  return hour < 5 ? "Working late" : hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : hour < 21 ? "Good evening" : "Good night";
};

function Ring({ value, size = 92, stroke = 9 }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <svg className="ld-ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${value}% of materials completed`}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgb(255 255 255 / 22%)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#fff"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - value / 100)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fill="#fff" fontSize={size * 0.24} fontWeight="800">
        {value}%
      </text>
    </svg>
  );
}

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

const kindMeta = { webinar: { Icon: Video, label: "Webinar", href: "/webinars" }, contest: { Icon: Trophy, label: "Contest", href: "/contests" } };

function ScheduleRow({ item }) {
  const { Icon, label, href } = kindMeta[item.kind];
  const live = new Date(item.starting_time) <= new Date();
  return (
    <li>
      <Link href={`${href}/${item.id}`}>
        <span className={`ld-badge ${item.kind}`}>
          <Icon size={17} />
        </span>
        <span className="ld-row-text">
          <strong>{item.name}</strong>
          <small>
            {label} · {live ? "Live now — ends " + date(item.ending_time) : date(item.starting_time)}
          </small>
        </span>
        {live && <span className="phase-pill ongoing">Live</span>}
      </Link>
    </li>
  );
}

export default function LearnerDashboard() {
  const user = useUser();
  const resource = useResource("frontend/dashboard/learner");
  const recommended = useResource("frontend/catalog/courses?tab=recommended&limit=3");
  const data = resource.data;

  return (
    <State resource={resource}>
      {data && <Body user={user} data={data} recommended={recommended.data || []} />}
    </State>
  );
}

function Body({ user, data, recommended }) {
  const { stats } = data;
  const overall = stats.materials_total ? Math.round((stats.materials_done / stats.materials_total) * 100) : 0;
  const firstName = user.name?.split(" ")[0] || "there";
  const week = data.activity.slice(-7).reduce((sum, day) => sum + day.count, 0);
  const peak = Math.max(1, ...data.activity.map((day) => day.count));
  const tiles = [
    [BookOpen, "Courses enrolled", stats.enrolled, "/courses", "green"],
    [GraduationCap, "Courses completed", stats.completed_courses, "/courses", "blue"],
    [Trophy, "Contests joined", stats.contests_joined, "/contests", "orange"],
    [Award, "Podium finishes", stats.podiums, "/contests", "gold"],
    [Video, "Webinars booked", stats.webinars, "/webinars", "teal"],
    [Users, "Communities", stats.communities, "/communities", "purple"],
  ];

  return (
    <div className="ld">
      <section className="ld-hero">
        <div className="ld-hero-text">
          <p className="ld-eyebrow">{new Intl.DateTimeFormat("en", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}</p>
          <h1>
            {greeting()}, {firstName}!
          </h1>
          <p>
            {stats.enrolled
              ? week
                ? `You completed ${week} material${week === 1 ? "" : "s"} this week. Keep the momentum going.`
                : "Pick up where you left off — even ten minutes today makes a difference."
              : "Start your first course, join a contest or ask the AI assistant anything."}
          </p>
          <div className="ld-hero-actions">
            <Link className="button light" href={data.continue_learning[0] ? `/courses/${data.continue_learning[0].id}/materials/${data.continue_learning[0].next_material_id}` : "/courses"}>
              {data.continue_learning[0] ? "Continue learning" : "Explore courses"} <ArrowUpRight size={17} />
            </Link>
            <Link className="button ghost" href="/ai">
              <Sparkles size={17} /> Ask AI
            </Link>
          </div>
        </div>
        <div className="ld-hero-stats">
          <div className="ld-hero-ring">
            <Ring value={overall} />
            <span>
              {stats.materials_done}/{stats.materials_total} materials
            </span>
          </div>
          <div className="ld-streak" title="Days in a row you completed a learning material">
            <Flame size={22} />
            <strong>{data.streak}</strong>
            <span>day streak</span>
          </div>
        </div>
      </section>

      <section className="ld-tiles" aria-label="Your activity at a glance">
        {tiles.map(([Icon, label, value, href, tone]) => (
          <Link className={`ld-tile ${tone}`} href={href} key={label}>
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
          <Card title="Continue learning" icon={BookOpen} href="/courses">
            {data.continue_learning.length ? (
              <ul className="ld-courses">
                {data.continue_learning.map((course) => {
                  const done = course.progress_total > 0 && course.progress_done >= course.progress_total;
                  return (
                    <li key={course.id}>
                      <Link className="ld-course" href={course.next_material_id ? `/courses/${course.id}/materials/${course.next_material_id}` : `/courses/${course.id}`}>
                        {course.has_cover_image ? (
                          <img src={`/api/backend/frontend/course-covers/${course.id}`} alt="" />
                        ) : (
                          <span className="ld-course-placeholder">
                            <BookOpen size={24} />
                          </span>
                        )}
                        <span className="ld-course-body">
                          <strong>{course.title}</strong>
                          <small>{course.instructor_name || "Course"}</small>
                          <ProgressBar done={course.progress_done} total={course.progress_total} />
                        </span>
                        <span className="ld-course-go">{done ? "Review" : "Resume"}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Empty title="Your learning journey starts here" text="Enroll in a course to track your progress." />
            )}
          </Card>

          <Card title="Learning activity" icon={Flame}>
            <div className="ld-chart" role="img" aria-label="Materials completed in the last 14 days">
              {data.activity.map((day) => (
                <div className="ld-bar" key={day.day} title={`${day.count} material${day.count === 1 ? "" : "s"} on ${day.day}`}>
                  <span className="ld-bar-fill" style={{ height: `${day.count ? Math.max(10, (day.count / peak) * 100) : 4}%` }} data-empty={day.count === 0} />
                  <small>{DAY[new Date(`${day.day}T00:00:00Z`).getUTCDay()]}</small>
                </div>
              ))}
            </div>
            <p className="ld-chart-note">
              {week} material{week === 1 ? "" : "s"} completed in the last 7 days · {stats.materials_done} in total
            </p>
          </Card>

          <Card title="Recommended for you" icon={Sparkles} href="/courses" linkLabel="Browse courses">
            {recommended.length ? (
              <div className="ld-reco">
                {recommended.map((course) => (
                  <Link className="ld-reco-card" href={`/courses/${course.id}`} key={course.id}>
                    {course.has_cover_image ? <img src={`/api/backend/frontend/course-covers/${course.id}`} alt="" /> : <span className="ld-course-placeholder"><BookOpen size={26} /></span>}
                    <CategoryChips categories={course.category_details} limit={1} />
                    <strong>{course.title}</strong>
                    <small>{money(course.price, course.currency)}</small>
                  </Link>
                ))}
              </div>
            ) : (
              <Empty title="Nothing to recommend yet" text="Choose your interests in your profile to get suggestions." />
            )}
          </Card>
        </div>

        <aside className="ld-col">
          <Card title="Coming up" icon={CalendarClock}>
            {data.schedule.length ? (
              <ul className="ld-list">{data.schedule.map((item) => <ScheduleRow item={item} key={`${item.kind}-${item.id}`} />)}</ul>
            ) : (
              <p className="ld-muted">Nothing scheduled. Join a webinar or contest to see it here.</p>
            )}
            {data.discover.length > 0 && (
              <>
                <h3 className="ld-subtitle">Open for you</h3>
                <ul className="ld-list">{data.discover.map((item) => <ScheduleRow item={item} key={`d-${item.kind}-${item.id}`} />)}</ul>
              </>
            )}
          </Card>

          <Card title="Complete your profile" icon={Award} href="/profile" linkLabel="Edit profile" className="ld-profile">
            <div className="ld-profile-top">
              <strong>{data.profile.percent}%</strong>
              <div className="course-progress-track" role="progressbar" aria-valuenow={data.profile.percent} aria-valuemin={0} aria-valuemax={100}>
                <span style={{ width: `${data.profile.percent}%` }} />
              </div>
            </div>
            <ul className="ld-checklist">
              {data.profile.checklist.map((item) => (
                <li key={item.key} className={item.done ? "done" : ""}>
                  {item.done ? <Check size={15} /> : <Circle size={15} />} {item.label}
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Job applications" icon={Briefcase} href="/jobs">
            {data.applications.length ? (
              <ul className="ld-list">
                {data.applications.map((application) => (
                  <li key={application.job_id}>
                    <Link href={`/jobs/${application.job_id}`}>
                      <span className="ld-badge job">
                        <Briefcase size={16} />
                      </span>
                      <span className="ld-row-text">
                        <strong>{application.title}</strong>
                        <small>{application.company}</small>
                      </span>
                      <span className={`submission-status ${application.status === "accepted" ? "accepted" : application.status === "rejected" ? "rejected" : "judging"}`}>{application.status}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="ld-muted">
                You haven’t applied yet. <Link href="/jobs">Find opportunities near you</Link>.
              </p>
            )}
          </Card>

          <Card title="My communities" icon={Users} href="/communities">
            {data.communities.length ? (
              <ul className="ld-list">
                {data.communities.map((community) => (
                  <li key={community.id}>
                    <Link href={`/communities/${community.id}`}>
                      <span className="ld-badge community">
                        <Users size={16} />
                      </span>
                      <span className="ld-row-text">
                        <strong>{community.name}</strong>
                        <small>
                          {community.member_count} member{community.member_count === 1 ? "" : "s"}
                        </small>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="ld-muted">
                Find your people. <Link href="/communities">Explore communities</Link>.
              </p>
            )}
          </Card>

          <Link className="ld-ai" href="/ai">
            <span className="ld-ai-icon">
              <Sparkles size={22} />
            </span>
            <span>
              <strong>Stuck on something?</strong>
              <small>Ask the AI assistant — in Bangla or English.</small>
            </span>
            <ArrowUpRight size={18} />
          </Link>
        </aside>
      </div>
    </div>
  );
}
