"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  BookOpen,
  CheckCircle,
  UserRound,
} from "lucide-react";
import {
  Dropdown,
  Empty,
  Heading,
  InterestIcon,
  Pager,
  RailSection,
  SearchBox,
  State,
  money,
  useResource,
} from "../ui";
import { useUser } from "../shell";

const PAGE_SIZE = 12;

export function CategoryChips({ categories, limit }) {
  const list = categories || [];
  if (!list.length) return null;
  const shown = limit ? list.slice(0, limit) : list;
  return (
    <div className="category-chips">
      {shown.map((category) => (
        <span className="category-chip" key={category.id}>
          <InterestIcon iconName={category.icon} size={13} />
          {category.name}
        </span>
      ))}
      {shown.length < list.length && (
        <span className="category-chip more">+{list.length - shown.length}</span>
      )}
    </div>
  );
}

export function ProgressBar({ done, total }) {
  const totalCount = Number(total) || 0;
  const doneCount = Number(done) || 0;
  const percent = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;
  return (
    <div className="course-progress">
      <div className="course-progress-label">
        <strong>{percent}% complete</strong>
        <span>
          {totalCount ? `${doneCount} of ${totalCount} materials` : "No materials yet"}
        </span>
      </div>
      <div
        className="course-progress-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label="Course progress"
      >
        <span style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export function InstructorAvatar({ id, hasImage, size = 34 }) {
  return hasImage && id ? (
    <img
      className="instructor-avatar"
      style={{ width: size, height: size }}
      src={`/api/backend/frontend/instructors/${id}/image`}
      alt=""
    />
  ) : (
    <span className="instructor-avatar placeholder" style={{ width: size, height: size }}>
      <UserRound size={Math.round(size * 0.5)} />
    </span>
  );
}

function InstructorSummary({ item }) {
  return (
    <div className="course-instructor-summary compact">
      <InstructorAvatar id={item.instructor_id} hasImage={item.instructor_has_image} />
      <div>
        <small>Instructor</small>
        <strong>{item.instructor_name || "To be announced"}</strong>
      </div>
      {item.instructor_id && (
        <Link className="instructor-profile-link" href={`/instructors/${item.instructor_id}`}>
          View profile
        </Link>
      )}
    </div>
  );
}

export function CourseThumb({ item, size = 96 }) {
  return item.has_cover_image ? (
    <img
      className="course-thumb"
      style={{ width: size, height: size }}
      src={`/api/backend/frontend/course-covers/${item.id}`}
      alt=""
    />
  ) : (
    <span className="course-thumb placeholder" style={{ width: size, height: size }}>
      <BookOpen size={Math.round(size * 0.32)} strokeWidth={1.6} />
    </span>
  );
}

function RecommendedRail() {
  const resource = useResource("frontend/catalog/courses?tab=recommended&limit=12");
  const items = resource.data || [];
  if (resource.loading || resource.error || !items.length) return null;
  return (
    <RailSection id="recommended-title" title="Recommended for you" description="Courses that match your interests.">
      {items.map((item) => (
        <Link className="recommended-card" href={`/courses/${item.id}`} key={item.id}>
          <CourseThumb item={item} />
          <div className="recommended-card-body">
            <CategoryChips categories={item.category_details} limit={2} />
            <h3>{item.title}</h3>
            <span className="recommended-meta">
              <strong>{money(item.price, item.currency)}</strong>
              {item.instructor_name && <small>{item.instructor_name}</small>}
            </span>
          </div>
        </Link>
      ))}
    </RailSection>
  );
}

export default function Courses() {
  const user = useUser();
  const isLearner = user.role === "learner";
  const probe = useResource("frontend/catalog/courses?tab=enrolled&limit=1");
  const hasEnrolled = Boolean(probe.data?.length);
  const [selectedTab, setTab] = useState(null);
  const tab = selectedTab ?? (hasEnrolled ? "enrolled" : "explore");
  const tabs = hasEnrolled ? ["enrolled", "explore"] : ["explore", "enrolled"];
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("");
  const [direction, setDirection] = useState("desc");
  const [page, setPage] = useState(0);
  const categories = useResource("users/interests");
  const resource = useResource(
    probe.loading
      ? null
      : `frontend/catalog/courses?tab=${tab}&q=${encodeURIComponent(query)}&category=${category}&sort=${sort}&direction=${direction}&offset=${page * PAGE_SIZE}&limit=${PAGE_SIZE}`,
  );

  return (
    <div className="courses-page">
      {!isLearner && (
        <Heading
          eyebrow="INVEST IN YOURSELF"
          title="A skill for every ambition."
          description="Find your next course or pick up where you left off."
        />
      )}

      <RecommendedRail />

      {probe.loading ? (
        <div className="loading" role="status">
          <span className="spinner" /> Loading your courses…
        </div>
      ) : (
        <>
          <div className="courses-sticky">
          <div className="tabs">
            {tabs.map((value) => (
              <button
                key={value}
                className={tab === value ? "active" : ""}
                onClick={() => {
                  setTab(value);
                  setPage(0);
                }}
              >
                {value === "enrolled" ? "My learning" : "Explore courses"}
              </button>
            ))}
          </div>

          <div className="toolbar">
            <SearchBox
              value={query}
              onChange={(value) => {
                setQuery(value);
                setPage(0);
              }}
              placeholder="Search courses…"
            />
            <Dropdown
              ariaLabel="Filter interest"
              value={category}
              onChange={(value) => {
                setCategory(value);
                setPage(0);
              }}
              options={[
                { value: "", label: "All interests" },
                ...(categories.data || []).map((item) => ({
                  value: String(item.id),
                  label: item.name,
                  iconName: item.icon,
                })),
              ]}
              hasIcon
            />
            <Dropdown
              ariaLabel="Sort courses"
              value={sort}
              onChange={(value) => {
                setSort(value);
                setPage(0);
              }}
              options={[
                { value: "", label: "Newest first" },
                { value: "price", label: "Price" },
                { value: "materials", label: "Total materials" },
                { value: "learners", label: "Total learners" },
              ]}
            />
            <button
              type="button"
              className="sort-direction"
              disabled={!sort}
              aria-label={direction === "desc" ? "Sorted high to low. Switch to low to high" : "Sorted low to high. Switch to high to low"}
              title={direction === "desc" ? "High to low" : "Low to high"}
              onClick={() => {
                setDirection((value) => (value === "desc" ? "asc" : "desc"));
                setPage(0);
              }}
            >
              {direction === "desc" ? <ArrowDown size={18} /> : <ArrowUp size={18} />}
              <span>{direction === "desc" ? "High to low" : "Low to high"}</span>
            </button>
          </div>
          </div>

          <State resource={resource}>
            {resource.data?.length ? (
              <div className="grid three">
                {resource.data.map((item, index) => (
                  <article className="card catalog-card" key={item.id}>
                    <div
                      className={`catalog-cover shade-${index % 4}${item.has_cover_image ? " has-image" : ""}`}
                    >
                      {item.has_cover_image && (
                        <img
                          className="catalog-cover-image"
                          src={`/api/backend/frontend/course-covers/${item.id}`}
                          alt=""
                        />
                      )}
                      {!item.has_cover_image && <BookOpen size={50} strokeWidth={1.5} />}
                    </div>
                    <div className="catalog-body">
                      <div className="row spread course-card-top">
                        <CategoryChips categories={item.category_details} />
                        {item.enrolled && (
                          <CheckCircle size={18} className="green" aria-label="Enrolled" />
                        )}
                      </div>
                      <h2>{item.title}</h2>
                      <p className="clamp">{item.description}</p>
                      <InstructorSummary item={item} />
                      {item.enrolled && (
                        <ProgressBar done={item.progress_done} total={item.progress_total} />
                      )}
                      <footer>
                        <strong>{money(item.price, item.currency)}</strong>
                        <Link className="text-link" href={`/courses/${item.id}`}>
                          View details <ArrowUpRight size={17} />
                        </Link>
                      </footer>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <Empty
                title={tab === "enrolled" ? "You haven’t enrolled in a course yet" : "No courses yet"}
                text={
                  tab === "enrolled"
                    ? "Explore courses and start learning — your progress will show up here."
                    : "Try another interest, or come back soon."
                }
              />
            )}
          </State>

          <Pager page={page} setPage={setPage} hasMore={resource.data?.length === PAGE_SIZE} />
        </>
      )}
    </div>
  );
}
