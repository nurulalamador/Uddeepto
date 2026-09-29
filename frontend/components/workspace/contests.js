"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Code,
  Mic,
  Palette,
  Ticket,
  Timer,
  Trophy,
  Users,
} from "lucide-react";
import { timeline } from "@/lib/roles";
import { useUser } from "../shell";
import {
  Dropdown,
  Empty,
  Heading,
  Pager,
  RailSection,
  SearchBox,
  money,
  useResource,
} from "../ui";
import { CategoryChips } from "./courses";

const PAGE_SIZE = 12;

export const contestTypes = {
  competitive_programming: { label: "Competitive programming", Icon: Code },
  drawing: { label: "Drawing", Icon: Palette },
  singing: { label: "Singing", Icon: Mic },
  general: { label: "General", Icon: Trophy },
};
export const typeMeta = (type) => contestTypes[type] || contestTypes.general;

export const shortDate = (value) =>
  new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));

export function dateRange(start, end) {
  return `${shortDate(start)} – ${shortDate(end)}`;
}

export function splitDuration(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

export function Countdown({ to, label, onDone, className = "" }) {
  const [now, setNow] = useState(() => Date.now());
  const remaining = new Date(to).getTime() - now;
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (remaining <= 0) onDone?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining <= 0]);
  const { days, hours, minutes, seconds } = splitDuration(remaining);
  const pad = (value) => String(value).padStart(2, "0");
  return (
    <span className={`countdown ${className}`} role="timer">
      <Timer size={15} aria-hidden="true" />
      <span className="countdown-label">{label}</span>
      <strong>
        {remaining <= 0
          ? "now"
          : `${days ? `${days}d ` : ""}${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`}
      </strong>
    </span>
  );
}

export function ContestCard({ item }) {
  const phase = timeline(item);
  const count = Number(item.participant_count);
  return (
    <Link className={`contest-card phase-${phase}`} href={`/contests/${item.id}`}>
      <div className="contest-card-top">
        <CategoryChips categories={item.category_details} limit={3} />
        <span className={`phase-pill ${phase}`}>
          {item.status === "cancelled" ? "Cancelled" : phase === "ongoing" ? "Live" : phase === "upcoming" ? "Upcoming" : "Ended"}
        </span>
      </div>
      <h3>{item.name}</h3>
      <p className="clamp">{item.description}</p>
      <ul className="contest-facts">
        <li>
          <CalendarDays size={15} /> {dateRange(item.starting_time, item.ending_time)}
        </li>
        <li>
          <Users size={15} /> {count} participant{count === 1 ? "" : "s"}
          {item.max_participants ? ` · ${item.max_participants} spots` : ""}
        </li>
        <li>
          <Ticket size={15} /> Entry fee: <strong>{money(item.entry_fee, item.currency)}</strong>
        </li>
      </ul>
      <div className="contest-card-foot">
        {phase === "ongoing" && item.status === "published" ? (
          <Countdown label="Ending in" to={item.ending_time} />
        ) : phase === "upcoming" && item.status === "published" ? (
          <Countdown label="Starting in" to={item.starting_time} />
        ) : (
          <span className="countdown ended">Ended {shortDate(item.ending_time)}</span>
        )}
        <span className="contest-card-link">
          {item.joined && <span className="joined-tag">Joined</span>}
          View <ArrowUpRight size={16} />
        </span>
      </div>
    </Link>
  );
}

export function useContestFilters(placeholder = "Search contests…") {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const categories = useResource("users/interests");
  const toolbar = (onChange) => (
    <div className="courses-sticky">
    <div className="toolbar">
      <SearchBox
        value={query}
        onChange={(value) => {
          setQuery(value);
          onChange?.();
        }}
        placeholder={placeholder}
      />
      <Dropdown
        ariaLabel="Filter interest"
        value={category}
        onChange={(value) => {
          setCategory(value);
          onChange?.();
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
    </div>
    </div>
  );
  return { query, category, toolbar };
}

export const listUrl = (tab, { query, category }, extra = "", kind = "contests") =>
  `frontend/catalog/${kind}?tab=${tab}&q=${encodeURIComponent(query)}&category=${category}${extra}`;

export function ContestRail({ id, title, description, resource, emptyTitle, emptyText, renderItem = (item) => <ContestCard item={item} key={item.id} /> }) {
  if (resource.loading && !resource.data) {
    return (
      <section className="recommended">
        <div className="recommended-head">
          <h2>{title}</h2>
        </div>
        <div className="loading" role="status">
          <span className="spinner" /> Loading contests…
        </div>
      </section>
    );
  }
  if (resource.error) {
    return (
      <section className="recommended">
        <div className="recommended-head">
          <h2>{title}</h2>
        </div>
        <div className="notice error" role="alert">
          {resource.error}
          <button onClick={resource.reload}>Try again</button>
        </div>
      </section>
    );
  }
  if (!resource.data?.length) {
    return (
      <section className="recommended">
        <div className="recommended-head">
          <div>
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </div>
        </div>
        <Empty title={emptyTitle} text={emptyText} />
      </section>
    );
  }
  return (
    <RailSection id={id} title={title} description={description}>
      {resource.data.map(renderItem)}
    </RailSection>
  );
}

export default function Contests() {
  const user = useUser();
  const filters = useContestFilters();
  const ongoing = useResource(listUrl("ongoing", filters, "&limit=20"));
  const upcoming = useResource(listUrl("upcoming", filters, "&limit=20"));

  return (
    <div className="courses-page contests-page">
      {user.role !== "learner" && (
        <Heading
          eyebrow="PUT YOUR SKILLS TO THE TEST"
          title="Ready for a challenge?"
          description="Explore challenges, join the competition and see what you can do."
        />
      )}
      {filters.toolbar()}
      <ContestRail
        id="ongoing-contests"
        title="Ongoing Contests"
        resource={ongoing}
        emptyTitle="No contests are running"
        emptyText="Check the upcoming contests below, or come back soon."
      />
      <ContestRail
        id="upcoming-contests"
        title="Upcoming Contests"
        resource={upcoming}
        emptyTitle="No upcoming contests yet"
        emptyText="New contests are added regularly."
      />
      <div className="previous-cta">
        <Link className="button secondary" href="/contests/previous">
          See Previous Contests <ArrowRight size={17} />
        </Link>
      </div>
    </div>
  );
}

export function PreviousContests() {
  const filters = useContestFilters();
  const [page, setPage] = useState(0);
  const resource = useResource(
    listUrl("previous", filters, `&offset=${page * PAGE_SIZE}&limit=${PAGE_SIZE}`),
  );
  return (
    <div className="post-detail-content wide contests-page">
      {filters.toolbar(() => setPage(0))}
      {resource.loading && !resource.data ? (
        <div className="loading" role="status">
          <span className="spinner" /> Loading contests…
        </div>
      ) : resource.error ? (
        <div className="notice error" role="alert">
          {resource.error}
          <button onClick={resource.reload}>Try again</button>
        </div>
      ) : resource.data?.length ? (
        <div className="contest-grid">
          {resource.data.map((item) => (
            <ContestCard item={item} key={item.id} />
          ))}
        </div>
      ) : (
        <Empty title="No previous contests" text="Finished contests will appear here." />
      )}
      <Pager page={page} setPage={setPage} hasMore={resource.data?.length === PAGE_SIZE} />
    </div>
  );
}
