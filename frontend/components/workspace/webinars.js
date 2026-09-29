"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, CalendarDays, Users } from "lucide-react";
import { timeline } from "@/lib/roles";
import { useUser } from "../shell";
import { Empty, Heading, Pager, useResource } from "../ui";
import { CategoryChips, InstructorAvatar } from "./courses";
import { ContestRail, Countdown, dateRange, listUrl, shortDate, useContestFilters } from "./contests";

const PAGE_SIZE = 12;

export function SpeakerStrip({ speakers, size = 30, limit = 3 }) {
  const list = speakers || [];
  if (!list.length) return null;
  const shown = list.slice(0, limit);
  const extra = list.length - shown.length;
  return (
    <div className="speaker-strip">
      <span className="speaker-avatars">
        {shown.map((speaker) => (
          <InstructorAvatar key={speaker.id} id={speaker.id} hasImage={speaker.has_image} size={size} />
        ))}
      </span>
      <span className="speaker-names">
        <small>{list.length === 1 ? "Speaker" : "Speakers"}</small>
        <strong>
          {shown.map((speaker) => speaker.name).join(", ")}
          {extra > 0 ? ` +${extra} more` : ""}
        </strong>
      </span>
    </div>
  );
}

export function WebinarCard({ item }) {
  const phase = timeline(item);
  const count = Number(item.participant_count);
  const live = item.status !== "cancelled" && item.status !== "completed";
  return (
    <Link className={`contest-card webinar-card phase-${phase}`} href={`/webinars/${item.id}`}>
      <div className="contest-card-top">
        <CategoryChips categories={item.category_details} limit={3} />
        <span className={`phase-pill ${phase}`}>
          {item.status === "cancelled" ? "Cancelled" : phase === "ongoing" ? "Live" : phase === "upcoming" ? "Upcoming" : "Ended"}
        </span>
      </div>
      <h3>{item.name}</h3>
      <p className="clamp">{item.description}</p>
      <SpeakerStrip speakers={item.speakers} />
      <ul className="contest-facts">
        <li>
          <CalendarDays size={15} /> {dateRange(item.starting_time, item.ending_time)}
        </li>
        <li>
          <Users size={15} /> {count} registered
          {item.capacity ? ` · ${item.capacity} seats` : ""}
        </li>
      </ul>
      <div className="contest-card-foot">
        {phase === "ongoing" && live ? (
          <Countdown label="Ending in" to={item.ending_time} />
        ) : phase === "upcoming" && live ? (
          <Countdown label="Starting in" to={item.starting_time} />
        ) : (
          <span className="countdown ended">Ended {shortDate(item.ending_time)}</span>
        )}
        <span className="contest-card-link">
          {item.joined && <span className="joined-tag">Registered</span>}
          View <ArrowUpRight size={16} />
        </span>
      </div>
    </Link>
  );
}

const renderCard = (item) => <WebinarCard item={item} key={item.id} />;

export default function Webinars() {
  const user = useUser();
  const filters = useContestFilters("Search webinars…");
  const ongoing = useResource(listUrl("ongoing", filters, "&limit=20", "webinars"));
  const upcoming = useResource(listUrl("upcoming", filters, "&limit=20", "webinars"));

  return (
    <div className="courses-page contests-page">
      {user.role !== "learner" && (
        <Heading
          eyebrow="LEARN FROM NEW PERSPECTIVES"
          title="Make time for a new idea."
          description="Live conversations and learning experiences with the community."
        />
      )}
      {filters.toolbar()}
      <ContestRail
        id="ongoing-webinars"
        title="Ongoing Webinars"
        resource={ongoing}
        renderItem={renderCard}
        emptyTitle="No webinars are live"
        emptyText="Check the upcoming webinars below, or come back soon."
      />
      <ContestRail
        id="upcoming-webinars"
        title="Upcoming Webinars"
        resource={upcoming}
        renderItem={renderCard}
        emptyTitle="No upcoming webinars yet"
        emptyText="New webinars are added regularly."
      />
      <div className="previous-cta">
        <Link className="button secondary" href="/webinars/previous">
          See Previous Webinars <ArrowRight size={17} />
        </Link>
      </div>
    </div>
  );
}

export function PreviousWebinars() {
  const filters = useContestFilters("Search webinars…");
  const [page, setPage] = useState(0);
  const resource = useResource(listUrl("previous", filters, `&offset=${page * PAGE_SIZE}&limit=${PAGE_SIZE}`, "webinars"));
  return (
    <div className="post-detail-content wide contests-page">
      {filters.toolbar(() => setPage(0))}
      {resource.loading && !resource.data ? (
        <div className="loading" role="status">
          <span className="spinner" /> Loading webinars…
        </div>
      ) : resource.error ? (
        <div className="notice error" role="alert">
          {resource.error}
          <button onClick={resource.reload}>Try again</button>
        </div>
      ) : resource.data?.length ? (
        <div className="contest-grid">{resource.data.map(renderCard)}</div>
      ) : (
        <Empty title="No previous webinars" text="Finished webinars will appear here." />
      )}
      <Pager page={page} setPage={setPage} hasMore={resource.data?.length === PAGE_SIZE} />
    </div>
  );
}
