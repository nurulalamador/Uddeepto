"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowDown, ArrowUp, Check, CircleAlert, Download, FileText, Plus, RotateCcw, Save, Trash2, X } from "lucide-react";
import { api } from "@/lib/api";
import { ACCENTS, TEMPLATES, blankCertification, blankEducation, blankExperience, blankProject, cvFromProfile, fileNameFor, isBlank, normalizeCv } from "@/lib/cv-data";
import { State, useResource } from "../ui";
import { useUser } from "../shell";

const draftKey = (id) => `uddeepto-cv-draft:${id}`;
const readDraft = (id) => {
  try {
    const raw = localStorage.getItem(draftKey(id));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};
const writeDraft = (id, value) => {
  try {
    if (value) localStorage.setItem(draftKey(id), JSON.stringify(value));
    else localStorage.removeItem(draftKey(id));
  } catch {
    /* private mode or storage full: the draft is a convenience only */
  }
};

/** Builds the PDF for a template and data. The PDF library is large, so it is loaded only when needed. */
async function renderPdf(template, data) {
  const [{ pdf }, { CvDocument }] = await Promise.all([import("@react-pdf/renderer"), import("./cv-templates")]);
  return pdf(<CvDocument template={template} data={data} />).toBlob();
}

export default function CvGenerator() {
  const user = useUser();
  const profile = useResource(`frontend/profile/${user.id}`);
  const saved = useResource("frontend/cv");
  const ready = Boolean(profile.data && saved.data);
  return (
    <div className="cvg">
      <Link className="cvg-back" href="/profile">
        <ArrowLeft size={16} /> Back to profile
      </Link>
      {!ready ? <State resource={profile.error ? profile : saved}>{null}</State> : <Generator user={user} profile={profile.data} saved={saved.data} />}
    </div>
  );
}

function Generator({ user, profile, saved }) {
  const [template, setTemplate] = useState("classic");
  const [data, setData] = useState(() => cvFromProfile(profile));
  const [tab, setTab] = useState("template");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [fresh, setFresh] = useState(true);
  const started = useRef(false);
  const touched = useRef(false); // a draft is only kept once something was changed by hand

  // Start from a draft that was being typed, else the CV saved earlier, else the profile.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const draft = readDraft(user.id);
    if (draft?.data) {
      setData(normalizeCv(draft.data));
      if (TEMPLATES.some((item) => item.id === draft.template)) setTemplate(draft.template);
    } else if (saved.has_cv && saved.source === "generated" && saved.data) {
      setData(normalizeCv(saved.data));
      if (TEMPLATES.some((item) => item.id === saved.template)) setTemplate(saved.template);
    }
    setFresh(false);
  }, [user.id, saved]);

  useEffect(() => {
    if (!started.current || fresh || !touched.current) return;
    writeDraft(user.id, { template, data });
  }, [template, data, fresh, user.id]);

  const change = (patch) => {
    touched.current = true;
    setData((value) => ({ ...value, ...patch }));
  };
  const personal = (key, text) => {
    touched.current = true;
    setData((value) => ({ ...value, personal: { ...value.personal, [key]: text } }));
  };
  const setList = (key, rows) => change({ [key]: rows });
  const pickTemplate = (id) => {
    touched.current = true;
    setTemplate(id);
  };

  async function download() {
    setBusy("download");
    setError("");
    try {
      const blob = await renderPdf(template, data);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileNameFor(data);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (problem) {
      setError(problem.message || "The PDF could not be made.");
    } finally {
      setBusy("");
    }
  }

  async function save() {
    setBusy("save");
    setError("");
    setNotice("");
    try {
      const blob = await renderPdf(template, data);
      const body = new FormData();
      body.set("file", new File([blob], fileNameFor(data), { type: "application/pdf" }));
      body.set("source", "generated");
      body.set("template", template);
      body.set("data", JSON.stringify(data));
      await api("frontend/cv", { method: "PUT", body });
      writeDraft(user.id, null);
      setNotice("CV saved. It is now your current CV and can be used when you apply for jobs.");
    } catch (problem) {
      setError(problem.message || "The CV could not be saved.");
    } finally {
      setBusy("");
    }
  }

  function resetFromProfile() {
    if (!window.confirm("Replace everything on this page with the details from your profile?")) return;
    touched.current = true;
    setData(cvFromProfile(profile));
    setNotice("");
  }

  const empty = isBlank(data);
  return (
    <>
      <header className="cvg-head">
        <div>
          <p className="eyebrow">MY CV</p>
          <h1>CV Generator</h1>
          <p className="cvg-lead">Pick a template, check the details we took from your profile and edit anything you like. The preview on the right updates as you type.</p>
        </div>
        <div className="cvg-actions">
          <button type="button" className="button secondary" onClick={download} disabled={empty || Boolean(busy)}>
            <Download size={17} /> {busy === "download" ? "Preparing…" : "Download PDF"}
          </button>
          <button type="button" className="button" onClick={save} disabled={empty || Boolean(busy)}>
            <Save size={17} /> {busy === "save" ? "Saving…" : "Save as my CV"}
          </button>
        </div>
      </header>

      {notice && (
        <p className="notice success cvg-notice" role="status">
          <Check size={16} /> {notice} <Link href="/profile">View on your profile</Link>
        </p>
      )}
      {error && (
        <p className="notice error" role="alert">
          <CircleAlert size={16} /> {error}
        </p>
      )}

      <div className="cvg-layout">
        <section className="cvg-editor card">
          <div className="cvg-tabs" role="tablist" aria-label="CV settings">
            {[
              ["template", "Template"],
              ["details", "Details"],
            ].map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>
                {label}
              </button>
            ))}
          </div>

          {tab === "template" && <TemplatePicker template={template} accent={data.accent} onTemplate={pickTemplate} onAccent={(accent) => change({ accent })} />}
          {tab === "details" && <Details data={data} personal={personal} change={change} setList={setList} onReset={resetFromProfile} />}
        </section>

        <Preview template={template} data={data} empty={empty} />
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ template picker */
function Thumb({ id, accent }) {
  // A tiny drawing of each layout so the choice is visual.
  const bar = (w, h = 3, c = "#cbd5e1", extra = {}) => <span style={{ display: "block", width: w, height: h, background: c, borderRadius: 2, ...extra }} />;
  const lines = (n, c) => Array.from({ length: n }, (_, i) => <span key={i}>{bar(i % 3 === 2 ? "60%" : "100%", 3, c, { marginTop: 4 })}</span>);
  if (id === "modern")
    return (
      <div className="cvg-thumb" style={{ display: "grid", gridTemplateColumns: "34% 1fr" }}>
        <div style={{ background: accent, padding: 6 }}>{lines(6, "rgba(255,255,255,.7)")}</div>
        <div style={{ padding: 7 }}>
          {bar("70%", 6, "#1f2933")}
          <div style={{ marginTop: 8 }}>{lines(8, "#cbd5e1")}</div>
        </div>
      </div>
    );
  if (id === "executive")
    return (
      <div className="cvg-thumb">
        <div style={{ background: accent, height: 30, padding: 8 }}>{bar("55%", 6, "#fff")}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 36%", height: "calc(100% - 30px)" }}>
          <div style={{ padding: 7 }}>{lines(8, "#cbd5e1")}</div>
          <div style={{ background: "#eef2f6", padding: 6 }}>{lines(6, "#cbd5e1")}</div>
        </div>
      </div>
    );
  if (id === "minimal")
    return (
      <div className="cvg-thumb" style={{ padding: 10 }}>
        {bar("55%", 7, "#1f2933")}
        {bar(18, 3, accent, { margin: "5px 0 8px" })}
        {[0, 1, 2].map((row) => (
          <div key={row} style={{ display: "grid", gridTemplateColumns: "26% 1fr", gap: 6, marginTop: 7 }}>
            {bar("80%", 3, "#cbd5e1")}
            <div>{lines(3, "#cbd5e1")}</div>
          </div>
        ))}
      </div>
    );
  if (id === "creative")
    return (
      <div className="cvg-thumb" style={{ padding: 9 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 16, height: 16, borderRadius: 8, background: accent }} />
          {bar("50%", 6, "#1f2933")}
        </div>
        <div style={{ display: "flex", gap: 4, margin: "8px 0" }}>{[0, 1, 2].map((chip) => <span key={chip} style={{ width: 22, height: 8, borderRadius: 5, border: `1px solid ${accent}` }} />)}</div>
        {[0, 1].map((row) => (
          <div key={row} style={{ display: "flex", gap: 6, marginTop: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: 3, background: accent, marginTop: 2 }} />
            <div style={{ flex: 1 }}>{lines(3, "#cbd5e1")}</div>
          </div>
        ))}
      </div>
    );
  return (
    <div className="cvg-thumb" style={{ padding: 10, textAlign: "center" }}>
      {bar("50%", 7, "#1f2933", { margin: "0 auto" })}
      {bar("35%", 3, "#9aa5b1", { margin: "5px auto 8px" })}
      {[0, 1].map((section) => (
        <div key={section} style={{ marginTop: 7, textAlign: "left" }}>
          {bar("100%", 1.5, accent)}
          <div style={{ marginTop: 4 }}>{lines(3, "#cbd5e1")}</div>
        </div>
      ))}
    </div>
  );
}

