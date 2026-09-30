"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpRight, Briefcase, LayoutGrid, Map as MapIcon, MapPin, Navigation, Plus } from "lucide-react";
import { useUser } from "../shell";
import { Badge, Dropdown, Empty, Heading, Modal, Pager, SearchBox, State, money, useResource } from "../ui";
import { CategoryChips } from "./courses";
import JobForm, { JOB_TYPES, typeLabel } from "./job-form";
import { JobsMap } from "./job-map";

const PAGE_SIZE = 12;
export function salaryLabel(job) {
  if (job.salary_min && job.salary_max) return `${money(job.salary_min, job.currency)} – ${money(job.salary_max, job.currency)}`;
  if (job.salary_min) return `From ${money(job.salary_min, job.currency)}`;
  if (job.salary_max) return `Up to ${money(job.salary_max, job.currency)}`;
  return "Salary negotiable";
}

function JobCard({ job, user }) {
  return (
    <article className="card job-card">
      <span className="job-logo">
        <Briefcase size={28} />
      </span>
      <div>
        <div className="row">
          <h2>{job.title}</h2>
          <Badge>{job.application_status || job.status}</Badge>
        </div>
        <p>{job.creator_name}</p>
        <CategoryChips categories={job.category_details} limit={2} />
        <div className="row metadata">
          <MapPin size={15} />
          {job.is_remote ? "Remote" : job.location || "Location not specified"}
          <span>·</span>
          {typeLabel(job.type)}
        </div>
      </div>
      <div className="job-end">
        <strong>{salaryLabel(job)}</strong>
        <Link className="text-link" href={`/jobs/${job.id}`}>
          {job.creator_id === user.id ? "Manage applications" : "View opportunity"} <ArrowUpRight size={17} />
        </Link>
      </div>
    </article>
  );
}

