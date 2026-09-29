"use client";

import { useEffect, useState } from "react";
import { CalendarDays, ChevronDown, Crown, ImageIcon, Music, Send, Ticket, Trophy, UserRound, Users } from "lucide-react";
import { api } from "@/lib/api";
import { Action, Badge, Empty, FileDropzone, State, date, money, useResource } from "../ui";
import { useShellActions } from "../shell";
import { CategoryChips } from "./courses";
import { Countdown, dateRange } from "./contests";

const languages = ["Python", "C++", "Java", "JavaScript", "C", "Other"];

function tabsFor(phase, hasProblems) {
  const problems = hasProblems ? [["problems", "Problems"]] : [];
  if (phase === "ongoing")
    return [["details", "Details"], ...problems, ["submission", "Submission"], ["participants", "Participants"]];
  if (phase === "previous")
    return [["details", "Details"], ...problems, ["results", "Results"], ["participants", "Participants"]];
  return [["details", "Details"], ["participants", "Participants"]];
}

export default function ContestDetail({ contestId }) {
  const resource = useResource(`frontend/contests/${contestId}`);
  const { setDetailSubtitle } = useShellActions();
  const contest = resource.data;
  const [tab, setTab] = useState("details");

  useEffect(() => {
    setDetailSubtitle?.(contest?.name || "");
    return () => setDetailSubtitle?.("");
  }, [contest?.name, setDetailSubtitle]);

  return (
    <div className="post-detail-content wide">
      {!contest ? (
        <State resource={resource}>{null}</State>
      ) : (
        <ContestBody contest={contest} tab={tab} setTab={setTab} reload={resource.reload} />
      )}
    </div>
  );
}

function ContestBody({ contest, tab, setTab, reload }) {
  const phase = contest.phase;
  const tabs = tabsFor(phase, contest.problems.length > 0);
  const activeTab = tabs.some(([key]) => key === tab) ? tab : "details";
  const [message, setMessage] = useState("");
  const full = contest.max_participants && Number(contest.participant_count) >= contest.max_participants;
  const cancelled = contest.status === "cancelled";
  const canJoin = !contest.joined && phase !== "previous" && contest.status === "published" && !full;

  return (
    <>
      <header className={`contest-hero type-${contest.type}`}>
        <div className="contest-hero-main">
          <div className="contest-hero-badges">
            <span className={`phase-pill ${phase}`}>
              {cancelled ? "Cancelled" : phase === "ongoing" ? "Live now" : phase === "upcoming" ? "Upcoming" : "Ended"}
            </span>
          </div>
          <h1>{contest.name}</h1>
          <CategoryChips categories={contest.category_details} />
          <p className="contest-hero-lede clamp-3">{contest.description}</p>
          <div className="contest-hero-facts">
            <span>
              <CalendarDays size={16} /> {dateRange(contest.starting_time, contest.ending_time)}
            </span>
            <span>
              <Users size={16} /> {Number(contest.participant_count)}
              {contest.max_participants ? ` / ${contest.max_participants}` : ""} participants
            </span>
            <span>
              <Ticket size={16} /> {money(contest.entry_fee, contest.currency)}
            </span>
          </div>
        </div>
        <div className="contest-hero-side">
          {!cancelled && phase === "ongoing" && <Countdown label="Ending in" to={contest.ending_time} onDone={reload} className="big" />}
          {!cancelled && phase === "upcoming" && <Countdown label="Starting in" to={contest.starting_time} onDone={reload} className="big" />}
          {(cancelled || phase === "previous") && (
            <div className="countdown big ended">{cancelled ? "This contest was cancelled" : `Ended ${date(contest.ending_time)}`}</div>
          )}
          {contest.joined ? (
            <>
              <span className="joined-banner">✓ You’re in this contest</span>
              {phase === "ongoing" && (
                <button type="button" className="button" onClick={() => setTab("submission")}>
                  <Send size={16} /> Make a submission
                </button>
              )}
            </>
          ) : canJoin ? (
            <Action
              onClick={async () => {
                await api(`frontend/contests/${contest.id}/join`, { method: "POST" });
                setMessage("You’ve joined the contest.");
                reload();
              }}
            >
              Join contest · {money(contest.entry_fee, contest.currency)}
            </Action>
          ) : full && phase !== "previous" ? (
            <span className="joined-banner muted">This contest is full</span>
          ) : null}
        </div>
      </header>

      {message && <div className="notice success">{message}</div>}

      <div className="tabs contest-tabs" role="tablist">
        {tabs.map(([key, name]) => (
          <button
            key={key}
            role="tab"
            aria-selected={activeTab === key}
            className={activeTab === key ? "active" : ""}
            onClick={() => setTab(key)}
          >
            {name}
          </button>
        ))}
      </div>

      {activeTab === "details" && <Details contest={contest} />}
      {activeTab === "problems" && <Problems problems={contest.problems} />}
      {activeTab === "submission" && <Submission contest={contest} reload={reload} onJoined={() => setMessage("You’ve joined the contest.")} />}
      {activeTab === "results" && <Results contest={contest} />}
      {activeTab === "participants" && <Participants contest={contest} />}
    </>
  );
}

