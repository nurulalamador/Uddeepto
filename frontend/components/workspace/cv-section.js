"use client";

import { useState } from "react";
import Link from "next/link";
import { Download, FileText, Pencil, Sparkles, Trash2, Upload } from "lucide-react";
import { api } from "@/lib/api";
import { TEMPLATES } from "@/lib/cv-data";
import { FileDropzone, Modal, useResource } from "../ui";

const when = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" });
const size = (bytes) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

/** The "My CV" part of a learner's own profile. */
export default function MyCv() {
  const resource = useResource("frontend/cv");
  const [uploading, setUploading] = useState(false);
  const [changing, setChanging] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const cv = resource.data;

  async function remove() {
    if (!window.confirm("Remove your current CV? Applications you already sent keep their copy.")) return;
    setError("");
    try {
      await api("frontend/cv", { method: "DELETE" });
      setChanging(false);
      setNotice("Your CV was removed.");
      resource.reload();
    } catch (problem) {
      setError(problem.message);
    }
  }

  if (resource.loading && !cv) return <p className="pf-empty">Loading your CV…</p>;
  if (resource.error && !cv) return <p className="notice error" role="alert">{resource.error}</p>;

  const template = TEMPLATES.find((item) => item.id === cv?.template);
  return (
    <div className="cv-card">
      {notice && (
        <p className="notice success" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}

      {cv?.has_cv ? (
        <>
          <div className="cv-file">
            <span className="cv-file-icon">
              <FileText size={22} />
            </span>
            <div>
              <strong>{cv.file_name}</strong>
              <small>
                {cv.source === "generated" ? `Made in the CV Generator${template ? ` · ${template.name} template` : ""}` : "Uploaded by you"} · {size(cv.file_size)} · Updated {when.format(new Date(cv.updated_at))}
              </small>
            </div>
          </div>
          <div className="cv-actions">
            <a className="button" href="/api/backend/frontend/cv/file?download=1" download>
              <Download size={16} /> Download CV
            </a>
          </div>
          <div className="cv-change">
            <button type="button" className="button secondary" aria-expanded={changing} onClick={() => setChanging((value) => !value)}>
              <Pencil size={16} /> Change CV
            </button>
            {changing && (
              <div className="cv-options" role="group" aria-label="Change CV">
                <button type="button" className="button secondary" onClick={() => setUploading(true)}>
                  <Upload size={16} /> Upload a new CV
                </button>
                <Link className="button secondary" href="/cv">
                  <Sparkles size={16} /> {cv.source === "generated" ? "Edit in CV Generator" : "Generate a new CV"}
                </Link>
                <button type="button" className="cv-remove" onClick={remove}>
                  <Trash2 size={15} /> Remove CV
                </button>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <p className="pf-empty">You have not added a CV yet. Upload a PDF you already have, or let us build one from your profile.</p>
          <div className="cv-actions">
            <button type="button" className="button secondary" onClick={() => setUploading(true)}>
              <Upload size={16} /> Upload CV
            </button>
            <Link className="button" href="/cv">
              <Sparkles size={16} /> Generate CV
            </Link>
          </div>
        </>
      )}

      {uploading && (
        <Modal title="Upload your CV" onClose={() => setUploading(false)}>
          <UploadForm
            onDone={() => {
              setUploading(false);
              setChanging(false);
              setNotice("Your CV was uploaded.");
              resource.reload();
            }}
          />
        </Modal>
      )}
    </div>
  );
}

function UploadForm({ onDone }) {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("source", "uploaded");
      await api("frontend/cv", { method: "PUT", body });
      onDone();
    } catch (problem) {
      setError(problem.message);
      setBusy(false);
    }
  }

  return (
    <form className="form stack" onSubmit={submit}>
      <p className="room-muted">This replaces your current CV. Employers see it when you apply for a job with “Your current CV”.</p>
      <FileDropzone accept="application/pdf,.pdf" file={file} onFile={setFile} label="Drag and drop your CV" hint="PDF · up to 10 MB" />
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <button className="button" disabled={!file || busy}>
        {busy ? "Uploading…" : "Save CV"}
      </button>
    </form>
  );
}