function usePosition() {
  const [status, setStatus] = useState("idle");
  const [position, setPosition] = useState(null);
  const locate = () => {
    if (!navigator.geolocation) {
      setStatus("unavailable");
      return;
    }
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (result) => {
        setPosition({ lat: Number(result.coords.latitude.toFixed(5)), lng: Number(result.coords.longitude.toFixed(5)) });
        setStatus("ready");
      },
      () => setStatus("denied"),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };
  useEffect(() => {
    locate();
    // Ask once when the map view opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { status, position, locate };
}

function ViewToggle({ cards, setView, floating = false }) {
  return (
    <div className={`segmented${floating ? " floating" : ""}`} role="group" aria-label="Job view">
      <button type="button" className={cards ? "active" : ""} aria-pressed={cards} onClick={() => setView("cards")}>
        <LayoutGrid size={16} /> Cards
      </button>
      <button type="button" className={!cards ? "active" : ""} aria-pressed={!cards} onClick={() => setView("map")}>
        <MapIcon size={16} /> Map
      </button>
    </div>
  );
}

/** Full-size map: just the map, with floating controls on top of it. */
function MapView({ filters, setView }) {
  const router = useRouter();
  const { status, position, locate } = usePosition();
  const waiting = status === "locating" || status === "idle";
  const geo = position ? `&lat=${position.lat}&lng=${position.lng}` : "";
  const resource = useResource(waiting ? null : `frontend/jobs?${filters}&map=1&limit=200${geo}`);
  const jobs = resource.data || [];
  const rawNotice =
    status === "denied"
      ? "Location access is blocked. Showing Dhaka — allow location access, then tap “Use my location”."
      : status === "unavailable"
        ? "Your browser can’t share your location. Showing Dhaka."
        : resource.error
          ? resource.error
          : !waiting && !resource.loading && !jobs.length
            ? "No jobs with a map position match your filters."
            : "";
  const [visibleNotice, setVisibleNotice] = useState("");
  const shown = useRef(new Set());
  useEffect(() => {
    if (!rawNotice || waiting || resource.loading || shown.current.has(rawNotice)) return;
    shown.current.add(rawNotice);
    setVisibleNotice(rawNotice);
    const timer = setTimeout(() => setVisibleNotice(""), 5000);
    return () => clearTimeout(timer);
  }, [rawNotice, waiting, resource.loading]);

  return (
    <div className="jobs-map-stage">
      <JobsMap jobs={jobs} userPosition={position} onOpen={(job) => router.push(`/jobs/${job.id}`)} />
      <button type="button" className="map-fab" onClick={locate} disabled={status === "locating"} aria-label="Use my location">
        <Navigation size={18} /> {status === "locating" ? "Locating…" : "Use my location"}
      </button>
      {(waiting || resource.loading) && (
        <div className="map-toast" role="status">
          <span className="spinner" /> {waiting ? "Getting your location…" : "Finding jobs…"}
        </div>
      )}
      {visibleNotice && !waiting && !resource.loading && (
        <div className="map-toast" role="status">
          {visibleNotice}
          <button type="button" className="map-toast-close" aria-label="Dismiss" onClick={() => setVisibleNotice("")}>
            ×
          </button>
        </div>
      )}
      <ViewToggle cards={false} setView={setView} floating />
    </div>
  );
}

const SORTS = [
  { value: "", label: "Newest first" },
  { value: "salary", label: "Salary" },
  { value: "deadline", label: "Application deadline" },
];

export default function Jobs() {
  const user = useUser();
  const isLearner = user.role === "learner";
  const hirer = ["hirer", "admin"].includes(user.role);
  const [tab, setTab] = useState(hirer ? "mine" : "explore");
  const [view, setView] = useState("cards");
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("");
  const [direction, setDirection] = useState("desc");
  const [page, setPage] = useState(0);
  const [create, setCreate] = useState(false);
  const categories = useResource("users/interests");
  const canMap = tab !== "applied";
  const cards = view === "cards" || !canMap;
  const filters = `tab=${tab}&q=${encodeURIComponent(query)}&type=${type}&category=${category}&sort=${sort}&direction=${direction}`;
  const resource = useResource(cards ? `frontend/jobs?${filters}&offset=${page * PAGE_SIZE}&limit=${PAGE_SIZE}` : null);
  const reset = (setter) => (value) => {
    setter(value);
    setPage(0);
  };

  return (
    <div className={`courses-page jobs-page${cards ? "" : " map-mode"}`}>
      {!isLearner && (
        <Heading
          eyebrow="YOUR NEXT OPPORTUNITY"
          title={hirer ? "Great teams start here." : "Make your next move."}
          description={hirer ? "Create opportunities and discover the people behind the applications." : "Find a role that puts your skills to work."}
        >
          {hirer && (
            <button className="button" onClick={() => setCreate(true)}>
              <Plus size={18} /> Post a job
            </button>
          )}
        </Heading>
      )}

      <div className="courses-sticky">
        <div className="tabs">
          {(hirer ? ["mine", "explore"] : ["explore", "applied"]).map((value) => (
            <button
              key={value}
              className={tab === value ? "active" : ""}
              onClick={() => {
                setTab(value);
                setPage(0);
              }}
            >
              {value === "mine" ? "My job posts" : value === "applied" ? "My applications" : "Explore jobs"}
            </button>
          ))}
        </div>
        <div className="toolbar jobs-toolbar">
          <SearchBox value={query} onChange={reset(setQuery)} placeholder="Search jobs or places…" />
          <Dropdown
            ariaLabel="Filter by job type"
            value={type}
            onChange={reset(setType)}
            options={[{ value: "", label: "All job types" }, ...JOB_TYPES.map((value) => ({ value, label: typeLabel(value) }))]}
          />
          <Dropdown
            ariaLabel="Filter by category"
            value={category}
            onChange={reset(setCategory)}
            options={[{ value: "", label: "All categories" }, ...(categories.data || []).map((item) => ({ value: String(item.id), label: item.name, iconName: item.icon }))]}
            hasIcon
          />
          <Dropdown ariaLabel="Sort jobs" value={sort} onChange={reset(setSort)} options={SORTS} />
          <button
            type="button"
            className="sort-direction"
            disabled={!sort}
            aria-label={direction === "desc" ? "Sorted high to low. Switch to low to high" : "Sorted low to high. Switch to high to low"}
            title={direction === "desc" ? "High to low" : "Low to high"}
            onClick={() => reset(setDirection)(direction === "desc" ? "asc" : "desc")}
          >
            {direction === "desc" ? <ArrowDown size={18} /> : <ArrowUp size={18} />}
            <span>{direction === "desc" ? "High to low" : "Low to high"}</span>
          </button>
          {canMap && cards && <ViewToggle cards setView={setView} />}
        </div>
      </div>

      {cards ? (
        <>
          <State resource={resource}>
            {resource.data?.length ? (
              <div className="job-list">
                {resource.data.map((job) => (
                  <JobCard job={job} user={user} key={job.id} />
                ))}
              </div>
            ) : (
              <Empty title={tab === "mine" ? "Your next hire starts with a job post" : "No matching opportunities"} text="Try a different search or check back soon." />
            )}
          </State>
          <Pager page={page} setPage={setPage} hasMore={resource.data?.length === PAGE_SIZE} />
        </>
      ) : (
        <MapView filters={filters} setView={setView} />
      )}

      {create && (
        <Modal title="Post an opportunity" onClose={() => setCreate(false)}>
          <JobForm
            onDone={() => {
              setCreate(false);
              resource.reload();
            }}
          />
        </Modal>
      )}
    </div>
  );
}
