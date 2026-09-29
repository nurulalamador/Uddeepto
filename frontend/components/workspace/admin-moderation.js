"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, Eye, Flag, MessageSquareText, ShieldAlert } from "lucide-react";
import { api } from "@/lib/api";
import { useResource, State, Empty, Badge, Modal, SearchBox } from "../ui";

const PAGE_SIZE = 20;
const reportStatuses = ["pending", "reviewing", "resolved", "dismissed"];

export default function AdminModeration() {
  const [view, setView] = useState("reports");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState(null);
  const [notice, setNotice] = useState("");

  useEffect(() => { const timer = setTimeout(() => { setQuery(search.trim()); setPage(0); }, 250); return () => clearTimeout(timer); }, [search]);
  const params = useMemo(() => {
    const value = new URLSearchParams({ offset: String(page * PAGE_SIZE), limit: String(PAGE_SIZE), sort: "created_at", direction: "desc" });
    if (query) value.set("q", query);
    if (status) value.set("status", status);
    return value.toString();
  }, [view, page, query, status]);
  const resource = useResource(`frontend/admin/${view === "reports" ? "reported_showcase_posts" : "showcase_posts"}?${params}`);
  const rows = resource.data || [];

  async function updateReport(item, body) {
    await api(`frontend/admin/reported_showcase_posts/${item.id}`, { method: "PATCH", body });
    setEditing(null); setNotice("Report review saved."); resource.reload();
  }
  async function hidePost(item) {
    if (!confirm("Hide this post from the community? Its reports will remain in the moderation queue.")) return;
    try { await api(`frontend/admin/showcase_posts/${item.id}`, { method: "DELETE" }); setNotice("Post hidden from the community."); resource.reload(); }
    catch (error) { setNotice(error.message); }
  }
  function changeView(value) { setView(value); setPage(0); setStatus(""); setSearch(""); setQuery(""); setNotice(""); }

  return <div className="admin-moderation">
    <header className="admin-page-heading"><div><p className="eyebrow">SAFETY & QUALITY</p><h1>Moderation</h1><p>Review community reports and take action on reported posts.</p></div><span className="admin-live-pill"><ShieldAlert size={16} /> Moderation tools</span></header>
    <div className="admin-moderation-tabs" role="tablist" aria-label="Moderation records">
      <button role="tab" aria-selected={view === "reports"} className={view === "reports" ? "active" : ""} onClick={() => changeView("reports")}><Flag size={17} /> Report queue</button>
      <button role="tab" aria-selected={view === "posts"} className={view === "posts" ? "active" : ""} onClick={() => changeView("posts")}><MessageSquareText size={17} /> Community posts</button>
    </div>
    {notice && <p className="notice success admin-operation-notice" role="status"><Check size={17} />{notice}<button onClick={() => setNotice("")} aria-label="Dismiss message">×</button></p>}
    <section className="card admin-table-panel">
      <div className="admin-table-heading"><div><h2>{view === "reports" ? "Reported posts" : "Community posts"}</h2><p>{view === "reports" ? "Review the reason and context, then record a decision." : "Review public and private community posts."}</p></div><Link href="/admin" className="admin-text-link">Management <ArrowUpRight size={15} /></Link></div>
      <div className="admin-filters moderation-filters"><SearchBox value={search} onChange={setSearch} placeholder={view === "reports" ? "Search reports…" : "Search posts…"}/><label className="admin-filter-select"><span>Status</span><select value={status} onChange={(event) => { setStatus(event.target.value); setPage(0); }}><option value="">All statuses</option>{(view === "reports" ? reportStatuses : ["public", "private"]).map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></label></div>
      <State resource={resource}>{rows.length ? <div className="table-wrap admin-table-wrap"><table className="admin-table moderation-table"><thead><tr>{view === "reports" ? <><th>Reason / reported content</th><th>Reported by</th><th>Post author</th><th>Status</th><th>Reported</th><th>Action</th></> : <><th>Post content</th><th>Author</th><th>Interest</th><th>Visibility</th><th>Posted</th><th>Action</th></>}</tr></thead>
        <tbody>{rows.map((item) => view === "reports" ? <tr key={item.id}><td><div className="admin-primary-cell"><strong>{item.reason?.replaceAll("_", " ")}</strong><small className="moderation-excerpt" title={item.post_content}>{item.post_content || "Post was removed"}</small>{item.details && <small>“{item.details}”</small>}</div></td><td>{item.reporter_name}</td><td>{item.post_creator_name}</td><td><Badge>{item.status}</Badge></td><td>{formatDate(item.created_at)}</td><td><div className="admin-row-actions">{!item.deleted_at && <Link href={`/showcase/${item.post_id}`} className="icon-button" aria-label="View reported post" title="View post"><Eye size={16} /></Link>}<button className="button secondary moderation-review" onClick={() => setEditing(item)}>Review</button></div></td></tr> : <tr key={item.id}><td><div className="admin-primary-cell"><strong className="moderation-excerpt" title={item.content}>{item.content}</strong><small>Community post</small></div></td><td>{item.creator_name}</td><td>{item.category_name}</td><td><Badge>{item.visibility}</Badge></td><td>{formatDate(item.created_at)}</td><td><div className="admin-row-actions"><Link href={`/showcase/${item.id}`} className="icon-button" aria-label="View post" title="View post"><Eye size={16} /></Link>{!item.deleted_at && <button className="icon-button danger" aria-label="Hide post" title="Hide post" onClick={() => void hidePost(item)}><span className="admin-remove-mark">×</span></button>}</div></td></tr>)}</tbody>
      </table></div> : <Empty title={view === "reports" ? "No reports match" : "No posts match"} text="Try another search or status filter." />}</State>
      {rows.length > 0 && <div className="admin-pagination"><span>Page {page + 1}</span><div><button className="button secondary" disabled={!page} onClick={() => setPage((value) => value - 1)}>Previous</button><button className="button secondary" disabled={rows.length < PAGE_SIZE} onClick={() => setPage((value) => value + 1)}>Next</button></div></div>}
    </section>
    {editing && <Modal title="Review report" onClose={() => setEditing(null)}><ReportReview item={editing} onSave={(body) => updateReport(editing, body)} /></Modal>}
  </div>;
}

function ReportReview({ item, onSave }) {
  const [status, setStatus] = useState(item.status || "pending");
  const [note, setNote] = useState(item.resolution_note || "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event) { event.preventDefault(); setBusy(true); setError(""); try { await onSave({ status, resolution_note: note }); } catch (saveError) { setError(saveError.message); } finally { setBusy(false); } }
  return <form className="form admin-record-form" onSubmit={submit}>
    <div className="report-context"><span>Reason</span><strong>{item.reason?.replaceAll("_", " ")}</strong><span>Reported by {item.reporter_name} about {item.post_creator_name}</span><blockquote>{item.post_content || "The reported post has been removed."}</blockquote>{item.details && <p>{item.details}</p>}{!item.deleted_at && <Link className="admin-text-link" href={`/showcase/${item.post_id}`} target="_blank">Open post <ArrowUpRight size={15} /></Link>}</div>
    <label>Decision<select value={status} onChange={(event) => setStatus(event.target.value)}>{reportStatuses.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></label>
    <label>Resolution note<textarea rows={3} maxLength={3000} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional note for the moderation record" /></label>
    {error && <p className="notice error" role="alert">{error}</p>}<button className="button admin-save-button" disabled={busy}>{busy ? "Saving…" : "Save review"}</button>
  </form>;
}

function formatDate(value) { return value ? new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value)) : "—"; }
