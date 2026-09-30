"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Briefcase, CalendarClock, Clock, Download, ExternalLink, MapPin, Wallet } from "lucide-react";
import { api } from "@/lib/api";
import { Action, Badge, Empty, FileDropzone, State, UserAvatar, date, useResource } from "../ui";
import { useShellActions } from "../shell";
import { typeLabel } from "./job-form";
import { LocationViewer } from "./job-map";
import { salaryLabel } from "./jobs";

const APPLICATION_STATUSES = ["applied", "shortlisted", "accepted", "rejected"];

export default function JobDetail({ jobId }) {
  const resource = useResource(`frontend/jobs/${jobId}`);
  const { setDetailSubtitle } = useShellActions();
  const job = resource.data;

  useEffect(() => {
    setDetailSubtitle?.(job?.title || "");
    return () => setDetailSubtitle?.("");
  }, [job?.title, setDetailSubtitle]);

  return (
    <div className="post-detail-content wide">
      {!job ? <State resource={resource}>{null}</State> : <JobBody job={job} reload={resource.reload} />}
    </div>
  );
}

function JobBody({ job, reload }) {
  const hasPosition = job.latitude != null && job.longitude != null;
  const criteria = Array.isArray(job.criteria) ? job.criteria.filter((item) => typeof item === "string" && item.trim()) : [];
  const closed = job.status !== "open";
  const expired = job.application_deadline && new Date(job.application_deadline) < new Date();

  return (
    <>
      <header className="job-hero">
        <span className="job-hero-icon">
          <Briefcase size={30} />
        </span>
        <div className="job-hero-main">
          <div className="job-hero-badges">
            <Badge>{typeLabel(job.type)}</Badge>
            <Badge>{job.is_remote ? "Remote" : "On-site"}</Badge>
            <span className={`phase-pill ${job.accepting ? "upcoming" : "previous"}`}>{job.accepting ? "Open" : closed ? job.status : "Deadline passed"}</span>
          </div>
          <h1>{job.title}</h1>
          <p className="job-hero-company">
            <UserAvatar id={job.creator_id} name={job.creator_name} hasPicture={job.creator_has_picture} size={28} />
            <Link href={`/profile/${job.creator_uddeepto_id || job.creator_id}`}>{job.creator_name}</Link>
          </p>
          <ul className="job-hero-facts">
            <li>
              <MapPin size={16} /> {job.is_remote ? "Remote" : job.location || "Location not specified"}
            </li>
            <li>
              <Wallet size={16} /> {salaryLabel(job)}
              {job.salary_period && job.salary_period !== "fixed" && (job.salary_min || job.salary_max) ? ` / ${job.salary_period.replace("ly", "")}` : ""}
            </li>
            {job.application_deadline && (
              <li>
                <CalendarClock size={16} /> Apply by {date(job.application_deadline)}
              </li>
            )}
            <li>
              <Clock size={16} /> Posted {date(job.created_at)}
            </li>
          </ul>
        </div>
      </header>

      <div className="course-layout job-layout">
        <div className="course-main">
          <section className="course-section">
            <h2>About the role</h2>
            <p className="preserve course-about">{job.description}</p>
          </section>

          {criteria.length > 0 && (
            <section className="course-section">
              <h2>Requirements</h2>
              <ul className="job-criteria">
                {criteria.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          )}

          {hasPosition && (
            <section className="course-section">
              <div className="course-section-head">
                <h2>Location</h2>
                <a
                  className="text-link"
                  href={`https://www.openstreetmap.org/?mlat=${job.latitude}&mlon=${job.longitude}#map=16/${job.latitude}/${job.longitude}`}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  Open in OpenStreetMap <ExternalLink size={14} />
                </a>
              </div>
              {job.location && <p className="job-address">{job.location}</p>}
              <LocationViewer latitude={job.latitude} longitude={job.longitude} label={job.title} />
            </section>
          )}

          {job.is_owner && <Applications job={job} reload={reload} />}
        </div>

        <aside className="course-aside">
          <div className="card course-enroll">
            {job.is_owner ? (
              <OwnerPanel job={job} reload={reload} />
            ) : (
              <ApplyPanel job={job} reload={reload} disabled={closed || expired} />
            )}
          </div>
        </aside>
      </div>
    </>
  );
}

function OwnerPanel({ job, reload }) {
  return (
    <>
      <h2 className="side-title">Manage this job</h2>
      <p className="room-muted">
        {job.application_count} application{job.application_count === 1 ? "" : "s"} received.
      </p>
      <Action
        className="button secondary"
        onClick={async () => {
          await api(`frontend/jobs/${job.id}/status`, { method: "PATCH", body: { status: job.status === "open" ? "closed" : "open" } });
          reload();
        }}
      >
        {job.status === "open" ? "Close applications" : "Reopen applications"}
      </Action>
    </>
  );
}

function ApplyPanel({ job, reload, disabled }) {
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (job.application_status)
    return (
      <>
        <h2 className="side-title">Your application</h2>
        <span className={`submission-status ${job.application_status === "accepted" ? "accepted" : job.application_status === "rejected" ? "rejected" : "judging"}`}>
          {job.application_status}
        </span>
        <p className="room-muted">Applied {date(job.applied_at)}. The hirer will update your status here.</p>
      </>
    );

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = new FormData(event.currentTarget);
      if (file) body.set("resume", file);
      await api(`jobs/${job.id}/apply`, { method: "POST", body });
      setMessage("Application sent. Good luck!");
      reload();
    } catch (requestError) {
      setError(requestError.message);
      setBusy(false);
    }
  }

  if (disabled) return <p className="room-muted">This job is no longer accepting applications.</p>;
  return (
    <form className="stack" onSubmit={submit}>
      <h2 className="side-title">Apply for this job</h2>
      <label>
        Cover letter
        <textarea name="cover_letter" required rows={5} placeholder="Why are you a good fit?" />
      </label>
      <div className="field-block">
        <span className="field-label">Resume (PDF)</span>
        <FileDropzone accept="application/pdf,.pdf" file={file} onFile={setFile} label="Drag and drop your resume" hint="PDF · up to 10 MB" />
      </div>
      {message && <p className="notice success">{message}</p>}
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      <button className="button" disabled={busy || !file || !!message}>
        {busy ? "Sending…" : "Send application"}
      </button>
    </form>
  );
}

