"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowDownUp,
  ArrowRight,
  BookOpen,
  Briefcase,
  Check,
  Edit3,
  Github,
  Globe,
  Linkedin,
  Plus,
  Search,
  Tags,
  Trash2,
  Trophy,
  UserRound,
  Users,
  Video,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { adminFields } from "@/lib/admin-fields";
import AdminContent from "./admin-content";
import { Action, Badge, CategoryPicker, Empty, Modal, SearchBox, State, useResource } from "../ui";

const PAGE_SIZE = 20;
const tables = {
  users: { title: "Users", icon: Users, noun: "user", statusField: "account_status", statuses: ["active", "suspended", "deactivated"], sorts: [["created_at", "Newest first"], ["name", "Name A to Z"], ["email", "Email A to Z"], ["role", "Role"]], columns: ["name", "email", "role", "account_status", "created_at", "last_login_at"] },
  courses: { title: "Courses", icon: BookOpen, noun: "course", statusField: "status", statuses: ["draft", "published", "archived"], publishTo: "published", publishLabel: "Publish course", sorts: [["created_at", "Newest first"], ["title", "Title A to Z"], ["price", "Price"]], columns: ["title", "instructor_name", "category_name", "price", "enrollment_count", "status", "created_at"] },
  instructors: { title: "Instructors", icon: UserRound, noun: "instructor", sorts: [["created_at", "Newest first"], ["name", "Name A to Z"]], columns: ["name", "designation", "details", "social_links", "course_count", "created_at"] },
  contests: { title: "Contests", icon: Trophy, noun: "contest", statusField: "status", statuses: ["draft", "published", "cancelled", "completed"], publishTo: "published", publishLabel: "Publish contest", sorts: [["created_at", "Newest first"], ["name", "Name A to Z"], ["starting_time", "Start date"]], columns: ["name", "creator_name", "category_name", "type", "entry_fee", "participant_count", "starting_time", "ending_time", "status"] },
  webinars: { title: "Webinars", icon: Video, noun: "webinar", statusField: "status", statuses: ["draft", "scheduled", "live", "completed", "cancelled"], publishTo: "scheduled", publishLabel: "Approve & schedule", sorts: [["created_at", "Newest first"], ["name", "Name A to Z"], ["starting_time", "Start date"]], columns: ["name", "speaker_names", "category_name", "participant_count", "capacity", "starting_time", "ending_time", "status"] },
  jobs: { title: "Jobs", icon: Briefcase, noun: "job", statusField: "status", statuses: ["draft", "open", "closed", "filled", "cancelled"], publishTo: "open", publishLabel: "Approve & open", sorts: [["created_at", "Newest first"], ["title", "Title A to Z"], ["application_deadline", "Application deadline"]], columns: ["title", "creator_name", "category_name", "type", "location", "salary", "application_count", "application_deadline", "status"] },
  interest_categories: { title: "Interests", icon: Tags, noun: "interest", statusField: "is_active", statuses: ["true", "false"], sorts: [["created_at", "Newest first"], ["name", "Name A to Z"], ["slug", "Slug"]], columns: ["name", "slug", "icon", "description", "is_active", "created_at"] },
  communities: { title: "Communities", icon: Users, noun: "community", sorts: [["created_at", "Newest first"], ["name", "Name A to Z"]], columns: ["name", "creator_name", "category_name", "member_count", "requires_approval", "is_private", "created_at"] },
};

const labels = {
  name: "Name", title: "Title", email: "Email", role: "Role", account_status: "Account status", created_at: "Created", last_login_at: "Last sign-in",
  creator_name: "Owner / host", instructor_name: "Instructor", designation: "Designation", social_links: "Social links", details: "Details", course_count: "Assigned courses", category_name: "Interests", price: "Price", enrollment_count: "Enrolled", type: "Type", entry_fee: "Entry fee",
  participant_count: "Participants", speaker_names: "Speakers", recording_url: "Recording URL", submission_kind: "Contest entry type", starting_time: "Starts", ending_time: "Ends", capacity: "Capacity", location: "Location", salary: "Salary range",
  application_count: "Applications", application_deadline: "Deadline", slug: "Slug", icon: "Icon", description: "Description", is_active: "Availability",
  member_count: "Members", requires_approval: "Join approval", is_private: "Private", status: "Status",
};