function Details({ contest }) {
  const facts = [
    ["Starts", date(contest.starting_time)],
    ["Ends", date(contest.ending_time)],
    ["Entry fee", money(contest.entry_fee, contest.currency)],
    ["Participants", `${Number(contest.participant_count)}${contest.max_participants ? ` of ${contest.max_participants}` : ""}`],
    ["Organizer", contest.creator_name],
  ];
  return (
    <div className="contest-details">
      <section className="course-section">
        <h2>About this contest</h2>
        <p className="preserve course-about">{contest.description}</p>
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

function Problems({ problems }) {
  if (!problems?.length) return <Empty title="No problems yet" text="Problems will appear here once they are published." />;
  return (
    <div className="stack">
      {problems.map((problem) => (
        <details className="card contest-problem" key={problem.id}>
          <summary>
            <strong>{problem.name}</strong>
            <span className="summary-end">
              <Badge>{Number(problem.points)} points</Badge>
              <ChevronDown className="disclosure-chevron" size={19} aria-hidden="true" />
            </span>
          </summary>
          <p className="preserve">{problem.description}</p>
          {(problem.time_limit_ms || problem.memory_limit_mb) && (
            <p className="contest-limits">
              {problem.time_limit_ms ? `Time limit ${problem.time_limit_ms} ms` : ""}
              {problem.time_limit_ms && problem.memory_limit_mb ? " · " : ""}
              {problem.memory_limit_mb ? `Memory limit ${problem.memory_limit_mb} MB` : ""}
            </p>
          )}
          {problem.sample_input && (
            <>
              <small className="contest-code-label">Sample input</small>
              <pre>{problem.sample_input}</pre>
            </>
          )}
          {problem.sample_output && (
            <>
              <small className="contest-code-label">Sample output</small>
              <pre>{problem.sample_output}</pre>
            </>
          )}
        </details>
      ))}
    </div>
  );
}

function StatusBadge({ status }) {
  return <span className={`submission-status ${status}`}>{status}</span>;
}

function SubmissionMedia({ contestId, submission }) {
  if (!submission.has_file) return null;
  const url = `/api/backend/frontend/contests/${contestId}/submissions/${submission.id}/file`;
  if (submission.mime_type?.startsWith("audio/")) return <audio className="submission-audio" controls preload="none" src={url} />;
  if (submission.mime_type?.startsWith("image/"))
    return (
      <a href={url} target="_blank" rel="noreferrer">
        <img className="submission-image" src={url} alt={submission.file_name || "Submission"} loading="lazy" />
      </a>
    );
  return null;
}

function SubmissionCard({ contestId, submission }) {
  return (
    <details className="card submission-card">
      <summary>
        <span className="submission-title">
          <strong>{submission.problem_name || "Submission"}</strong>
          <small>{date(submission.submitted_at)}</small>
        </span>
        <span className="submission-meta">
          {submission.language && <Badge>{submission.language}</Badge>}
          <StatusBadge status={submission.status} />
          <strong>{Number(submission.score)} pts</strong>
          <ChevronDown className="disclosure-chevron" size={18} aria-hidden="true" />
        </span>
      </summary>
      <SubmissionMedia contestId={contestId} submission={submission} />
      {submission.content && <pre>{submission.content}</pre>}
      {submission.feedback && <p className="submission-feedback">Feedback: {submission.feedback}</p>}
    </details>
  );
}

const kindCopy = {
  code: { title: "Submit your solution", label: "Your code", placeholder: "Paste your code here…" },
  text: { title: "Submit your entry", label: "Your answer", placeholder: "Write your answer, or share a link to your work…" },
  image: { title: "Upload your entry", label: "Image", accept: "image/jpeg,image/png,image/webp,image/gif,image/avif", hint: "JPEG, PNG, WebP, GIF or AVIF · up to 10 MB", Icon: ImageIcon },
  audio: { title: "Upload your recording", label: "Audio file", accept: "audio/*", hint: "MP3, WAV, M4A or OGG · up to 50 MB", Icon: Music },
};

function Submission({ contest, reload, onJoined }) {
  const kind = contest.submission_kind || "text";
  const copy = kindCopy[kind] || kindCopy.text;
  const hasProblems = contest.problems.length > 0;
  const [problem, setProblem] = useState("");
  const [language, setLanguage] = useState("");
  const [solution, setSolution] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [message, setMessage] = useState("");
  const selectedProblem = problem || contest.problems[0]?.id || "";
  const isFile = kind === "image" || kind === "audio";

  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  if (!contest.joined)
    return (
      <div className="card stack">
        <h2>Join to submit</h2>
        <p>You need to join this contest before you can make a submission.</p>
        {contest.status === "published" && (
          <Action
            onClick={async () => {
              await api(`frontend/contests/${contest.id}/join`, { method: "POST" });
              onJoined();
              reload();
            }}
          >
            Join contest · {money(contest.entry_fee, contest.currency)}
          </Action>
        )}
      </div>
    );

  return (
    <div className="contest-submission">
      <form className="card stack" onSubmit={(event) => event.preventDefault()}>
        <h2>{copy.title}</h2>
        {message && <div className="notice success">{message}</div>}
        {(hasProblems || kind === "code") && (
          <div className="contest-form-row">
            {hasProblems && (
              <label>
                Problem
                <select value={selectedProblem} onChange={(event) => setProblem(event.target.value)}>
                  {contest.problems.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {kind === "code" && (
              <label>
                Language
                <select value={language} onChange={(event) => setLanguage(event.target.value)}>
                  <option value="">Choose a language</option>
                  {languages.map((name) => (
                    <option key={name}>{name}</option>
                  ))}
                </select>
              </label>
            )}
          </div>
        )}
        {isFile ? (
          <>
            <div className="field-block">
              <span className="field-label">{copy.label}</span>
              <FileDropzone
                accept={copy.accept}
                file={file}
                icon={copy.Icon}
                label={kind === "image" ? "Drag and drop your image" : "Drag and drop your recording"}
                hint={copy.hint}
                onFile={(chosen) => {
                  setFile(chosen);
                  setPreview(chosen ? URL.createObjectURL(chosen) : "");
                }}
              />
            </div>
            {preview && kind === "image" && <img className="submission-image" src={preview} alt="Selected upload preview" />}
            {preview && kind === "audio" && <audio className="submission-audio" controls src={preview} />}
            <label>
              Note (optional)
              <textarea rows={3} maxLength={2000} value={solution} onChange={(event) => setSolution(event.target.value)} placeholder="Tell the judges about your entry…" />
            </label>
          </>
        ) : (
          <label>
            {copy.label}
            <textarea
              className={kind === "code" ? "code-input" : undefined}
              rows={10}
              value={solution}
              onChange={(event) => setSolution(event.target.value)}
              placeholder={copy.placeholder}
            />
          </label>
        )}
        <Action
          disabled={isFile ? !file : !solution.trim()}
          onClick={async () => {
            let body;
            if (isFile) {
              body = new FormData();
              body.append("file", file);
              if (solution.trim()) body.append("content", solution.trim());
              if (selectedProblem) body.append("problem_id", selectedProblem);
            } else {
              body = { problem_id: selectedProblem || null, content: solution, language: kind === "code" && language ? language : undefined };
            }
            await api(`frontend/contests/${contest.id}/submit`, { method: "POST", body });
            setMessage("Submission received. Good luck!");
            setSolution("");
            setFile(null);
            setPreview("");
            reload();
          }}
        >
          <Send size={16} /> Submit entry
        </Action>
      </form>

      <section className="stack">
        <h2>Your submissions</h2>
        {contest.my_submissions.length ? (
          contest.my_submissions.map((submission) => (
            <SubmissionCard contestId={contest.id} submission={submission} key={submission.id} />
          ))
        ) : (
          <Empty title="No submissions yet" text="Your submissions will be listed here with their score and feedback." />
        )}
      </section>
    </div>
  );
}

function Avatar({ person }) {
  return person.has_picture ? (
    <img className="participant-avatar" src={`/api/backend/frontend/profile/${person.id}/picture`} alt="" />
  ) : (
    <span className="participant-avatar placeholder">
      <UserRound size={17} />
    </span>
  );
}

function Results({ contest }) {
  const resource = useResource(`frontend/contests/${contest.id}/participants`);
  return (
    <State resource={resource}>
      {resource.data?.length ? (
        <div className="table-wrap card">
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Participant</th>
                <th>Points</th>
              </tr>
            </thead>
            <tbody>
              {resource.data.map((person) => (
                <tr key={person.id}>
                  <td>
                    {Number(person.rank) === 1 ? <Crown size={16} className="rank-crown" /> : null} {person.rank}
                  </td>
                  <td>
                    <span className="participant-cell">
                      <Avatar person={person} /> {person.name}
                    </span>
                  </td>
                  <td>{Number(person.points)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty title="No results" text="Nobody took part in this contest." />
      )}
    </State>
  );
}

function Participants({ contest }) {
  const resource = useResource(`frontend/contests/${contest.id}/participants`);
  const [open, setOpen] = useState(null);
  const started = contest.phase !== "upcoming";
  return (
    <State resource={resource}>
      {resource.data?.length ? (
        <ul className="participant-list">
          {resource.data.map((person) => (
            <li key={person.id} className={open === person.id ? "open" : ""}>
              <div className="participant-row">
                {started && <span className="participant-rank">#{person.rank}</span>}
                <Avatar person={person} />
                <div className="participant-name">
                  <strong>{person.name}</strong>
                  <small>@{person.username}</small>
                </div>
                {started && (
                  <span className="participant-points">
                    <Trophy size={14} /> {Number(person.points)} pts
                  </span>
                )}
                {started && (
                  <button
                    type="button"
                    className="curriculum-open"
                    disabled={!Number(person.submission_count)}
                    onClick={() => setOpen(open === person.id ? null : person.id)}
                  >
                    {Number(person.submission_count)
                      ? open === person.id
                        ? "Hide submissions"
                        : `View submissions (${Number(person.submission_count)})`
                      : "No submissions"}
                  </button>
                )}
              </div>
              {open === person.id && <ParticipantSubmissions contestId={contest.id} person={person} />}
            </li>
          ))}
        </ul>
      ) : (
        <Empty
          title="No participants yet"
          text={contest.phase === "previous" ? "Nobody took part in this contest." : "Be the first to join this contest."}
        />
      )}
    </State>
  );
}

function ParticipantSubmissions({ contestId, person }) {
  const resource = useResource(`frontend/contests/${contestId}/participants/${person.id}/submissions`);
  return (
    <div className="participant-submissions">
      <State resource={resource}>
        {resource.data?.length ? (
          resource.data.map((submission) => <SubmissionCard contestId={contestId} submission={submission} key={submission.id} />)
        ) : (
          <p>No submissions from {person.name}.</p>
        )}
      </State>
    </div>
  );
}
