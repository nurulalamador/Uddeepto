"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, LayoutDashboard, ShieldCheck, SlidersHorizontal, Users } from "lucide-react";
import { api } from "@/lib/api";
import { useUser } from "../shell";
import { ThemeToggle } from "../theme";
import { State, UserAvatar, useResource } from "../ui";

const densityKey = "uddeepto-admin-table-density";

export default function AdminSettings() {
  const user = useUser();
  const resource = useResource("frontend/admin/settings");
  const [density, setDensity] = useState("comfortable");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem(densityKey) || "comfortable";
    setDensity(saved);
    document.documentElement.dataset.adminDensity = saved;
  }, []);
  function changeDensity(value) { setDensity(value); localStorage.setItem(densityKey, value); document.documentElement.dataset.adminDensity = value; }
  async function updateSetting(key, value) {
    setBusy(key); setNotice(""); setError("");
    try { await api("frontend/admin/settings", { method: "PATCH", body: { [key]: value } }); resource.setData((current) => ({ ...current, [key]: value })); setNotice("Platform setting saved."); }
    catch (saveError) { setError(saveError.message); }
    finally { setBusy(""); }
  }

  return <div className="admin-settings">
    <header className="admin-page-heading"><div><p className="eyebrow">PLATFORM CONFIGURATION</p><h1>Settings</h1></div></header>
    {notice && <p className="notice success admin-operation-notice" role="status"><Check size={17} />{notice}<button onClick={() => setNotice("")} aria-label="Dismiss message">×</button></p>}
    {error && <p className="notice error" role="alert">{error}</p>}
    <State resource={resource}>{resource.data && <div className="admin-settings-grid">
      <section className="card admin-settings-card"><div className="admin-panel-heading"><div><span className="admin-panel-icon orange"><ShieldCheck size={18} /></span><h2>Platform policy</h2></div></div>
        <SettingRow title="Public registration" description="Allow people to sign up. Admin-created accounts are unaffected." value={resource.data.registration_open} busy={busy === "registration_open"} onChange={(value) => void updateSetting("registration_open", value)} />
        <SettingRow title="Require admin review" description="Creators can save content as a draft. Admins approve courses, contests, webinars and jobs before publishing." value={resource.data.content_review_required} busy={busy === "content_review_required"} onChange={(value) => void updateSetting("content_review_required", value)} />
        <p className="admin-settings-footnote">Changes save immediately and are enforced by the backend.</p>
      </section>
      <section className="card admin-settings-card"><div className="admin-panel-heading"><div><span className="admin-panel-icon"><SlidersHorizontal size={18} /></span><h2>Workspace preferences</h2></div></div>
        <div className="admin-setting-row"><div><strong>Color theme</strong><small>Choose the light or dark workspace appearance.</small></div><ThemeToggle /></div>
        <div className="admin-setting-row"><div><strong>Management table spacing</strong><small>Stored in this browser for your admin workspace.</small></div><div className="admin-segmented-control" role="group" aria-label="Management table spacing"><button className={density === "comfortable" ? "active" : ""} aria-pressed={density === "comfortable"} onClick={() => changeDensity("comfortable")}>Comfortable</button><button className={density === "compact" ? "active" : ""} aria-pressed={density === "compact"} onClick={() => changeDensity("compact")}>Compact</button></div></div>
      </section>
      <section className="card admin-settings-card admin-access-card"><div className="admin-panel-heading"><div><span className="admin-panel-icon orange"><ShieldCheck size={18} /></span><h2>Administrator access</h2></div></div>
        <div className="admin-current-user"><UserAvatar id={user.id} name={user.name} hasPicture={user.has_picture} /><div><strong>{user.name}</strong><small>{user.email || user.username || "Signed in administrator"}</small></div><span className="admin-live-pill"><Check size={14} /> Active</span></div>
        <p className="admin-settings-copy">Administrator navigation is isolated from learner and hirer workspaces. User roles and account status are managed from the Users table.</p><Link className="button secondary" href="/admin?tab=users"><Users size={17} /> Manage user access <ArrowRight size={16} /></Link>
      </section>
      <section className="card admin-settings-card admin-permissions-card"><div className="admin-panel-heading"><div><span className="admin-panel-icon green"><LayoutDashboard size={18} /></span><h2>Admin workspace</h2></div></div>
        <div className="admin-permission-list"><div><span><LayoutDashboard size={16} /> Control center</span><b>Overview</b></div><div><span><Users size={16} /> Management</span><b>Accounts & platform records</b></div><div><span><ShieldCheck size={16} /> Moderation</span><b>Reports & community posts</b></div><div><span><SlidersHorizontal size={16} /> Settings</span><b>Registration & review policy</b></div></div>
        <p className="admin-settings-copy">The application role is checked again by the backend for every management request.</p><Link className="button secondary" href="/dashboard"><LayoutDashboard size={17} /> Return to overview <ArrowRight size={16} /></Link>
      </section>
    </div>}</State>
  </div>;
}

function SettingRow({ title, description, value, busy, onChange }) {
  return <div className="admin-setting-row"><div><strong>{title}</strong><small>{description}</small></div><button type="button" className={`admin-switch${value ? " enabled" : ""}`} role="switch" aria-checked={Boolean(value)} aria-label={title} disabled={busy} onClick={() => onChange(!value)}><span /><b>{busy ? "Saving" : value ? "On" : "Off"}</b></button></div>;
}
