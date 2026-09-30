"use client";

import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { api } from "@/lib/api";
import { CategoryPicker, Dropdown, FileDropzone, useResource } from "../ui";

const monthValue = (value) => (value ? String(value).slice(0, 7) : "");

function SubmitRow({ error, busy, label }) {
  return (
    <>
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      <button className="button" disabled={busy}>
        {busy ? "Saving…" : label}
      </button>
    </>
  );
}

function DateRange({ start, end, current, setCurrent, currentLabel }) {
  return (
    <>
      <div className="grid two">
        <label>
          Start date
          <input type="month" name="start_date" required defaultValue={monthValue(start)} max={new Date().toISOString().slice(0, 7)} />
        </label>
        <label>
          End date
          <input type="month" name="end_date" defaultValue={monthValue(end)} disabled={current} required={!current} />
        </label>
      </div>
      <label className="check-row">
        <input type="checkbox" checked={current} onChange={(event) => setCurrent(event.target.checked)} />
        <span>{currentLabel}</span>
      </label>
    </>
  );
}

export function EducationForm({ entry, onDone }) {
  const [current, setCurrent] = useState(entry ? !entry.end_date : false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = Object.fromEntries(new FormData(event.currentTarget));
    const body = {
      institution: form.institution,
      degree: form.degree || undefined,
      field_of_study: form.field_of_study || undefined,
      start_date: form.start_date,
      end_date: current ? "" : form.end_date || "",
      grade: form.grade || undefined,
      description: form.description || undefined,
    };
    try {
      await api(`frontend/profile/education${entry ? `/${entry.id}` : ""}`, { method: entry ? "PATCH" : "POST", body });
      onDone();
    } catch (requestError) {
      setError(requestError.message);
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={submit}>
      <label>
        Institution
        <input name="institution" required maxLength={200} defaultValue={entry?.institution || ""} placeholder="University of Dhaka" />
      </label>
      <div className="grid two">
        <label>
          Degree
          <input name="degree" maxLength={200} defaultValue={entry?.degree || ""} placeholder="BSc" />
        </label>
        <label>
          Field of study
          <input name="field_of_study" maxLength={200} defaultValue={entry?.field_of_study || ""} placeholder="Computer Science" />
        </label>
      </div>
      <DateRange start={entry?.start_date} end={entry?.end_date} current={current} setCurrent={setCurrent} currentLabel="I currently study here" />
      <label>
        Grade (optional)
        <input name="grade" maxLength={100} defaultValue={entry?.grade || ""} placeholder="CGPA 3.8 / 4.0" />
      </label>
      <label>
        Description (optional)
        <textarea name="description" rows={3} maxLength={2000} defaultValue={entry?.description || ""} />
      </label>
      <SubmitRow error={error} busy={busy} label={entry ? "Save changes" : "Add education"} />
    </form>
  );
}

export function ExperienceForm({ entry, onDone }) {
  const categories = useResource("users/interests");
  const [category, setCategory] = useState(entry?.category_id ? String(entry.category_id) : "");
  const [current, setCurrent] = useState(entry ? !entry.end_date : false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (!category) {
      setError("Choose the interest this experience belongs to.");
      return;
    }
    setBusy(true);
    const form = Object.fromEntries(new FormData(event.currentTarget));
    const body = {
      title: form.title,
      workplace: form.workplace,
      category_id: category,
      location: form.location || undefined,
      start_date: form.start_date,
      end_date: current ? "" : form.end_date || "",
      description: form.description || undefined,
    };
    try {
      await api(`frontend/profile/experience${entry ? `/${entry.id}` : ""}`, { method: entry ? "PATCH" : "POST", body });
      onDone();
    } catch (requestError) {
      setError(requestError.message);
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={submit}>
      <label>
        Title
        <input name="title" required maxLength={200} defaultValue={entry?.title || ""} placeholder="Frontend Developer" />
      </label>
      <label>
        Workplace
        <input name="workplace" required maxLength={200} defaultValue={entry?.workplace || ""} placeholder="Company or organization" />
      </label>
      <div className="field-block">
        <span className="field-label">Interest category</span>
        <Dropdown
          ariaLabel="Interest category of this experience"
          value={category}
          onChange={setCategory}
          placeholder="Which interest does this belong to?"
          options={(categories.data || []).map((item) => ({ value: String(item.id), label: item.name, iconName: item.icon }))}
          hasIcon
          disabled={!categories.data?.length}
        />
      </div>
      <label>
        Location (optional)
        <input name="location" maxLength={200} defaultValue={entry?.location || ""} placeholder="Dhaka, Bangladesh" />
      </label>
      <DateRange start={entry?.start_date} end={entry?.end_date} current={current} setCurrent={setCurrent} currentLabel="I currently work here" />
      <label>
        Description (optional)
        <textarea name="description" rows={4} maxLength={2000} defaultValue={entry?.description || ""} placeholder="What did you work on?" />
      </label>
      <SubmitRow error={error} busy={busy} label={entry ? "Save changes" : "Add experience"} />
    </form>
  );
}

function MediaField({ label, hint, shape, existingUrl, file, onFile, removed, onRemoved, fallback }) {
  const [preview, setPreview] = useState("");
  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const shown = preview || (!removed && existingUrl) || "";
  return (
    <div className="field-block media-field">
      <span className="field-label">{label}</span>
      <div className={`media-field-preview ${shape}`}>
        {shown ? <img src={shown} alt={`${label} preview`} /> : <span>{fallback}</span>}
      </div>
      <FileDropzone
        accept="image/jpeg,image/png,image/webp,image/avif"
        file={file}
        hint={hint}
        label={`Drag and drop a ${shape === "round" ? "picture" : "cover image"}`}
        onFile={(chosen) => {
          onFile(chosen);
          if (chosen) onRemoved(false);
        }}
      />
      {existingUrl && !file && (
        <button type="button" className="profile-media-remove" onClick={() => onRemoved(!removed)}>
          {removed ? `Keep current ${shape === "round" ? "picture" : "cover"}` : `Remove ${shape === "round" ? "picture" : "cover"}`}
        </button>
      )}
    </div>
  );
}

export function EditProfileForm({ profile, onDone }) {
  const categories = useResource("users/interests");
  const personal = profile.personal || {};
  const [interests, setInterests] = useState(() => (profile.interests || []).map((item) => String(item.id)));
  const [picture, setPicture] = useState(null);
  const [cover, setCover] = useState(null);
  const [removePicture, setRemovePicture] = useState(false);
  const [removeCover, setRemoveCover] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = new FormData(event.currentTarget);
      body.set("interest_ids", JSON.stringify(interests));
      body.set("remove_picture", String(removePicture && !picture));
      body.set("remove_cover_image", String(removeCover && !cover));
      if (picture) body.set("picture", picture);
      if (cover) body.set("cover_image", cover);
      await api("frontend/profile", { method: "PATCH", body });
      onDone();
    } catch (requestError) {
      setError(requestError.message);
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={submit}>
      <div className="grid two">
        <label>
          Name
          <input name="name" required minLength={2} maxLength={150} defaultValue={profile.name} />
        </label>
        <label>
          Username
          <input name="username" required pattern="[A-Za-z0-9_.-]{3,40}" defaultValue={profile.username} />
        </label>
      </div>
      <label>
        Headline
        <input name="headline" maxLength={200} defaultValue={profile.headline || ""} placeholder="Full-stack developer · Open-source enthusiast" />
      </label>
      <label>
        About you
        <textarea name="bio" rows={5} maxLength={3000} defaultValue={profile.bio || ""} placeholder="Tell people about yourself, your goals and what you’re working on." />
      </label>

      <div className="grid two">
        <MediaField
          label="Profile picture"
          hint="JPEG, PNG, WebP or AVIF · up to 10 MB"
          shape="round"
          existingUrl={profile.has_picture ? `/api/backend/frontend/profile/${profile.id}/picture` : ""}
          file={picture}
          onFile={setPicture}
          removed={removePicture}
          onRemoved={setRemovePicture}
          fallback={profile.name?.[0]}
        />
        <MediaField
          label="Cover image"
          hint="Wide image works best · up to 10 MB"
          shape="wide"
          existingUrl={profile.has_cover_image ? `/api/backend/frontend/profile/${profile.id}/cover` : ""}
          file={cover}
          onFile={setCover}
          removed={removeCover}
          onRemoved={setRemoveCover}
          fallback=""
        />
      </div>

      <CategoryPicker categories={categories.data || []} value={interests} onChange={setInterests} legend="Interests" />

      <fieldset className="private-fieldset">
        <legend>
          <Lock size={14} /> Personal details
        </legend>
        <p className="room-muted">Only you and Uddeepto admins can see these details.</p>
        <div className="grid two">
          <label>
            Phone number
            <input name="phone" type="tel" maxLength={30} defaultValue={personal.phone || ""} placeholder="+880 1XXX-XXXXXX" />
          </label>
          <label>
            Date of birth
            <input name="birth_date" type="date" max={new Date().toISOString().slice(0, 10)} defaultValue={personal.birth_date || ""} />
          </label>
        </div>
        <label>
          Gender
          <select name="gender" defaultValue={personal.gender || ""}>
            <option value="">Prefer not to say</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label>
          Current address
          <textarea name="current_address" rows={2} maxLength={500} defaultValue={personal.current_address || ""} />
        </label>
        <label>
          Permanent address
          <textarea name="permanent_address" rows={2} maxLength={500} defaultValue={personal.permanent_address || ""} />
        </label>
      </fieldset>

      <SubmitRow error={error} busy={busy} label="Save profile" />
    </form>
  );
}
