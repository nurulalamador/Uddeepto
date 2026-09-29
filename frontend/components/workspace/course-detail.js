"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Check,
  CircleAlert,
  CirclePlay,
  Download,
  FileText,
  Lock,
  Paperclip,
  Users,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { safeLink } from "@/lib/roles";
import { Action, Empty, State, money, useResource } from "../ui";
import { useShellActions } from "../shell";
import { CategoryChips, InstructorAvatar, ProgressBar } from "./courses";

const typeMeta = {
  video: { label: "Video lecture", verb: "Watch", Icon: CirclePlay },
  document: { label: "Document", verb: "Open", Icon: FileText },
  text: { label: "Reading", verb: "Read", Icon: BookOpen },
  other: { label: "File", verb: "Open", Icon: Paperclip },
};
const metaFor = (type) => typeMeta[type] || typeMeta.other;
export const materialIcon = (type) => metaFor(type).Icon;

export function formatBytes(value) {
  const bytes = Number(value);
  if (!bytes) return "";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const size = bytes / 1024 ** index;
  return `${size >= 10 || index === 0 ? Math.round(size) : size.toFixed(1)} ${units[index]}`;
}

export default function CourseDetail({ courseId }) {
  const resource = useResource(`frontend/courses/${courseId}`);
  const course = resource.data;
  const { setDetailSubtitle } = useShellActions();
  useEffect(() => {
    setDetailSubtitle?.(course?.title || "");
    return () => setDetailSubtitle?.("");
  }, [course?.title, setDetailSubtitle]);
  const [message, setMessage] = useState("");

  return (
    <div className="post-detail-content wide">
      {!course ? (
        <State resource={resource}>{null}</State>
      ) : (
        <CourseBody
          course={course}
          message={message}
          setMessage={setMessage}
          reload={resource.reload}
        />
      )}
    </div>
  );
}

function CourseBody({ course, message, setMessage, reload }) {
  const materials = course.materials || [];
  const counts = materials.reduce((all, item) => ({ ...all, [item.type]: (all[item.type] || 0) + 1 }), {});
  const summary = Object.entries(counts)
    .map(([type, count]) => `${count} ${metaFor(type).label.toLowerCase()}${count === 1 ? "" : "s"}`)
    .join(" · ");
  const canOpen = (material) => course.enrolled || material.is_preview;

  return (
    <>
      <header className="course-hero">
        <div className="course-hero-text">
          <CategoryChips categories={course.category_details} />
          <h1>{course.title}</h1>
          <p className="course-hero-lede clamp-3">{course.description}</p>
          <div className="course-hero-facts">
            <span>
              <Users size={16} /> {Number(course.enrollment_count)} learner
              {Number(course.enrollment_count) === 1 ? "" : "s"}
            </span>
            <span>
              <BookOpen size={16} /> {materials.length} material{materials.length === 1 ? "" : "s"}
            </span>
          </div>
          {course.instructor_id && (
            <Link className="course-hero-instructor" href={`/instructors/${course.instructor_id}`}>
              <InstructorAvatar id={course.instructor_id} hasImage={course.instructor_has_image} size={38} />
              <span>
                <small>Taught by</small>
                <strong>{course.instructor_name}</strong>
              </span>
            </Link>
          )}
        </div>
        <div className="course-hero-media">
          {course.has_cover_image ? (
            <img src={`/api/backend/frontend/course-covers/${course.id}`} alt="" />
          ) : (
            <div className="course-hero-placeholder">
              <BookOpen size={64} strokeWidth={1.3} />
            </div>
          )}
        </div>
      </header>

      <div className="course-layout">
        <div className="course-main">
          {message && <div className="notice success">{message}</div>}

          <section className="course-section">
            <h2>About this course</h2>
            <p className="preserve course-about">{course.description}</p>
          </section>

          <section className="course-section">
            <div className="course-section-head">
              <h2>Course content</h2>
              {summary && <span>{summary}</span>}
            </div>
            {materials.length ? (
              <ol className="curriculum">
                {materials.map((material, index) => {
                  const { Icon, verb } = metaFor(material.type);
                  const open = canOpen(material);
                  return (
                    <li className="curriculum-row" key={material.id}>
                      <span className="curriculum-icon">
                        {material.completed ? <Check size={17} /> : <Icon size={18} />}
                      </span>
                      <div className="curriculum-info">
                        <strong>
                          {index + 1}. {material.name}
                        </strong>
                        <small>
                          {metaFor(material.type).label}
                          {material.file_size ? ` · ${formatBytes(material.file_size)}` : ""}
                          {material.is_preview && !course.enrolled ? " · Free preview" : ""}
                        </small>
                        {material.description && <p>{material.description}</p>}
                      </div>
                      {open ? (
                        <Link className="curriculum-open" href={`/courses/${course.id}/materials/${material.id}`}>
                          {material.completed ? "Review" : verb}
                        </Link>
                      ) : (
                        <span className="curriculum-locked" title="Enroll to unlock">
                          <Lock size={15} /> Locked
                        </span>
                      )}
                    </li>
                  );
                })}
              </ol>
            ) : (
              <Empty title="Materials coming soon" text="The instructor is still preparing this course." />
            )}
          </section>

          {course.instructor_id && (
            <section className="course-section">
              <h2>Your instructor</h2>
              <div className="instructor-card">
                <InstructorAvatar id={course.instructor_id} hasImage={course.instructor_has_image} size={64} />
                <div>
                  <strong>{course.instructor_name}</strong>
                  {course.instructor_designation && <small>{course.instructor_designation}</small>}
                  {course.instructor_details && <p className="clamp-3">{course.instructor_details}</p>}
                  <Link className="button secondary" href={`/instructors/${course.instructor_id}`}>
                    View profile
                  </Link>
                </div>
              </div>
            </section>
          )}
        </div>

        <aside className="course-aside">
          <div className="card course-enroll">
            {course.has_cover_image && (
              <img className="course-enroll-cover" src={`/api/backend/frontend/course-covers/${course.id}`} alt="" />
            )}
            <div className="course-price">{money(course.price, course.currency)}</div>
            {course.enrolled ? (
              <>
                <ProgressBar done={course.progress_done} total={course.progress_total} />
                {materials.length > 0 && (
                  <Link
                    className="button"
                    href={`/courses/${course.id}/materials/${(materials.find((item) => !item.completed) || materials[0]).id}`}
                  >
                    {course.progress_done ? "Continue learning" : "Start learning"}
                  </Link>
                )}
              </>
            ) : (
              <Action
                onClick={async () => {
                  await api(`courses/${course.id}/enroll`, { method: "POST" });
                  setMessage("You’re enrolled. Your next chapter starts now.");
                  reload();
                }}
              >
                Enroll now
              </Action>
            )}
            <ul className="course-includes">
              <li>{materials.length} learning material{materials.length === 1 ? "" : "s"}</li>
              {Object.entries(counts).map(([type, count]) => (
                <li key={type}>
                  {count} {metaFor(type).label.toLowerCase()}
                  {count === 1 ? "" : "s"}
                </li>
              ))}
              <li>Learn at your own pace</li>
            </ul>
          </div>
        </aside>
      </div>
    </>
  );
}

