"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Briefcase, Download, MapPin, MessageCircle, Plus, UserRound, Users } from "lucide-react";
import { api } from "@/lib/api";
import { Action, Badge, Dropdown, Empty, Heading, Modal, Pager, SearchBox, State, UserAvatar, date, useResource } from "../ui";
import { useUser } from "../shell";
import JobForm, { typeLabel } from "./job-form";
import { salaryLabel } from "./jobs";

const PAGE_SIZE = 12;
const STATUSES = ["applied", "shortlisted", "accepted", "rejected"];
const statusTone = (status) => (status === "accepted" ? "accepted" : status === "rejected" ? "rejected" : status === "shortlisted" ? "upcoming" : "judging");

export default function JobManagement() {
  const [tab, setTab] = useState("posts");
  const [create, setCreate] = useState(false);
  const [jobFilter, setJobFilter] = useState("");
  const posts = useResource("frontend/jobs?tab=mine&limit=100");

  return (
    <div className="courses-page">
      <Heading eyebrow="HIRING" title="Job Management" description="Post roles, follow their progress and get to know the people who apply.">
        <button className="button" onClick={() => setCreate(true)}>
          <Plus size={18} /> Post a job
        </button>
      </Heading>

      <div className="courses-sticky">
        <div className="tabs">
          {[
            ["posts", "My Job Posts"],
            ["applicants", "Applicants"],
          ].map(([value, label]) => (
            <button key={value} className={tab === value ? "active" : ""} onClick={() => setTab(value)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === "posts" ? (
        <MyPosts
          resource={posts}
          onCreate={() => setCreate(true)}
          onApplicants={(jobId) => {
            setJobFilter(jobId);
            setTab("applicants");
          }}
        />
      ) : (
        <Applicants jobs={posts.data || []} jobFilter={jobFilter} setJobFilter={setJobFilter} />
      )}

      {create && (
        <Modal title="Post an opportunity" onClose={() => setCreate(false)}>
          <JobForm
            onDone={() => {
              setCreate(false);
              posts.reload();
            }}
          />
        </Modal>
      )}
    </div>
  );
}

function MyPosts({ resource, onCreate, onApplicants }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const all = resource.data || [];
  const filtered = all.filter(
    (job) => (!status || job.status === status) && (!query || `${job.title} ${job.location || ""}`.toLowerCase().includes(query.toLowerCase())),
  );
  const shown = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <>
      <div className="toolbar jobs-toolbar">
        <SearchBox
          value={query}
          onChange={(value) => {
            setQuery(value);
            setPage(0);
          }}
          placeholder="Search your job posts…"
        />
        <Dropdown
          ariaLabel="Filter by status"
          value={status}
          onChange={(value) => {
            setStatus(value);
            setPage(0);
          }}
          options={[
            { value: "", label: "All statuses" },
            { value: "open", label: "Open" },
            { value: "closed", label: "Closed" },
            { value: "draft", label: "Draft" },
          ]}
        />
      </div>

      <State resource={resource}>
        {shown.length ? (
          <div className="jm-posts">
            {shown.map((job) => (
              <article className="card jm-post" key={job.id}>
                <div className="jm-post-main">
                  <span className="job-logo">
                    <Briefcase size={26} />
                  </span>
                  <div>
                    <div className="row">
                      <h2>{job.title}</h2>
                      <Badge>{job.status}</Badge>
                    </div>
                    <div className="row metadata">
                      <MapPin size={15} />
                      {job.is_remote ? "Remote" : job.location || "Location not specified"}
                      <span>·</span>
                      {typeLabel(job.type)}
                      <span>·</span>
                      {salaryLabel(job)}
                    </div>
                    <p className="metadata">
                      Posted {date(job.created_at)}
                      {job.application_deadline ? ` · Apply by ${date(job.application_deadline)}` : ""}
                    </p>
                  </div>
                </div>
                <div className="jm-post-side">
                  <button type="button" className="jm-count" onClick={() => onApplicants(job.id)} aria-label={`${job.application_count} applicants for ${job.title}`}>
                    <Users size={16} />
                    <strong>{job.application_count}</strong>
                    <span>applicant{job.application_count === 1 ? "" : "s"}</span>
                  </button>
                  <div className="jm-actions">
                    <Link className="button secondary" href={`/jobs/${job.id}`}>
                      View <ArrowUpRight size={15} />
                    </Link>
                    {["open", "closed"].includes(job.status) && (
                      <Action
                        className="button secondary"
                        onClick={async () => {
                          await api(`frontend/jobs/${job.id}/status`, { method: "PATCH", body: { status: job.status === "open" ? "closed" : "open" } });
                          resource.reload();
                        }}
                      >
                        {job.status === "open" ? "Close" : "Reopen"}
                      </Action>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <Empty
            title={all.length ? "No posts match your filters" : "Your next hire starts with a job post"}
            text={all.length ? "Try a different search or status." : "Post your first job and start receiving applications."}
          />
        )}
      </State>
      {!all.length && !resource.loading && (
        <div className="previous-cta">
          <button className="button" onClick={onCreate}>
            <Plus size={17} /> Post a job
          </button>
        </div>
      )}
      <Pager page={page} setPage={setPage} hasMore={filtered.length > (page + 1) * PAGE_SIZE} />
    </>
  );
}

function Applicants({ jobs, jobFilter, setJobFilter }) {
  const me = useUser();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState(null);
  const [error, setError] = useState("");
  const resource = useResource(
    `frontend/jobs/applicants?job=${jobFilter}&status=${status}&q=${encodeURIComponent(query)}&offset=${page * PAGE_SIZE}&limit=${PAGE_SIZE}`,
  );
  const reset = (setter) => (value) => {
    setter(value);
    setPage(0);
  };

  return (
    <>
      <div className="toolbar jobs-toolbar">
        <SearchBox value={query} onChange={reset(setQuery)} placeholder="Search applicants by name…" />
        <Dropdown
          ariaLabel="Filter by job post"
          value={jobFilter}
          onChange={reset(setJobFilter)}
          options={[{ value: "", label: "All job posts" }, ...jobs.map((job) => ({ value: job.id, label: `${job.title} (${job.application_count})` }))]}
        />
        <Dropdown
          ariaLabel="Filter by application status"
          value={status}
          onChange={reset(setStatus)}
          options={[{ value: "", label: "All statuses" }, ...STATUSES.map((value) => ({ value, label: value[0].toUpperCase() + value.slice(1) }))]}
        />
      </div>
      {error && <p className="notice error">{error}</p>}

      <State resource={resource}>
        {resource.data?.length ? (
          <ul className="jm-applicants">
            {resource.data.map((person) => {
              const key = `${person.job_id}-${person.applicant_id}`;
              return (
                <li className="card" key={key}>
                  <div className="jm-applicant-head">
                    <UserAvatar id={person.applicant_id} name={person.name} hasPicture={person.has_picture} size={48} />
                    <div className="jm-applicant-info">
                      <strong>{person.name}</strong>
                      <small>
                        @{person.username}
                        {person.headline ? ` · ${person.headline}` : ""}
                      </small>
                      <small>
                        Applied for <Link href={`/jobs/${person.job_id}`}>{person.job_title}</Link> · {date(person.applied_at)}
                      </small>
                    </div>
                    <span className={`submission-status ${statusTone(person.status)}`}>{person.status}</span>
                  </div>

                  {open === key && (
                    <div className="jm-applicant-body">
                      <h3>Cover letter</h3>
                      <p className="preserve">{person.cover_letter || "No cover letter."}</p>
                      {person.has_resume && (
                        <a className="text-link" href={`/api/backend/frontend/jobs/${person.job_id}/applications/${person.applicant_id}/resume`} target="_blank" rel="noreferrer">
                          <Download size={16} /> Download resume
                        </a>
                      )}
                    </div>
                  )}

                  <div className="jm-applicant-actions">
                    <button type="button" className="text-link" onClick={() => setOpen(open === key ? null : key)}>
                      {open === key ? "Hide details" : "Cover letter & resume"}
                    </button>
                    <span className="jm-spacer" />
                    <select
                      aria-label={`Status of ${person.name}`}
                      value={person.status}
                      onChange={async (event) => {
                        try {
                          await api(`frontend/jobs/${person.job_id}/applications/${person.applicant_id}`, { method: "PATCH", body: { status: event.target.value } });
                          resource.reload();
                        } catch (requestError) {
                          setError(requestError.message);
                        }
                      }}
                    >
                      {STATUSES.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                    <Link className="button secondary" href={`/profile/${person.uddeepto_id}`}>
                      <UserRound size={16} /> Profile
                    </Link>
                    {person.applicant_id !== me.id && (
                      <Link className="button" href={`/messages?with=${person.applicant_id}`}>
                        <MessageCircle size={16} /> Send message
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty title="No applicants found" text={jobFilter || status || query ? "Try changing the filters." : "Applications will appear here as people apply to your jobs."} />
        )}
      </State>
      <Pager page={page} setPage={setPage} hasMore={resource.data?.length === PAGE_SIZE} />
    </>
  );
}
