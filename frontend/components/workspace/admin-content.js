"use client";
import { useState } from "react";
import { BookOpen, CirclePlay, FileText, Paperclip, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { useResource, State, Action, Empty } from "../ui";
import { formatBytes } from "./course-detail";

const materialTypes = {
  text: { label: "Text lesson", Icon: BookOpen },
  video: { label: "Video lecture", Icon: CirclePlay, accept: "video/*", hint: "MP4, WebM or MOV · up to 500 MB" },
  document: {
    label: "Document",
    Icon: FileText,
    accept: ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.odt,.odp,.ods,.rtf,.txt,.csv,.md",
    hint: "PDF, Word, PowerPoint, Excel, TXT… · up to 50 MB",
  },
  other: { label: "Other file", Icon: Paperclip, accept: undefined, hint: "Any other file (no executables) · up to 100 MB" },
};

export default function AdminContent({ table, id }) {
  const course = table === "courses";
  const kind = course ? "materials" : "problems";
  const r = useResource(`frontend/manage/${table}/${id}/${kind}`);
  const subs = useResource(!course ? `frontend/manage/contests/${id}/submissions` : null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [type, setType] = useState("text");

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = event.currentTarget;
    try {
      if (course) {
        const body = new FormData(form);
        if (type === "text") body.delete("file");
        await api(`frontend/manage/${table}/${id}/${kind}`, { method: "POST", body });
        setType("text");
      } else {
        const body = Object.fromEntries(new FormData(form));
        body.points = Number(body.points);
        await api(`frontend/manage/${table}/${id}/${kind}`, { method: "POST", body });
      }
      form.reset();
      r.reload();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <hr />
      <h2>{course ? "Course materials" : "Contest problems & judging"}</h2>
      <State resource={r}>
        {r.data?.length ? (
          course ? (
            <ul className="admin-material-list">
              {r.data.map((m) => {
                const { Icon, label } = materialTypes[m.type] || materialTypes.other;
                return (
                  <li key={m.id}>
                    <Icon size={18} />
                    <div>
                      <strong>{m.name}</strong>
                      <small>
                        {label}
                        {m.file_name ? ` · ${m.file_name}` : ""}
                        {m.file_size ? ` · ${formatBytes(m.file_size)}` : ""}
                        {m.is_preview ? " · Free preview" : ""}
                      </small>
                    </div>
                    <Action
                      className="icon-button danger"
                      aria-label={`Delete ${m.name}`}
                      title="Delete material"
                      onClick={async () => {
                        if (!window.confirm(`Delete “${m.name}”? Learners will lose access to it.`)) return;
                        await api(`frontend/manage/courses/${id}/materials/${m.id}`, { method: "DELETE" });
                        r.reload();
                      }}
                    >
                      <Trash2 size={16} />
                    </Action>
                  </li>
                );
              })}
            </ul>
          ) : (
            r.data.map((m) => (
              <details className="card" key={m.id}>
                <summary>{m.name}</summary>
                <p className="preserve">{m.description}</p>
              </details>
            ))
          )
        ) : (
          course && <Empty title="No materials yet" text="Add text lessons, videos, documents or other files below." />
        )}
      </State>

      <form className="stack" onSubmit={submit}>
        <h3>Add {course ? "a material" : "a problem"}</h3>
        {course && (
          <label>
            Type
            <select name="type" value={type} onChange={(event) => setType(event.target.value)}>
              {Object.entries(materialTypes).map(([value, { label }]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          {course ? "Title" : "Name"}
          <input name="name" required maxLength={250} />
        </label>
        {course && type !== "text" && (
          <label>
            Description (optional)
            <textarea name="description" rows={2} maxLength={2000} />
          </label>
        )}
        {course && type !== "text" ? (
          <label>
            File
            <input key={type} type="file" name="file" required accept={materialTypes[type].accept} />
            <small>{materialTypes[type].hint}</small>
          </label>
        ) : (
          <label>
            {course ? "Lesson content" : "Problem description"}
            <textarea name={course ? "content_text" : "description"} required rows={5} />
          </label>
        )}
        {course ? (
          <label>
            Access
            <select name="is_preview" defaultValue="false">
              <option value="false">Enrolled learners only</option>
              <option value="true">Free preview</option>
            </select>
          </label>
        ) : (
          <label>
            Points
            <input type="number" name="points" min="0" required defaultValue="100" />
          </label>
        )}
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        <button className="button secondary" disabled={busy}>
          {busy ? (type !== "text" && course ? "Uploading…" : "Saving…") : `Add ${course ? "material" : "problem"}`}
        </button>
      </form>

      {!course && (
        <>
          <h3>Submissions</h3>
          <State resource={subs}>
            {subs.data?.length ? (
              subs.data.map((s) => <Submission key={s.id} item={s} contestId={id} reload={subs.reload} />)
            ) : (
              <Empty title="No submissions yet" />
            )}
          </State>
        </>
      )}
    </div>
  );
}

function Submission({ item, contestId, reload }) {
  const fileUrl = `/api/backend/frontend/contests/${contestId}/submissions/${item.id}/file`;
  const [score, setScore] = useState(item.score);
  const [status, setStatus] = useState(item.status === "submitted" ? "judging" : item.status);
  return (
    <article className="card stack">
      <strong>{item.name}</strong>
      {item.has_file && item.mime_type?.startsWith("image/") && <img className="submission-image" src={fileUrl} alt={item.file_name || "Submission"} />}
      {item.has_file && item.mime_type?.startsWith("audio/") && <audio className="submission-audio" controls preload="none" src={fileUrl} />}
      {item.content && <pre>{item.content}</pre>}
      <label>
        Status
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          {["judging", "accepted", "rejected", "disqualified"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      <label>
        Score
        <input type="number" min="0" value={score} onChange={(e) => setScore(e.target.value)} />
      </label>
      <Action
        onClick={async () => {
          await api(`frontend/manage/submissions/${item.id}`, {
            method: "PATCH",
            body: { score: Number(score), status },
          });
          reload();
        }}
      >
        Save judgment
      </Action>
    </article>
  );
}
