"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Github, Globe, Linkedin } from "lucide-react";
import { safeLink } from "@/lib/roles";
import { Empty, State, money, useResource } from "../ui";
import { useShellActions } from "../shell";
import { CategoryChips, CourseThumb, InstructorAvatar } from "./courses";

const socials = [
  ["linkedin", "LinkedIn", Linkedin],
  ["github", "GitHub", Github],
  ["website", "Website", Globe],
];

export default function InstructorProfile({ instructorId }) {
  const resource = useResource(`frontend/instructors/${instructorId}`);
  const instructor = resource.data;
  const { setDetailSubtitle } = useShellActions();
  useEffect(() => {
    setDetailSubtitle?.(instructor?.name || "");
    return () => setDetailSubtitle?.("");
  }, [instructor?.name, setDetailSubtitle]);
  const links = socials
    .map(([key, label, Icon]) => ({ key, label, Icon, href: safeLink(instructor?.social_links?.[key]) }))
    .filter((link) => link.href);

  return (
    <div className="post-detail-content wide">
      <State resource={resource}>
        {instructor && (
          <>
            <header className="instructor-hero">
              <InstructorAvatar id={instructor.id} hasImage={instructor.has_image} size={120} />
              <div>
                <p className="eyebrow">INSTRUCTOR</p>
                <h1>{instructor.name}</h1>
                {instructor.designation && <p className="instructor-designation">{instructor.designation}</p>}
                {links.length > 0 && (
                  <div className="instructor-links">
                    {links.map(({ key, label, Icon, href }) => (
                      <a key={key} href={href} target="_blank" rel="noreferrer noopener">
                        <Icon size={16} /> {label}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </header>

            {instructor.details && (
              <section className="course-section">
                <h2>About</h2>
                <p className="preserve course-about">{instructor.details}</p>
              </section>
            )}

            <section className="course-section">
              <div className="course-section-head">
                <h2>Courses by {instructor.name}</h2>
                <span>
                  {instructor.courses.length} course{instructor.courses.length === 1 ? "" : "s"}
                </span>
              </div>
              {instructor.courses.length ? (
                <div className="instructor-courses">
                  {instructor.courses.map((course) => (
                    <Link className="recommended-card" href={`/courses/${course.id}`} key={course.id}>
                      <CourseThumb item={course} />
                      <div className="recommended-card-body">
                        <CategoryChips categories={course.category_details} limit={2} />
                        <h3>{course.title}</h3>
                        <span className="recommended-meta">
                          <strong>{money(course.price, course.currency)}</strong>
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <Empty title="No published courses yet" text="Courses assigned to this instructor will appear here." />
              )}
            </section>
          </>
        )}
      </State>
    </div>
  );
}
