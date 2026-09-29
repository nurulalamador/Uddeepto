"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, ExternalLink, PlayCircle, Users, Video } from "lucide-react";
import { api } from "@/lib/api";
import { safeLink } from "@/lib/roles";
import { Action, Empty, State, date, useResource } from "../ui";
import { useShellActions } from "../shell";
import { CategoryChips, InstructorAvatar } from "./courses";
import { Countdown, dateRange } from "./contests";
import { SpeakerStrip } from "./webinars";

const tabs = [
  ["details", "Details"],
  ["speakers", "Speakers"],
];

export default function WebinarDetail({ webinarId }) {
  const resource = useResource(`frontend/webinars/${webinarId}`);
  const { setDetailSubtitle } = useShellActions();
  const webinar = resource.data;
  const [tab, setTab] = useState("details");

  useEffect(() => {
    setDetailSubtitle?.(webinar?.name || "");
    return () => setDetailSubtitle?.("");
  }, [webinar?.name, setDetailSubtitle]);

  return (
    <div className="post-detail-content wide">
      {!webinar ? (
        <State resource={resource}>{null}</State>
      ) : (
        <WebinarBody webinar={webinar} tab={tab} setTab={setTab} reload={resource.reload} />
      )}
    </div>
  );
}

function WebinarBody({ webinar, tab, setTab, reload }) {
  const phase = webinar.phase;
  const cancelled = webinar.status === "cancelled";
  const full = webinar.capacity && Number(webinar.participant_count) >= webinar.capacity;
  const canRegister = !webinar.joined && phase !== "previous" && ["scheduled", "live"].includes(webinar.status) && !full;
  const meeting = safeLink(webinar.meeting_url);
  const recording = safeLink(webinar.recording_url);
  const [message, setMessage] = useState("");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);
  const opensAt = new Date(webinar.starting_time).getTime() - 15 * 60 * 1000;
  const meetingOpen = phase === "ongoing" || (phase === "upcoming" && now >= opensAt);

  return (
    <>
      <header className="contest-hero type-webinar">
        <div className="contest-hero-main">
          <div className="contest-hero-badges">
            <span className="contest-type light">
              <Video size={15} /> Webinar
            </span>
            <span className={`phase-pill ${phase}`}>
              {cancelled ? "Cancelled" : phase === "ongoing" ? "Live now" : phase === "upcoming" ? "Upcoming" : "Ended"}
            </span>
          </div>
          <h1>{webinar.name}</h1>
          <CategoryChips categories={webinar.category_details} />
          <p className="contest-hero-lede clamp-3">{webinar.description}</p>
          <SpeakerStrip speakers={webinar.speakers} size={38} limit={4} />
          <div className="contest-hero-facts">
            <span>
              <CalendarDays size={16} /> {dateRange(webinar.starting_time, webinar.ending_time)}
            </span>
            <span>
              <Users size={16} /> {Number(webinar.participant_count)}
              {webinar.capacity ? ` / ${webinar.capacity}` : ""} registered
            </span>
          </div>
        </div>

        <div className="contest-hero-side">
          {!cancelled && phase === "ongoing" && <Countdown label="Ending in" to={webinar.ending_time} onDone={reload} className="big" />}
          {!cancelled && phase === "upcoming" && <Countdown label="Starting in" to={webinar.starting_time} onDone={reload} className="big" />}
          {(cancelled || phase === "previous") && (
            <div className="countdown big ended">{cancelled ? "This webinar was cancelled" : `Ended ${date(webinar.ending_time)}`}</div>
          )}

          {phase === "previous" ? (
            recording && !cancelled ? (
              <a className="button" href={recording} target="_blank" rel="noreferrer noopener">
                <PlayCircle size={18} /> Watch recording
              </a>
            ) : (
              !cancelled && <span className="joined-banner muted">Recording isn’t available yet</span>
            )
          ) : webinar.joined ? (
            <>
              <span className="joined-banner">✓ You’re registered</span>
              {meeting && meetingOpen ? (
                <a className="button" href={meeting} target="_blank" rel="noreferrer noopener">
                  <ExternalLink size={16} /> Join meeting
                </a>
              ) : (
                <span className="joined-banner muted">
                  {meeting ? "The meeting link opens 15 minutes before the start" : "The meeting link will be shared soon"}
                </span>
              )}
            </>
          ) : canRegister ? (
            <Action
              onClick={async () => {
                await api(`frontend/webinars/${webinar.id}/join`, { method: "POST" });
                setMessage("Your place is reserved.");
                reload();
              }}
            >
              Reserve my place
            </Action>
          ) : full ? (
            <span className="joined-banner muted">This webinar is full</span>
          ) : null}
        </div>
      </header>

      {message && <div className="notice success">{message}</div>}

      <div className="tabs contest-tabs" role="tablist">
        {tabs.map(([key, name]) => (
          <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>
            {name}
          </button>
        ))}
      </div>

      {tab === "details" && <Details webinar={webinar} />}
      {tab === "speakers" && <Speakers speakers={webinar.speakers} />}
    </>
  );
}

function Details({ webinar }) {
  const facts = [
    ["Starts", date(webinar.starting_time)],
    ["Ends", date(webinar.ending_time)],
    ["Registered", `${Number(webinar.participant_count)}${webinar.capacity ? ` of ${webinar.capacity} seats` : ""}`],
    ["Format", "Online meeting"],
    ["Organizer", webinar.creator_name],
  ];
  return (
    <div className="contest-details">
      <section className="course-section">
        <h2>About this webinar</h2>
        <p className="preserve course-about">{webinar.description}</p>
      </section>
      <section className="course-section">
        <h2>At a glance</h2>
        <dl className="contest-fact-grid">
          {facts.map(([term, value]) => (
            <div key={term}>
              <dt>{term}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}

function Speakers({ speakers }) {
  if (!speakers?.length) return <Empty title="Speakers to be announced" text="We’ll add the speaker line-up soon." />;
  return (
    <div className="speaker-grid">
      {speakers.map((speaker) => (
        <article className="card speaker-card" key={speaker.id}>
          <InstructorAvatar id={speaker.id} hasImage={speaker.has_image} size={72} />
          <div>
            <strong>{speaker.name}</strong>
            {speaker.designation && <small>{speaker.designation}</small>}
          </div>
          <Link className="button secondary" href={`/instructors/${speaker.id}`}>
            View profile
          </Link>
        </article>
      ))}
    </div>
  );
}
