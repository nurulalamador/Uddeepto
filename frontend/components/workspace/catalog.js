"use client";

import { useState } from "react";
import {
  ArrowUpRight,
  BookOpen,
  CheckCircle,
  Clock,
  ExternalLink,
  Trophy,
  UserRound,
  Video,
} from "lucide-react";
import { api } from "@/lib/api";
import { safeLink } from "@/lib/roles";
import {
  Action,
  Badge,
  Empty,
  Heading,
  Modal,
  Pager,
  SearchBox,
  State,
  date,
  money,
  useResource,
} from "../ui";

export default function Catalog({ kind }) {
  const course = kind === "courses";
  const Icon = course ? BookOpen : kind === "contests" ? Trophy : Video;
  const [tab, setTab] = useState(course ? "explore" : "ongoing");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState(null);
  const categories = useResource("users/interests");
  const resource = useResource(
    `frontend/catalog/${kind}?tab=${tab}&q=${encodeURIComponent(query)}&category=${category}&offset=${page * 12}&limit=12`,
  );

  return (
    <>
      <Heading
        eyebrow={
          course
            ? "INVEST IN YOURSELF"
            : kind === "contests"
              ? "PUT YOUR SKILLS TO THE TEST"
              : "LEARN FROM NEW PERSPECTIVES"
        }
        title={
          course
            ? "A skill for every ambition."
            : kind === "contests"
              ? "Ready for a challenge?"
              : "Make time for a new idea."
        }
        description={
          course
            ? "Find your next course or pick up where you left off."
            : kind === "contests"
              ? "Explore challenges, join the competition and see what you can do."
              : "Live conversations and learning experiences with the community."
        }
      />

      <div className="tabs">
        {(course ? ["explore", "enrolled"] : ["ongoing", "upcoming", "previous"]).map(
          (value) => (
            <button
              key={value}
              className={tab === value ? "active" : ""}
              onClick={() => {
                setTab(value);
                setPage(0);
              }}
            >
              {value === "enrolled" ? "My learning" : value === "explore" ? "Explore courses" : value}
            </button>
          ),
        )}
      </div>

      <div className="toolbar">
        <SearchBox
          value={query}
          onChange={(value) => {
            setQuery(value);
            setPage(0);
          }}
          placeholder={`Search ${kind}…`}
        />
        <select
          aria-label="Filter interest"
          value={category}
          onChange={(event) => {
            setCategory(event.target.value);
            setPage(0);
          }}
        >
          <option value="">All interests</option>
          {categories.data?.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </div>

      <State resource={resource}>
        {resource.data?.length ? (
          <div className="grid three">
            {resource.data.map((item, index) => (
              <article className="card catalog-card" key={item.id}>
                <div className={`catalog-cover shade-${index % 4}`}>
                  <span>{item.category_name || "Uddeepto"}</span>
                  <Icon size={50} strokeWidth={1.5} />
                  <span className="cover-index">{String(index + 1).padStart(2, "0")}</span>
                </div>
                <div className="catalog-body">
                  <div className="row spread">
                    <Badge>{item.status}</Badge>
                    {item.enrolled && <CheckCircle size={18} className="green" />}
                  </div>
                  <h2>{item.title || item.name}</h2>
                  <p className="clamp">{item.description}</p>
                  {course ? (
                    <InstructorSummary item={item} compact />
                  ) : (
                    <p className="metadata">
                      <Clock size={15} />
                      {date(item.starting_time)}
                    </p>
                  )}
                  <footer>
                    <strong>
                      {course
                        ? money(item.price, item.currency)
                        : kind === "contests"
                          ? money(item.entry_fee, item.currency)
                          : "Webinar"}
                    </strong>
                    <button className="text-link" onClick={() => setSelected(item)}>
                      View details <ArrowUpRight size={17} />
                    </button>
                  </footer>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <Empty
            title={`No ${tab === "enrolled" ? "enrolled " : ""}${kind} yet`}
            text="Try another tab or interest, or come back soon."
          />
        )}
      </State>

      <Pager page={page} setPage={setPage} hasMore={resource.data?.length === 12} />
      {selected && (
        <Modal title={selected.title || selected.name} onClose={() => setSelected(null)}>
          <Detail kind={kind} item={selected} reload={resource.reload} />
        </Modal>
      )}
    </>
  );
}

function InstructorSummary({ item, compact = false }) {
  const image = item.instructor_has_image && item.instructor_id
    ? `/api/backend/frontend/instructors/${item.instructor_id}/image`
    : null;
  return (
    <div className={`course-instructor-summary${compact ? " compact" : ""}`}>
      {image ? (
        <img src={image} alt="" />
      ) : (
        <span className="course-instructor-placeholder">
          <UserRound size={compact ? 17 : 20} />
        </span>
      )}
      <div>
        <small>Course instructor</small>
        <strong>{item.instructor_name || "Instructor to be announced"}</strong>
        {!compact && item.instructor_details && <p>{item.instructor_details}</p>}
      </div>
    </div>
  );
}

function Detail({ kind, item, reload }) {
  const resource = useResource(`frontend/detail/${kind}/${item.id}`);
  const [content, setContent] = useState(null);
  const [message, setMessage] = useState("");
  const [problem, setProblem] = useState("");
  const [solution, setSolution] = useState("");

  return (
    <State resource={resource}>
      {resource.data && (
        <div className="stack">
          <div className="row">
            <Badge>{item.category_name}</Badge>
            <Badge>{item.status}</Badge>
          </div>
          {kind === "courses" && <InstructorSummary item={item} />}
          <p className="preserve">{item.description}</p>

          {kind !== "courses" && (
            <div className="detail-facts">
              <p>
                Starts <strong>{date(item.starting_time)}</strong>
              </p>
              <p>
                Ends <strong>{date(item.ending_time)}</strong>
              </p>
            </div>
          )}
          {message && <div className="notice success">{message}</div>}

          {kind === "courses" ? (
            <>
              <Action
                onClick={async () => {
                  await api(`courses/${item.id}/enroll`, { method: "POST" });
                  setMessage("You’re enrolled. Your next chapter starts now.");
                  resource.reload();
                  reload();
                }}
                disabled={resource.data.enrolled}
              >
                {resource.data.enrolled ? "Enrolled" : `Enroll · ${money(item.price, item.currency)}`}
              </Action>
              <h3>Course materials</h3>
              {resource.data.materials?.length ? (
                resource.data.materials.map((material) => (
                  <div className="material-row" key={material.id}>
                    <BookOpen size={18} />
                    <span>{material.name}</span>
                    {material.is_preview && <Badge>Preview</Badge>}
                    <Action
                      className="text-link"
                      disabled={!material.is_preview && !resource.data.enrolled}
                      onClick={async () => {
                        if (material.has_blob) {
                          window.open(
                            `/api/backend/courses/${item.id}/materials/${material.id}/content`,
                            "_blank",
                            "noopener,noreferrer",
                          );
                        } else {
                          setContent(
                            await api(`courses/${item.id}/materials/${material.id}/content`),
                          );
                        }
                      }}
                    >
                      Open
                    </Action>
                    {resource.data.enrolled && (
                      <Action
                        className="text-link"
                        onClick={async () => {
                          await api(`frontend/courses/${item.id}/complete/${material.id}`, {
                            method: "PUT",
                          });
                          resource.reload();
                        }}
                      >
                        {material.completed ? "✓ Done" : "Mark done"}
                      </Action>
                    )}
                  </div>
                ))
              ) : (
                <Empty title="Materials coming soon" />
              )}
              {content && (
                <div className="card">
                  <p className="preserve">{content.content_text}</p>
                  {safeLink(content.external_url) && (
                    <a
                      className="text-link"
                      href={safeLink(content.external_url)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open resource <ExternalLink size={16} />
                    </a>
                  )}
                </div>
              )}
            </>
          ) : kind === "webinars" ? (
            <>
              <Action
                disabled={resource.data.joined || !["scheduled", "live"].includes(item.status)}
                onClick={async () => {
                  await api(`frontend/webinars/${item.id}/join`, { method: "POST" });
                  setMessage("Your place is reserved.");
                  resource.reload();
                }}
              >
                {resource.data.joined ? "Registered" : "Reserve my place"}
              </Action>
              {resource.data.joined && safeLink(resource.data.meeting_url) && (
                <a
                  href={safeLink(resource.data.meeting_url)}
                  target="_blank"
                  rel="noreferrer"
                  className="button secondary"
                >
                  Join meeting <ExternalLink size={16} />
                </a>
              )}
            </>
          ) : (
            <>
              <Action
                disabled={resource.data.joined || item.status !== "published"}
                onClick={async () => {
                  await api(`frontend/contests/${item.id}/join`, { method: "POST" });
                  setMessage("You have joined the contest.");
                  resource.reload();
                }}
              >
                {resource.data.joined
                  ? "Joined"
                  : `Join contest · ${money(item.entry_fee, item.currency)}`}
              </Action>
              <h3>Problems</h3>
              {resource.data.problems?.map((entry) => (
                <details key={entry.id} className="card">
                  <summary>{entry.name} · {entry.points} points</summary>
                  <p className="preserve">{entry.description}</p>
                  {entry.sample_input && <pre>{entry.sample_input}</pre>}
                  {entry.sample_output && <pre>{entry.sample_output}</pre>}
                </details>
              ))}
              {resource.data.joined && (
                <>
                  <label>
                    Problem
                    <select value={problem} onChange={(event) => setProblem(event.target.value)}>
                      <option value="">General submission</option>
                      {resource.data.problems?.map((entry) => (
                        <option key={entry.id} value={entry.id}>{entry.name}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Your submission
                    <textarea
                      rows={6}
                      value={solution}
                      onChange={(event) => setSolution(event.target.value)}
                      placeholder="Write your answer or paste your code…"
                    />
                  </label>
                  <Action
                    disabled={!solution.trim()}
                    onClick={async () => {
                      await api(`frontend/contests/${item.id}/submit`, {
                        method: "POST",
                        body: { problem_id: problem || null, content: solution },
                      });
                      setMessage("Submission received.");
                      setSolution("");
                    }}
                  >
                    Submit entry
                  </Action>
                </>
              )}
              <h3>Leaderboard</h3>
              {resource.data.leaderboard?.length ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr><th>Rank</th><th>Participant</th><th>Points</th></tr>
                    </thead>
                    <tbody>
                      {resource.data.leaderboard.map((entry, index) => (
                        <tr key={entry.id}>
                          <td>{index + 1}</td><td>{entry.name}</td><td>{entry.points}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p>No scores yet.</p>
              )}
            </>
          )}
        </div>
      )}
    </State>
  );
}