export function Viewer({ courseId, material, onClose, onViewed }) {
  const [content, setContent] = useState(null);
  const [error, setError] = useState("");
  const reported = useRef(false);
  const { Icon } = metaFor(material.type);

  useEffect(() => {
    let live = true;
    reported.current = false;
    setContent(null);
    setError("");
    api(`frontend/courses/${courseId}/materials/${material.id}/content`)
      .then((data) => {
        if (!live) return;
        setContent(data);
        if (!data.file) onViewed();
      })
      .catch((requestError) => live && setError(requestError.message));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, material.id]);

  function markViewed() {
    if (reported.current) return;
    reported.current = true;
    setTimeout(onViewed, 1200);
  }

  const file = content?.file;
  const isPdf = file && material.type === "document" && /\.pdf$/i.test(file.name || "");
  const external = safeLink(content?.external_url);
  return (
    <section className="viewer" aria-label={material.name}>
      <div className="viewer-head">
        <span className="curriculum-icon">
          <Icon size={18} />
        </span>
        <div>
          <strong>{material.name}</strong>
          <small>{metaFor(material.type).label}</small>
        </div>
        {onClose && (
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close viewer">
            <X size={18} />
          </button>
        )}
      </div>
      {error ? (
        <p className="notice error" role="alert">
          <CircleAlert size={16} /> {error}
        </p>
      ) : !content ? (
        <div className="loading" role="status">
          <span className="spinner" /> Opening material…
        </div>
      ) : (
        <div className="viewer-body">
          {material.type === "video" && file ? (
            <video controls controlsList="nodownload" preload="metadata" src={file.url} onPlay={markViewed}>
              Your browser can’t play this video.
            </video>
          ) : isPdf ? (
            <iframe title={material.name} src={file.url} onLoad={markViewed} />
          ) : file ? (
            <div className="viewer-file">
              <FileText size={34} strokeWidth={1.5} />
              <strong>{file.name}</strong>
              {file.size ? <small>{formatBytes(file.size)}</small> : null}
              <a className="button" href={`${file.url}${file.url.includes("?") ? "&" : "?"}download=1`} onClick={markViewed} download>
                <Download size={16} /> Download
              </a>
            </div>
          ) : (
            <>
              {content.content_text && <div className="preserve viewer-text">{content.content_text}</div>}
              {external && (
                <a className="text-link" href={external} target="_blank" rel="noreferrer">
                  Open resource
                </a>
              )}
            </>
          )}
          {content.description && <p className="viewer-description">{content.description}</p>}
        </div>
      )}
    </section>
  );
}