export default function Admin({ initialTable = "users" }) {
  const [table, setTable] = useState(initialTable);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState("created_at");
  const [direction, setDirection] = useState("desc");
  const [selected, setSelected] = useState([]);
  const [bulkStatus, setBulkStatus] = useState("");
  const [editing, setEditing] = useState(null);
  const [notice, setNotice] = useState("");
  const current = tables[table] || tables.users;

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("tab");
    setTable(tables[requested] ? requested : tables[initialTable] ? initialTable : "users");
  }, [initialTable]);

  useEffect(() => {
    const timer = setTimeout(() => { setPage(0); setQuery(search.trim()); }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  const params = useMemo(() => {
    const value = new URLSearchParams({ offset: String(page * PAGE_SIZE), limit: String(PAGE_SIZE), sort, direction });
    if (query) value.set("q", query);
    if (status) value.set("status", status);
    if (from) value.set("from", from);
    if (to) value.set("to", to);
    return value.toString();
  }, [table, page, sort, direction, query, status, from, to]);
  const resource = useResource(`frontend/admin/${table}?${params}`);
  const rows = resource.data || [];

  useEffect(() => { setSelected([]); }, [table, page, query, status, from, to]);

  function chooseTable(key) {
    setTable(key);
    setPage(0); setSearch(""); setQuery(""); setStatus(""); setFrom(""); setTo("");
    setSort("created_at"); setDirection("desc"); setSelected([]); setNotice("");
  }

  async function removeRecord(item) {
    const warning = table === "instructors" && Number(item.course_count) > 0
      ? ` ${item.course_count} assigned course(s) will become unassigned.`
      : " This may remove related records.";
    if (!confirm(`Delete this ${current.noun}?${warning}`)) return;
    try {
      const result = await api(`frontend/admin/${table}/${item.id}`, { method: "DELETE" });
      setNotice(table === "instructors" && result?.unassigned_courses
        ? `Instructor deleted. ${result.unassigned_courses} course(s) need a new instructor.`
        : `${capitalize(current.noun)} deleted.`);
      resource.reload();
    } catch (error) { setNotice(error.message); }
  }

  async function publishRecord(item) {
    try {
      await api(`frontend/admin/${table}/${item.id}`, { method: "PATCH", body: { [current.statusField]: current.publishTo } });
      setNotice(`${capitalize(current.noun)} approved.`); resource.reload();
    } catch (error) { setNotice(error.message); }
  }

  async function runBulk(action) {
    if (!selected.length) return;
    if (action === "delete" && !confirm(`Delete ${selected.length} selected ${current.title.toLowerCase()}?`)) return;
    try {
      const result = await api(`frontend/admin/${table}/bulk`, { method: "POST", body: { ids: selected, action, ...(action === "status" ? { status: bulkStatus } : {}) } });
      setNotice(`${result.updated} record(s) ${action === "delete" ? "deleted" : "updated"}.`);
      setSelected([]); setBulkStatus(""); resource.reload();
    } catch (error) { setNotice(error.message); }
  }

  const allSelected = rows.length > 0 && rows.every((item) => selected.includes(item.id));
  return (
    <div className="admin-management">
      <header className="admin-page-heading">
        <div><p className="eyebrow">ADMINISTRATION</p><h1>{table === "users" ? "Management" : `${current.title} management`}</h1></div>
        <button className="button" onClick={() => setEditing({})}><Plus size={18} /> Add {current.noun}</button>
      </header>

      <nav className="admin-resource-tabs" aria-label="Manage records">
        {Object.entries(tables).map(([key, item]) => { const Icon = item.icon; return <button type="button" key={key} className={table === key ? "active" : ""} aria-current={table === key ? "page" : undefined} onClick={() => chooseTable(key)}><Icon size={17} />{item.title}</button>; })}
      </nav>

      {notice && <div className="notice success admin-operation-notice" role="status"><Check size={17} />{notice}<button onClick={() => setNotice("")} aria-label="Dismiss message"><X size={16} /></button></div>}
      <section className="card admin-table-panel">
        <div className="admin-table-heading"><div><h2>{current.title}</h2><p>Page {page + 1}{rows.length === PAGE_SIZE ? " · more records available" : " · latest matching records"}</p></div><Link className="admin-text-link" href="/moderation">Moderation queue <ArrowRight size={15} /></Link></div>
        <div className="admin-filters">
          <SearchBox value={search} onChange={setSearch} placeholder={`Search ${current.title.toLowerCase()}…`} />
          {current.statuses && <label className="admin-filter-select"><span>Status</span><select value={status} onChange={(event) => { setStatus(event.target.value); setPage(0); }}><option value="">All statuses</option>{current.statuses.map((item) => <option value={item} key={item}>{statusLabel(item)}</option>)}</select></label>}
          <label className="admin-date-filter"><span>From</span><input type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(0); }} /></label>
          <label className="admin-date-filter"><span>To</span><input type="date" value={to} onChange={(event) => { setTo(event.target.value); setPage(0); }} /></label>
          <label className="admin-filter-select admin-sort-select"><span>Sort</span><select value={sort} onChange={(event) => setSort(event.target.value)}>{current.sorts.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
          <button type="button" className="icon-button admin-sort-direction" aria-label={direction === "desc" ? "Newest first" : "Oldest first"} title={direction === "desc" ? "Newest first" : "Oldest first"} onClick={() => setDirection((value) => value === "desc" ? "asc" : "desc")}><ArrowDownUp size={17} /></button>
        </div>

        {selected.length > 0 && <div className="admin-bulk-bar"><strong>{selected.length} selected</strong>
          {current.statuses && <><select aria-label="New status for selected records" value={bulkStatus} onChange={(event) => setBulkStatus(event.target.value)}><option value="">Change status…</option>{current.statuses.map((item) => <option value={item} key={item}>{statusLabel(item)}</option>)}</select><button className="button secondary" disabled={!bulkStatus} onClick={() => void runBulk("status")}>Apply status</button></>}
          {table !== "users" && <button className="button danger-fill" onClick={() => void runBulk("delete")}><Trash2 size={16} /> Delete selected</button>}
          <button className="icon-button" aria-label="Clear selection" onClick={() => setSelected([])}><X size={17} /></button>
        </div>}

        <State resource={resource}>
          {rows.length ? <>
            <div className="table-wrap admin-table-wrap"><table className="admin-table"><thead><tr><th className="admin-check-cell"><input type="checkbox" aria-label="Select all records on this page" checked={allSelected} onChange={() => setSelected(allSelected ? [] : rows.map((item) => item.id))} /></th>{current.columns.map((column) => <th key={column}>{labels[column]}</th>)}<th className="admin-action-cell">Actions</th></tr></thead>
              <tbody>{rows.map((item) => <tr key={item.id}><td className="admin-check-cell"><input type="checkbox" aria-label={`Select ${item.name || item.title || item.email || current.noun}`} checked={selected.includes(item.id)} onChange={() => setSelected((value) => value.includes(item.id) ? value.filter((id) => id !== item.id) : value.length < 100 ? [...value, item.id] : value)} /></td>{current.columns.map((column) => <td key={column}>{renderCell(column, item)}</td>)}<td className="admin-action-cell"><div className="admin-row-actions">{item.status === "draft" && current.publishTo && <Action className="admin-approve-button" aria-label={current.publishLabel} title={current.publishLabel} onClick={() => publishRecord(item)}><Check size={16} /><span>{current.publishLabel}</span></Action>}<button type="button" className="icon-button" aria-label={`Edit ${current.noun}`} title="Edit record" onClick={() => setEditing(item)}><Edit3 size={16} /></button>{table !== "users" && <Action className="icon-button danger" aria-label={`Delete ${current.noun}`} title="Delete record" onClick={() => removeRecord(item)}><Trash2 size={16} /></Action>}</div></td></tr>)}</tbody>
            </table></div>
            <div className="admin-pagination"><span>Showing {page * PAGE_SIZE + 1}–{page * PAGE_SIZE + rows.length}</span><div><button className="button secondary" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>Previous</button><span>Page {page + 1}</span><button className="button secondary" disabled={rows.length < PAGE_SIZE} onClick={() => setPage((value) => value + 1)}>Next</button></div></div>
          </> : <Empty title="No matching records" text="Change your filters or create the first record in this section." />}
        </State>
      </section>

      {editing && <Modal title={`${editing.id ? "Edit" : "Add"} ${current.noun}`} onClose={() => setEditing(null)}>
        {table === "users" ? <UserForm item={editing} onDone={() => { setEditing(null); resource.reload(); setNotice(editing.id ? "User updated." : "User created."); }} /> : table === "instructors" ? <InstructorForm item={editing} onDone={() => { setEditing(null); resource.reload(); setNotice(editing.id ? "Instructor updated." : "Instructor added."); }} /> : <>
          <RecordForm table={table} item={editing} onDone={() => { setEditing(null); resource.reload(); setNotice(`${capitalize(current.noun)} saved.`); }} />
          {editing.id && ["courses", "contests"].includes(table) && <AdminContent table={table} id={editing.id} />}
        </>}
      </Modal>}
    </div>
  );
}

function renderCell(column, item) {
  if (["created_at", "last_login_at", "starting_time", "ending_time", "application_deadline"].includes(column)) return <span className="admin-date-cell">{item[column] ? new Intl.DateTimeFormat("en", { dateStyle: "medium", ...(column !== "created_at" && column !== "last_login_at" ? { timeStyle: "short" } : {}) }).format(new Date(item[column])) : "—"}</span>;
  if (["status", "role", "account_status"].includes(column)) return <Badge>{statusLabel(item[column])}</Badge>;
  if (["is_active", "is_private", "requires_approval"].includes(column)) { const active = Boolean(item[column]); return <Badge>{column === "is_active" ? active ? "active" : "inactive" : active ? "yes" : "no"}</Badge>; }
  if (["price", "entry_fee"].includes(column)) return <span>{item.currency || "BDT"} {Number(item[column] || 0).toLocaleString()}</span>;
  if (column === "salary") { const low = item.salary_min == null ? "—" : Number(item.salary_min).toLocaleString(); const high = item.salary_max == null ? "—" : Number(item.salary_max).toLocaleString(); return <span>{item.currency || "BDT"} {low}–{high}{item.salary_period ? ` / ${item.salary_period}` : ""}</span>; }
  if (["participant_count", "enrollment_count", "member_count", "application_count", "course_count"].includes(column)) return <span className="admin-number-cell">{item[column] == null ? "0" : Number(item[column]).toLocaleString()}</span>;
  if (column === "capacity") return <span className="admin-number-cell">{item[column] == null ? "Unlimited" : Number(item[column]).toLocaleString()}</span>;
  if (column === "description" || column === "details") return <span className="admin-clipped" title={item[column] || ""}>{item[column] || "—"}</span>;
  if (column === "designation") return <span className="admin-cell-text">{item.designation || "—"}</span>;
  if (column === "social_links") {
    const links = item.social_links || {};
    const entries = [["linkedin", Linkedin], ["github", Github], ["website", Globe]].filter(([key]) => links[key]);
    return entries.length ? <div className="admin-social-links">{entries.map(([key, Icon]) => <a key={key} href={links[key]} target="_blank" rel="noreferrer" aria-label={`${item.name} ${key}`} title={key}><Icon size={15} /></a>)}</div> : <span className="admin-cell-text">—</span>;
  }
  if (column === "title" && item.has_cover_image) return <div className="admin-course-title-cell"><img src={`/api/backend/frontend/course-covers/${item.id}`} alt="" /><div className="admin-primary-cell"><strong title={item.title}>{item.title}</strong><small>{item.slug || ""}</small></div></div>;
  if (column === "name" && item.has_image) return <div className="admin-instructor-cell"><img className="admin-instructor-avatar" src={`/api/backend/frontend/instructors/${item.id}/image`} alt="" /><div className="admin-primary-cell"><strong title={item.name}>{item.name}</strong><small>Instructor profile</small></div></div>;
  if (["name", "title"].includes(column)) return <div className="admin-primary-cell"><strong title={item[column]}>{item[column] || "—"}</strong><small>{item.slug || item.username || item.type?.replaceAll("_", " ") || ""}</small></div>;
  if (column === "email") return <span className="admin-email-cell">{item.email}</span>;
  if (column === "creator_name") return <span>{item.creator_name || "—"}</span>;
  if (column === "instructor_name") return item.instructor_name ? <div className="admin-instructor-cell">{item.instructor_has_image && <img className="admin-instructor-avatar" src={`/api/backend/frontend/instructors/${item.instructor_id}/image`} alt="" />}<span className="admin-cell-text">{item.instructor_name}</span></div> : <span className="admin-cell-text">Unassigned</span>;
  return <span className="admin-cell-text" title={String(item[column] ?? "")}>{item[column] ?? "—"}</span>;
}

function UserForm({ item, onDone }) {
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const roleOptions = [
    ["learner", "Learner"],
    ["hirer", "Hirer"],
    ["admin", "Admin"],
    ...(item.id && item.role === "moderator" ? [["moderator", "Moderator (existing account)"]] : []),
  ];
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError("");
    const body = Object.fromEntries(new FormData(event.currentTarget));
    try { await api(`frontend/admin/users${item.id ? `/${item.id}` : ""}`, { method: item.id ? "PATCH" : "POST", body }); onDone(); }
    catch (saveError) { setError(saveError.message); }
    finally { setBusy(false); }
  }
  return <form className="form admin-record-form" onSubmit={submit}><div className="admin-form-grid">
    <label>Full name<input name="name" required minLength={2} maxLength={150} defaultValue={item.name || ""} /></label>
    <label>Email<input name="email" type="email" required defaultValue={item.email || ""} /></label>
    <label>Username<input name="username" required minLength={3} maxLength={40} pattern="[A-Za-z0-9_.-]+" defaultValue={item.username || ""} /></label>
    {!item.id && <label>Temporary password<input name="password" type="password" required minLength={8} autoComplete="new-password" /><small>At least 8 characters. Share it securely with the new user.</small></label>}
    <label>Role<select name="role" defaultValue={item.role || "learner"}>{roleOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    {item.id && <label>Account status<select name="account_status" defaultValue={item.account_status || "active"}><option value="active">Active</option><option value="suspended">Suspended</option><option value="deactivated">Deactivated</option></select></label>}
  </div>{error && <p className="notice error" role="alert">{error}</p>}<button className="button admin-save-button" disabled={busy}>{busy ? "Saving…" : item.id ? "Save changes" : "Create user"}</button></form>;
}

function RecordForm({ table, item, onDone }) {
  const categories = useResource("users/interests");
  const [categoryIds, setCategoryIds] = useState(() => (item.category_ids?.length ? item.category_ids : item.category_id ? [item.category_id] : []).map(String));
  const [speakers, setSpeakers] = useState(() => item.speakers || []);
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [coverPreview, setCoverPreview] = useState(item.has_cover_image ? `/api/backend/frontend/course-covers/${item.id}` : "");
  const [removeCover, setRemoveCover] = useState(false);
  useEffect(() => () => { if (coverPreview.startsWith("blob:")) URL.revokeObjectURL(coverPreview); }, [coverPreview]);
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError("");
    const raw = new FormData(event.currentTarget);
    const form = Object.fromEntries(raw.entries());
    for (const [field, type] of Object.entries(adminFields[table])) {
      if (type === "boolean") form[field] = form[field] === "true";
      if (type === "number") form[field] = form[field] === "" ? null : Number(form[field]);
      if (type === "datetime-local") form[field] = form[field] ? new Date(form[field]).toISOString() : null;
      if (field === "currency" && form[field]) form[field] = form[field].toUpperCase();
    }
    try {
      if (adminFields[table].category_id === "category" && table !== "jobs" && !categoryIds.length) throw new Error("Select at least one interest.");
      form.category_ids = JSON.stringify(categoryIds);
      if (table === "webinars") {
        if (!speakers.length) throw new Error("Add at least one speaker.");
        form.speaker_ids = JSON.stringify(speakers.map((speaker) => speaker.id));
      }
      delete form.category_id;
      if (table === "courses" && !form.instructor_id) throw new Error("Search for an instructor and select a profile before saving this course.");
      let body = form;
      if (table === "courses") {
        body = new FormData();
        for (const [field, value] of Object.entries(form)) {
          if (field === "cover_image") continue;
          body.append(field, value instanceof File ? value.name : String(value ?? ""));
        }
        const cover = raw.get("cover_image");
        if (!removeCover && cover instanceof File && cover.size > 0) body.append("cover_image", cover);
        body.set("remove_cover_image", String(removeCover));
      }
      await api(`frontend/admin/${table}${item.id ? `/${item.id}` : ""}`, { method: item.id ? "PATCH" : "POST", body });
      onDone();
    }
    catch (saveError) { setError(saveError.message); }
    finally { setBusy(false); }
  }
  return <form className="form admin-record-form" onSubmit={submit}><div className="admin-form-grid">
    {Object.entries(adminFields[table]).map(([field, type]) => {
      let value = item[field] ?? defaultFieldValue(field);
      if (type === "datetime-local" && value) { const date = new Date(value); value = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
      const label = humanize(field);
      if (type === "image") return <div className="admin-course-cover-editor wide" key={field}>
        <span className="admin-course-cover-label">Course cover</span>
        {coverPreview && !removeCover ? <img src={coverPreview} alt="Course cover preview" /> : <div className="admin-course-cover-placeholder"><BookOpen size={24} /></div>}
        <div className="admin-course-cover-actions">
          <label className="admin-photo-upload">Choose cover<input name="cover_image" type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; setRemoveCover(false); setCoverPreview(URL.createObjectURL(file)); }} /></label>
          {item.has_cover_image && <button type="button" className="admin-remove-photo" onClick={() => setRemoveCover((value) => !value)}>{removeCover ? "Keep current cover" : "Remove cover"}</button>}
          <small>JPEG, PNG, WebP or AVIF · up to 10 MB</small>
        </div>
      </div>;
      if (Array.isArray(type)) return <label key={field}>{label}<select name={field} defaultValue={value} required={requiredFields[table]?.includes(field)}>{type.map((option) => <option key={option} value={option}>{humanize(option)}</option>)}</select></label>;
      if (type === "category") return <CategoryPicker key={field} categories={categories.data || []} value={categoryIds} onChange={setCategoryIds} />;
      if (type === "instructor") return <InstructorPicker key={field} item={item} />;
      if (type === "speakers") return <SpeakerPicker key={field} value={speakers} onChange={setSpeakers} />;
      if (type === "boolean") return <label key={field}>{label}<select name={field} defaultValue={String(Boolean(value))}><option value="true">Yes</option><option value="false">No</option></select></label>;
      if (type === "textarea") return <label className="wide" key={field}>{label}<textarea name={field} defaultValue={value} rows={field === "description" || field === "criteria" ? 4 : 3} maxLength={10000} required={requiredFields[table]?.includes(field)} /></label>;
      return <label key={field}>{label}<input name={field} type={type} defaultValue={value} required={requiredFields[table]?.includes(field)} step={type === "number" ? "any" : undefined} min={type === "number" ? "0" : undefined} /></label>;
    })}
  </div>{error && <p className="notice error" role="alert">{error}</p>}<button className="button admin-save-button" disabled={busy}>{busy ? "Saving…" : item.id ? "Save changes" : "Create record"}</button></form>;
}