function Applications({ job, reload }) {
  const resource = useResource(`frontend/jobs/${job.id}/applications`);
  const [error, setError] = useState("");
  return (
    <section className="course-section">
      <div className="course-section-head">
        <h2>Candidate applications</h2>
        <span>{job.application_count}</span>
      </div>
      {error && <p className="notice error">{error}</p>}
      <State resource={resource}>
        {resource.data?.length ? (
          <div className="stack">
            {resource.data.map((application) => (
              <article className="card application-card" key={application.applicant_id}>
                <Link href={`/profile/${application.applicant_id}`} className="text-link">
                  {application.name} <small>@{application.username}</small>
                </Link>
                <p className="preserve">{application.cover_letter}</p>
                {application.has_resume && (
                  <a href={`/api/backend/frontend/jobs/${job.id}/applications/${application.applicant_id}/resume`} target="_blank" rel="noreferrer" className="text-link">
                    <Download size={16} /> Download resume
                  </a>
                )}
                <label>
                  Application status
                  <select
                    value={application.status}
                    onChange={async (event) => {
                      try {
                        await api(`frontend/jobs/${job.id}/applications/${application.applicant_id}`, { method: "PATCH", body: { status: event.target.value } });
                        resource.reload();
                      } catch (requestError) {
                        setError(requestError.message);
                      }
                    }}
                  >
                    {APPLICATION_STATUSES.map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                </label>
              </article>
            ))}
          </div>
        ) : (
          <Empty title="No applicants yet" text="Applications will show up here as people apply." />
        )}
      </State>
    </section>
  );
}