function TemplatePicker({ template, accent, onTemplate, onAccent }) {
  return (
    <div className="cvg-panel">
      <h2>Choose a template</h2>
      <div className="cvg-templates" role="radiogroup" aria-label="CV template">
        {TEMPLATES.map((item) => (
          <button key={item.id} type="button" role="radio" aria-checked={template === item.id} className={`cvg-template${template === item.id ? " selected" : ""}`} onClick={() => onTemplate(item.id)}>
            <Thumb id={item.id} accent={accent} />
            <strong>{item.name}</strong>
            <small>{item.blurb}</small>
            {template === item.id && (
              <span className="cvg-picked">
                <Check size={14} /> Selected
              </span>
            )}
          </button>
        ))}
      </div>
      <h2>Accent colour</h2>
      <div className="cvg-swatches" role="radiogroup" aria-label="Accent colour">
        {ACCENTS.map((item) => (
          <button key={item.id} type="button" role="radio" aria-checked={accent === item.id} aria-label={item.name} title={item.name} className={accent === item.id ? "selected" : ""} style={{ background: item.id }} onClick={() => onAccent(item.id)}>
            {accent === item.id && <Check size={16} />}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ editing the details */
function Field({ label, children, wide }) {
  return (
    <label className={`cvg-field${wide ? " wide" : ""}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function Group({ title, hint, count, open, children }) {
  return (
    <details className="cvg-group" open={open}>
      <summary>
        <strong>{title}</strong>
        {count != null && <span className="cvg-count">{count}</span>}
        {hint && <small>{hint}</small>}
      </summary>
      <div className="cvg-group-body">{children}</div>
    </details>
  );
}

function RepeatList({ rows, onChange, blank, label, render }) {
  const move = (index, step) => {
    const next = [...rows];
    const target = index + step;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };
  return (
    <div className="cvg-rows">
      {rows.map((row, index) => (
        <fieldset key={index} className="cvg-row">
          <legend>
            {label} {index + 1}
          </legend>
          <div className="cvg-row-tools">
            <button type="button" aria-label={`Move ${label.toLowerCase()} ${index + 1} up`} disabled={index === 0} onClick={() => move(index, -1)}>
              <ArrowUp size={15} />
            </button>
            <button type="button" aria-label={`Move ${label.toLowerCase()} ${index + 1} down`} disabled={index === rows.length - 1} onClick={() => move(index, 1)}>
              <ArrowDown size={15} />
            </button>
            <button type="button" aria-label={`Remove ${label.toLowerCase()} ${index + 1}`} className="danger" onClick={() => onChange(rows.filter((_, position) => position !== index))}>
              <Trash2 size={15} />
            </button>
          </div>
          <div className="cvg-grid">{render(row, (patch) => onChange(rows.map((item, position) => (position === index ? { ...item, ...patch } : item))))}</div>
        </fieldset>
      ))}
      <button type="button" className="button secondary cvg-add" onClick={() => onChange([...rows, blank()])}>
        <Plus size={16} /> Add {label.toLowerCase()}
      </button>
    </div>
  );
}

function Tags({ values, onChange, label, placeholder }) {
  const [text, setText] = useState("");
  const add = () => {
    const items = text
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item && !values.some((value) => value.toLowerCase() === item.toLowerCase()));
    if (items.length) onChange([...values, ...items]);
    setText("");
  };
  return (
    <div className="cvg-tags">
      <div className="cvg-chips">
        {values.map((value) => (
          <span key={value} className="cvg-chip">
            {value}
            <button type="button" aria-label={`Remove ${value}`} onClick={() => onChange(values.filter((item) => item !== value))}>
              <X size={12} />
            </button>
          </span>
        ))}
        {!values.length && <small>None yet.</small>}
      </div>
      <div className="cvg-tag-input">
        <input
          aria-label={label}
          value={text}
          placeholder={placeholder}
          maxLength={80}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
        />
        <button type="button" className="button secondary" onClick={add} disabled={!text.trim()}>
          Add
        </button>
      </div>
    </div>
  );
}

function Details({ data, personal, change, setList, onReset }) {
  const p = data.personal;
  return (
    <div className="cvg-panel">
      <div className="cvg-panel-head">
        <h2>Your details</h2>
        <button type="button" className="cvg-reset" onClick={onReset}>
          <RotateCcw size={14} /> Reset from profile
        </button>
      </div>

      <Group title="Personal details" open>
        <div className="cvg-grid">
          <Field label="Full name">
            <input value={p.name} maxLength={120} onChange={(event) => personal("name", event.target.value)} />
          </Field>
          <Field label="Professional title">
            <input value={p.headline} maxLength={160} placeholder="e.g. Junior web developer" onChange={(event) => personal("headline", event.target.value)} />
          </Field>
          <Field label="Email">
            <input type="email" value={p.email} maxLength={160} onChange={(event) => personal("email", event.target.value)} />
          </Field>
          <Field label="Phone">
            <input value={p.phone} maxLength={40} onChange={(event) => personal("phone", event.target.value)} />
          </Field>
          <Field label="Address" wide>
            <input value={p.address} maxLength={200} onChange={(event) => personal("address", event.target.value)} />
          </Field>
          <Field label="Website or portfolio" wide>
            <input value={p.website} maxLength={200} placeholder="https://" onChange={(event) => personal("website", event.target.value)} />
          </Field>
        </div>
      </Group>

      <Group title="Summary" hint="Two or three sentences about you" open>
        <Field label="Professional summary" wide>
          <textarea rows={5} maxLength={1500} value={data.summary} onChange={(event) => change({ summary: event.target.value })} />
        </Field>
      </Group>

      <Group title="Experience" count={data.experience.length} open>
        <RepeatList
          rows={data.experience}
          blank={blankExperience}
          label="Experience"
          onChange={(rows) => setList("experience", rows)}
          render={(row, patch) => (
            <>
              <Field label="Job title">
                <input value={row.title} maxLength={150} onChange={(event) => patch({ title: event.target.value })} />
              </Field>
              <Field label="Company or organisation">
                <input value={row.workplace} maxLength={150} onChange={(event) => patch({ workplace: event.target.value })} />
              </Field>
              <Field label="Location">
                <input value={row.location} maxLength={150} onChange={(event) => patch({ location: event.target.value })} />
              </Field>
              <Field label="Start">
                <input type="month" value={row.start} onChange={(event) => patch({ start: event.target.value })} />
              </Field>
              <Field label="End">
                <input type="month" value={row.end} disabled={row.current} onChange={(event) => patch({ end: event.target.value })} />
              </Field>
              <label className="cvg-check">
                <input type="checkbox" checked={row.current} onChange={(event) => patch({ current: event.target.checked })} /> I currently work here
              </label>
              <Field label="What you did (one point per line)" wide>
                <textarea rows={4} maxLength={2000} value={row.description} onChange={(event) => patch({ description: event.target.value })} />
              </Field>
            </>
          )}
        />
      </Group>

      <Group title="Education" count={data.education.length} open>
        <RepeatList
          rows={data.education}
          blank={blankEducation}
          label="Education"
          onChange={(rows) => setList("education", rows)}
          render={(row, patch) => (
            <>
              <Field label="School or university" wide>
                <input value={row.institution} maxLength={150} onChange={(event) => patch({ institution: event.target.value })} />
              </Field>
              <Field label="Degree">
                <input value={row.degree} maxLength={150} onChange={(event) => patch({ degree: event.target.value })} />
              </Field>
              <Field label="Field of study">
                <input value={row.field} maxLength={150} onChange={(event) => patch({ field: event.target.value })} />
              </Field>
              <Field label="Start">
                <input type="month" value={row.start} onChange={(event) => patch({ start: event.target.value })} />
              </Field>
              <Field label="End">
                <input type="month" value={row.end} onChange={(event) => patch({ end: event.target.value })} />
              </Field>
              <Field label="Grade">
                <input value={row.grade} maxLength={60} onChange={(event) => patch({ grade: event.target.value })} />
              </Field>
            </>
          )}
        />
      </Group>

      <Group title="Skills" count={data.skills.length} hint="We started with your interests" open>
        <Tags values={data.skills} label="Add a skill" placeholder="Type a skill and press Enter" onChange={(skills) => change({ skills })} />
      </Group>

      <Group title="Languages" count={data.languages.length}>
        <Tags values={data.languages} label="Add a language" placeholder="e.g. Bangla (native)" onChange={(languages) => change({ languages })} />
      </Group>

      <Group title="Projects" count={data.projects.length}>
        <RepeatList
          rows={data.projects}
          blank={blankProject}
          label="Project"
          onChange={(rows) => setList("projects", rows)}
          render={(row, patch) => (
            <>
              <Field label="Project name">
                <input value={row.name} maxLength={150} onChange={(event) => patch({ name: event.target.value })} />
              </Field>
              <Field label="Link">
                <input value={row.link} maxLength={200} placeholder="https://" onChange={(event) => patch({ link: event.target.value })} />
              </Field>
              <Field label="Description" wide>
                <textarea rows={3} maxLength={1500} value={row.description} onChange={(event) => patch({ description: event.target.value })} />
              </Field>
            </>
          )}
        />
      </Group>

      <Group title="Certifications" count={data.certifications.length}>
        <RepeatList
          rows={data.certifications}
          blank={blankCertification}
          label="Certification"
          onChange={(rows) => setList("certifications", rows)}
          render={(row, patch) => (
            <>
              <Field label="Certificate" wide>
                <input value={row.title} maxLength={150} onChange={(event) => patch({ title: event.target.value })} />
              </Field>
              <Field label="Issued by">
                <input value={row.issuer} maxLength={150} onChange={(event) => patch({ issuer: event.target.value })} />
              </Field>
              <Field label="Year">
                <input value={row.year} maxLength={10} onChange={(event) => patch({ year: event.target.value })} />
              </Field>
            </>
          )}
        />
      </Group>
    </div>
  );
}

/* ------------------------------------------------------------------ live preview */
function Preview({ template, data, empty }) {
  const [url, setUrl] = useState("");
  const [state, setState] = useState("idle"); // idle | working | error
  const run = useRef(0);
  const current = useRef("");

  const draw = useCallback(async () => {
    const id = ++run.current;
    setState("working");
    try {
      const blob = await renderPdf(template, data);
      if (id !== run.current) return;
      const next = URL.createObjectURL(blob);
      if (current.current) URL.revokeObjectURL(current.current);
      current.current = next;
      setUrl(next);
      setState("idle");
    } catch {
      if (id === run.current) setState("error");
    }
  }, [template, data]);

  useEffect(() => {
    if (empty) {
      setUrl("");
      return undefined;
    }
    const timer = setTimeout(draw, 550);
    return () => clearTimeout(timer);
  }, [draw, empty]);

  useEffect(
    () => () => {
      if (current.current) URL.revokeObjectURL(current.current);
    },
    [],
  );

  return (
    <aside className="cvg-preview" aria-label="CV preview">
      <div className="cvg-preview-bar">
        <FileText size={16} /> Live preview
        {state === "working" && <span className="cvg-working">Updating…</span>}
      </div>
      <div className="cvg-frame">
        {empty ? (
          <p className="cvg-placeholder">Add your name to see your CV here.</p>
        ) : state === "error" ? (
          <p className="cvg-placeholder">The preview could not be drawn. Check the details and try again.</p>
        ) : url ? (
          <iframe title="CV preview" src={`${url}#toolbar=0&navpanes=0&view=FitH`} />
        ) : (
          <p className="cvg-placeholder">Preparing your preview…</p>
        )}
      </div>
    </aside>
  );
}