function InstructorPicker({ item }) {
  const [term, setTerm] = useState(item.instructor_name || "");
  const [query, setQuery] = useState(item.instructor_name || "");
  const [selectedId, setSelectedId] = useState(item.instructor_id || "");
  const [selectedName, setSelectedName] = useState(item.instructor_name || "");
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const resource = useResource(`frontend/admin/instructors?q=${encodeURIComponent(query)}&limit=10`);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(term.trim()), 220);
    return () => clearTimeout(timer);
  }, [term]);

  useEffect(() => {
    if (!open) return;
    const close = (event) => { if (!root.current?.contains(event.target)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  function choose(instructor) {
    setSelectedId(instructor.id);
    setSelectedName(instructor.name);
    setTerm(instructor.name);
    setOpen(false);
  }

  return <div className="admin-instructor-picker-field wide" ref={root}>
    <label htmlFor="course-instructor-search">Instructor</label>
    <div className="admin-instructor-searchbox"><Search size={18} /><input id="course-instructor-search" role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls="course-instructor-options" value={term} placeholder="Search instructor name…" onFocus={() => setOpen(true)} onChange={(event) => { const next = event.target.value; setTerm(next); if (next !== selectedName) { setSelectedId(""); setSelectedName(""); } setOpen(true); }} />{selectedId && <button type="button" aria-label="Clear instructor" onClick={() => { setSelectedId(""); setSelectedName(""); setTerm(""); setOpen(true); }}>×</button>}</div>
    <input type="hidden" name="instructor_id" value={selectedId} readOnly />
    {open && <div className="admin-instructor-results" id="course-instructor-options" role="listbox">
      {resource.loading ? <p>Searching instructors…</p> : resource.error ? <p role="alert">{resource.error}</p> : resource.data?.length ? resource.data.map((instructor) => <button type="button" role="option" aria-selected={selectedId === instructor.id} className="admin-instructor-option" key={instructor.id} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(instructor)}>
        {instructor.has_image ? <img className="admin-instructor-avatar" src={`/api/backend/frontend/instructors/${instructor.id}/image`} alt="" /> : <span className="admin-instructor-placeholder"><UserRound size={17} /></span>}
        <span><strong>{instructor.name}</strong><small>{instructor.designation || instructor.details || "Instructor"}</small></span>
      </button>) : <div className="admin-instructor-no-results"><strong>No instructors found</strong><small>Add an instructor profile in the Instructors management tab.</small></div>}
    </div>}
    <small className="admin-picker-hint">Choose one profile from the instructor list. Course ownership stays with your admin account.</small>
  </div>;
}

function SpeakerPicker({ value, onChange }) {
  const [term, setTerm] = useState("");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const resource = useResource(`frontend/admin/instructors?q=${encodeURIComponent(query)}&limit=10`);
  const chosen = new Set(value.map((speaker) => speaker.id));
  const options = (resource.data || []).filter((instructor) => !chosen.has(instructor.id));

  useEffect(() => {
    const timer = setTimeout(() => setQuery(term.trim()), 220);
    return () => clearTimeout(timer);
  }, [term]);
  useEffect(() => {
    if (!open) return;
    const close = (event) => { if (!root.current?.contains(event.target)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  return <div className="admin-instructor-picker-field wide" ref={root}>
    <label htmlFor="webinar-speaker-search">Speakers <span className="required-mark">(at least one)</span></label>
    <div className="speaker-chips">
      {value.length ? value.map((speaker) => <span className="speaker-chip" key={speaker.id}>
        {speaker.has_image ? <img className="admin-instructor-avatar" src={`/api/backend/frontend/instructors/${speaker.id}/image`} alt="" /> : <span className="admin-instructor-placeholder"><UserRound size={15} /></span>}
        <span><strong>{speaker.name}</strong>{speaker.designation && <small>{speaker.designation}</small>}</span>
        <button type="button" aria-label={`Remove ${speaker.name}`} onClick={() => onChange(value.filter((entry) => entry.id !== speaker.id))}><X size={14} /></button>
      </span>) : <p className="interest-picker-empty">No speakers yet. Search and add instructors below.</p>}
    </div>
    <div className="admin-instructor-searchbox"><Search size={18} /><input id="webinar-speaker-search" role="combobox" aria-autocomplete="list" aria-expanded={open} value={term} placeholder="Search instructors to add…" autoComplete="off" onFocus={() => setOpen(true)} onChange={(event) => { setTerm(event.target.value); setOpen(true); }} /></div>
    {open && <div className="admin-instructor-results" role="listbox">
      {resource.loading ? <p>Searching instructors…</p> : resource.error ? <p role="alert">{resource.error}</p> : options.length ? options.map((instructor) => <button type="button" role="option" aria-selected="false" key={instructor.id} onClick={() => { onChange([...value, instructor]); setTerm(""); setQuery(""); }}>
        {instructor.has_image ? <img className="admin-instructor-avatar" src={`/api/backend/frontend/instructors/${instructor.id}/image`} alt="" /> : <span className="admin-instructor-placeholder"><UserRound size={17} /></span>}
        <span><strong>{instructor.name}</strong><small>{instructor.designation || instructor.details || "Instructor"}</small></span>
      </button>) : <div className="admin-instructor-no-results"><strong>{value.length && !query ? "All matching instructors are added" : "No instructors found"}</strong><small>Add an instructor profile in the Instructors management tab.</small></div>}
    </div>}
  </div>;
}

function InstructorForm({ item, onDone }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(item.has_image ? `/api/backend/frontend/instructors/${item.id}/image` : "");
  const [removeImage, setRemoveImage] = useState(false);
  useEffect(() => () => { if (preview.startsWith("blob:")) URL.revokeObjectURL(preview); }, [preview]);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const body = new FormData(event.currentTarget);
    if (item.id) {
      body.set("remove_image", String(removeImage));
      if (removeImage) body.delete("image");
    }
    try {
      if (!item.id && !(body.get("image") instanceof File && body.get("image").size > 0)) throw new Error("Choose an instructor photo before saving.");
      await api(`frontend/admin/instructors${item.id ? `/${item.id}` : ""}`, { method: item.id ? "PATCH" : "POST", body });
      onDone();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setBusy(false);
    }
  }

  return <form className="form admin-record-form" onSubmit={submit}>
    <div className="admin-instructor-photo-editor">
      {preview && !removeImage ? <img src={preview} alt="Instructor photo preview" /> : <span><UserRound size={30} /></span>}
      <div><strong>{item.id ? "Instructor photo" : "Add a profile photo"}</strong><small>JPEG, PNG, WebP or AVIF</small><label className="admin-photo-upload">Choose image<input name="image" type="file" accept="image/jpeg,image/png,image/webp,image/avif" required={!item.id && !item.has_image} onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; setRemoveImage(false); setPreview(URL.createObjectURL(file)); }} /></label>
        {item.has_image && <label className="admin-remove-photo"><input type="checkbox" checked={removeImage} onChange={(event) => setRemoveImage(event.target.checked)} /> Remove current image</label>}
      </div>
    </div>
    <div className="admin-form-grid">
      <label className="wide">Instructor name<input name="name" required minLength={2} maxLength={150} defaultValue={item.name || ""} /></label>
      <label className="wide">Designation<input name="designation" maxLength={150} defaultValue={item.designation || ""} placeholder="Senior instructor, Product designer…" /></label>
      <label className="wide">Details<textarea name="details" rows={5} maxLength={10000} defaultValue={item.details || ""} placeholder="Experience, specialties, credentials, or a short introduction" /></label>
      <label>LinkedIn URL<input name="linkedin_url" type="url" maxLength={500} defaultValue={item.social_links?.linkedin || ""} placeholder="https://linkedin.com/in/…" /></label>
      <label>GitHub URL<input name="github_url" type="url" maxLength={500} defaultValue={item.social_links?.github || ""} placeholder="https://github.com/…" /></label>
      <label className="wide">Website URL<input name="website_url" type="url" maxLength={500} defaultValue={item.social_links?.website || ""} placeholder="https://example.com" /></label>
    </div>
    {error && <p className="notice error" role="alert">{error}</p>}
    <button className="button admin-save-button" disabled={busy}>{busy ? "Saving…" : item.id ? "Save instructor" : "Add instructor"}</button>
  </form>;
}

const requiredFields = {
  interest_categories: ["name", "slug", "icon", "submission_kind"],
  courses: ["title", "slug", "description", "category_id", "instructor_id", "price", "currency"],
  contests: ["name", "description", "category_id", "entry_fee", "currency", "starting_time", "ending_time"],
  webinars: ["name", "description", "category_id", "starting_time", "ending_time"],
  communities: ["name", "slug", "category_id", "requires_approval"],
  jobs: ["title", "description", "type", "currency"],
};
function defaultFieldValue(field) {
  if (field === "currency") return "BDT";
  if (field === "icon") return "sparkles";
  if (field === "status") return "draft";
  if (field === "type") return "general";
  if (["price", "entry_fee"].includes(field)) return 0;
  if (field === "salary_period") return "fixed";
  if (["is_active", "requires_approval"].includes(field)) return true;
  if (["is_remote", "is_private"].includes(field)) return false;
  return "";
}
function humanize(value) { return String(value).replaceAll("_", " ").replace(/^\w/, (letter) => letter.toUpperCase()); }
function statusLabel(value) { if (value === "true") return "Active"; if (value === "false") return "Inactive"; return String(value || "—").replaceAll("_", " ").replace(/^\w/, (letter) => letter.toUpperCase()); }
function capitalize(value) { return value ? value[0].toUpperCase() + value.slice(1) : value; }
