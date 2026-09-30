"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { Dropdown, useResource } from "../ui";
import { LocationPicker } from "./job-map";

export const JOB_TYPES = ["permanent", "contract", "internship", "part_time", "freelance", "one_time"];
export const typeLabel = (value) => String(value || "").replaceAll("_", " ");

export default function JobForm({ onDone }) {
  const categories = useResource("users/interests");
  const [category, setCategory] = useState("");
  const [remote, setRemote] = useState(false);
  const [position, setPosition] = useState(null);
  const [location, setLocation] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (!category) {
      setError("Choose the interest category this job belongs to.");
      return;
    }
    if (!remote && !position) {
      setError("Pick the job location on the map.");
      return;
    }
    setBusy(true);
    try {
      const form = Object.fromEntries(new FormData(event.currentTarget));
      const body = {
        title: form.title,
        description: form.description,
        type: form.type,
        category_id: category,
        is_remote: remote,
        location: location.trim() || null,
        latitude: position ? position.lat : null,
        longitude: position ? position.lng : null,
        salary_min: form.salary_min ? Number(form.salary_min) : null,
        salary_max: form.salary_max ? Number(form.salary_max) : null,
        application_deadline: form.application_deadline ? new Date(form.application_deadline).toISOString() : null,
        status: "open",
      };
      await api("jobs", { method: "POST", body });
      onDone();
    } catch (requestError) {
      setError(requestError.message);
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={submit}>
      <label>
        Job title
        <input name="title" required maxLength={250} />
      </label>
      <label>
        Description and requirements
        <textarea name="description" required rows={6} />
      </label>
      <div className="field-block">
        <span className="field-label">Interest category</span>
        <Dropdown
          ariaLabel="Interest category of this job"
          value={category}
          onChange={setCategory}
          placeholder="Choose a category"
          options={(categories.data || []).map((item) => ({ value: String(item.id), label: item.name, iconName: item.icon }))}
          hasIcon
          disabled={!categories.data?.length}
        />
      </div>
      <div className="grid two">
        <label>
          Type
          <select name="type" defaultValue="permanent">
            {JOB_TYPES.map((type) => (
              <option key={type} value={type}>
                {typeLabel(type)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Workplace
          <select value={remote ? "remote" : "onsite"} onChange={(event) => setRemote(event.target.value === "remote")}>
            <option value="onsite">On-site / Hybrid</option>
            <option value="remote">Remote</option>
          </select>
        </label>
        <label>
          Minimum salary (BDT)
          <input name="salary_min" type="number" min="0" step="0.01" />
        </label>
        <label>
          Maximum salary (BDT)
          <input name="salary_max" type="number" min="0" step="0.01" />
        </label>
        <label>
          Application deadline
          <input name="application_deadline" type="datetime-local" />
        </label>
        <label>
          Address / area
          <input value={location} onChange={(event) => setLocation(event.target.value)} maxLength={250} placeholder="Gulshan, Dhaka" />
        </label>
      </div>

      <div className="field-block">
        <span className="field-label">Location on map {remote ? "(optional for remote jobs)" : ""}</span>
        <LocationPicker value={position} onChange={setPosition} onAddress={(address) => setLocation((current) => current || address.slice(0, 250))} />
      </div>

      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <button className="button" disabled={busy}>
        {busy ? "Publishing…" : "Publish job"}
      </button>
    </form>
  );
}
