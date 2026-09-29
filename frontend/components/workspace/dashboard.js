"use client";
import Link from "next/link";
import {
  ArrowUpRight,
  BookOpen,
  Trophy,
  Users,
  Briefcase,
  ArrowRight,
  Video,
} from "lucide-react";
import { useUser } from "../shell";
import { useResource, State, Heading, Empty, Badge, date } from "../ui";
export default function Dashboard() {
  const user = useUser(),
    r = useResource("frontend/dashboard");
  const learner = user.role !== "hirer";
  return (
    <>
      {!learner && (
        <Heading
          eyebrow="LET’S MAKE TODAY COUNT"
          title={`Hello, ${user.name?.split(" ")[0]}.`}
          description="Find the people who will help your next idea grow."
        />
      )}
      <State resource={r}>
        {r.data && (
          <>
            <section className="stats-grid">
              {(learner
                ? [
                    [
                      BookOpen,
                      "Enrolled courses",
                      r.data.enrollments,
                      "courses",
                    ],
                    [Trophy, "Contests joined", r.data.contests, "contests"],
                    [
                      Users,
                      "Your communities",
                      r.data.communities,
                      "communities",
                    ],
                    [
                      Briefcase,
                      "Applications sent",
                      r.data.applications,
                      "jobs",
                    ],
                  ]
                : [
                    [Briefcase, "Your job posts", r.data.jobs, "jobs"],
                    [
                      Users,
                      "Applications received",
                      r.data.applications,
                      "jobs",
                    ],
                    [BookOpen, "Open positions", r.data.open_jobs, "jobs"],
                    [Trophy, "Showcase posts", r.data.posts, "showcase"],
                  ]
              ).map(([Icon, label, value, path], i) => (
                <Link href={`/${path}`} className="stat-card" key={label}>
                  <div className={`stat-icon shade-${i}`}>
                    <Icon size={23} />
                  </div>
                  <span className="stat-value">{value || 0}</span>
                  <span>{label}</span>
                  <ArrowUpRight className="stat-arrow" size={18} />
                </Link>
              ))}
            </section>
            <div className="dashboard-columns">
              <section>
                <div className="feature-banner">
                  <div>
                    <p className="eyebrow">
                      {learner
                        ? "KEEP YOUR CURIOSITY ALIVE"
                        : "YOUR NEXT GREAT HIRE"}
                    </p>
                    <h2>
                      {learner
                        ? "What will you learn next?"
                        : "Talent is closer than you think."}
                    </h2>
                    <p>
                      {learner
                        ? "Discover a course that takes your skills one step further."
                        : "Post a role and connect with people ready to make a difference."}
                    </p>
                    <Link
                      href={learner ? "/courses" : "/jobs"}
                      className="button light"
                    >
                      {learner ? "Explore courses" : "Manage jobs"}
                      <ArrowUpRight size={18} />
                    </Link>
                  </div>
                  <BookOpen className="banner-icon" size={96} />
                </div>
                <div className="section-title">
                  <h2>
                    {learner ? "Your learning journey" : "Recent applications"}
                  </h2>
                  <Link href={learner ? "/courses" : "/jobs"}>
                    View all <ArrowRight size={16} />
                  </Link>
                </div>
                <div className="card list-card">
                  {r.data.recent?.length ? (
                    r.data.recent.map((item, i) => (
                      <Link
                        className="list-row"
                        href={learner ? "/courses" : "/jobs"}
                        key={i}
                      >
                        <span className="tile-icon">
                          <BookOpen size={20} />
                        </span>
                        <div>
                          <h3>{item.title || item.name}</h3>
                          <p>{item.status || "Continue exploring"}</p>
                        </div>
                        <ArrowUpRight size={19} />
                      </Link>
                    ))
                  ) : (
                    <Empty
                      title={
                        learner
                          ? "Your journey starts here"
                          : "No applications yet"
                      }
                      text={
                        learner
                          ? "Enroll in your first course to see it here."
                          : "Applications to your jobs will appear here."
                      }
                    />
                  )}
                </div>
              </section>
              <aside>
                <div className="section-title">
                  <h2>{learner ? "On the horizon" : "Build your presence"}</h2>
                </div>
                <div className="card">
                  {learner ? (
                    r.data.upcoming?.length ? (
                      r.data.upcoming.map((item) => (
                        <div className="upcoming-item" key={item.id}>
                          <span className="tile-icon">
                            <Video size={20} />
                          </span>
                          <Badge>{item.status}</Badge>
                          <h3>{item.name}</h3>
                          <p>{date(item.starting_time)}</p>
                          <Link className="text-link" href="/webinars">
                            View webinar <ArrowRight size={16} />
                          </Link>
                        </div>
                      ))
                    ) : (
                      <Empty
                        title="No upcoming webinars"
                        text="New learning opportunities will appear here."
                      />
                    )
                  ) : (
                    <>
                      <h3>Meet the makers</h3>
                      <p>Discover what the Uddeepto community is creating.</p>
                      <Link className="text-link" href="/showcase">
                        Explore Showcase <ArrowRight size={16} />
                      </Link>
                    </>
                  )}
                </div>
                <div className="community-prompt">
                  <Users />
                  <h3>Progress loves company.</h3>
                  <p>
                    Share your work, exchange ideas and celebrate each other.
                  </p>
                  <Link href="/showcase">
                    Visit Showcase <ArrowUpRight size={17} />
                  </Link>
                </div>
              </aside>
            </div>
          </>
        )}
      </State>
    </>
  );
}
