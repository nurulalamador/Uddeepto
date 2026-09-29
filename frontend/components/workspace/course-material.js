"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Lock } from "lucide-react";
import { State, useResource } from "../ui";
import { useShellActions } from "../shell";
import { ProgressBar } from "./courses";
import { Viewer, formatBytes, materialIcon } from "./course-detail";

export default function CourseMaterial({ courseId, materialId }) {
  const resource = useResource(`frontend/courses/${courseId}`);
  const { setDetailSubtitle } = useShellActions();
  const course = resource.data;
  const materials = course?.materials || [];
  const index = materials.findIndex((item) => item.id === materialId);
  const material = materials[index];
  const previous = materials[index - 1];
  const next = materials[index + 1];
  const canOpen = (item) => course.enrolled || item.is_preview;

  useEffect(() => {
    setDetailSubtitle?.(material?.name || course?.title || "");
    return () => setDetailSubtitle?.("");
  }, [material?.name, course?.title, setDetailSubtitle]);

  return (
    <div className="post-detail-content wide">
      {!course && <State resource={resource}>{null}</State>}
      {course && (
        <>
        {!material && (
          <div className="card">
            <h1>Material not found</h1>
            <p>This material is no longer part of the course.</p>
            <Link className="button" href={`/courses/${course.id}`}>
              Back to course
            </Link>
          </div>
        )}
        {material && (
          <div className="course-layout material-layout">
            <div className="course-main">
              <Viewer
                key={material.id}
                courseId={course.id}
                material={material}
                onViewed={resource.reload}
              />
              <div className="material-nav">
                {previous && canOpen(previous) ? (
                  <Link className="button secondary" href={`/courses/${course.id}/materials/${previous.id}`}>
                    <ArrowLeft size={16} /> Previous
                  </Link>
                ) : (
                  <span />
                )}
                {next && canOpen(next) ? (
                  <Link className="button" href={`/courses/${course.id}/materials/${next.id}`}>
                    Next <ArrowRight size={16} />
                  </Link>
                ) : (
                  <span />
                )}
              </div>
            </div>

            <aside className="course-aside">
              <div className="card course-enroll">
                <Link className="material-course-title" href={`/courses/${course.id}`}>
                  {course.title}
                </Link>
                {course.enrolled ? (
                  <ProgressBar done={course.progress_done} total={course.progress_total} />
                ) : (
                  <p className="material-preview-note">
                    You’re viewing a free preview. <Link href={`/courses/${course.id}`}>Enroll</Link> to unlock every
                    material.
                  </p>
                )}
                <ol className="material-list">
                  {materials.map((item, position) => {
                    const Icon = materialIcon(item.type);
                    const open = canOpen(item);
                    const row = (
                      <>
                        <span className="curriculum-icon">
                          {item.completed ? <Check size={16} /> : open ? <Icon size={16} /> : <Lock size={15} />}
                        </span>
                        <span className="material-list-text">
                          <strong>
                            {position + 1}. {item.name}
                          </strong>
                          {item.file_size ? <small>{formatBytes(item.file_size)}</small> : null}
                        </span>
                      </>
                    );
                    return (
                      <li key={item.id} className={item.id === material.id ? "current" : ""}>
                        {open ? (
                          <Link href={`/courses/${course.id}/materials/${item.id}`}>{row}</Link>
                        ) : (
                          <span className="locked">{row}</span>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </div>
            </aside>
          </div>
        )}
        </>
      )}
    </div>
  );
}
