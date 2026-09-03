"use client";

import { useEffect, useMemo, useState } from "react";

function secondaryText(resource, item) {
  if (resource === "courses") return [item.category, item.level].filter(Boolean).join(" · ");
  if (resource === "contests") return [item.organizer, item.status].filter(Boolean).join(" · ");
  if (resource === "communities") return [item.visibility, `${item.memberCount ?? 0} members`].filter(Boolean).join(" · ");
  if (resource === "jobs") return [item.company, item.location, item.type].filter(Boolean).join(" · ");
  return "";
}

function descriptionText(resource, item) {
  if (resource === "courses") return item.shortDescription || item.description;
  return item.description || item.requirements || "No description available yet.";
}

export default function ResourceList({ resource, title, subtitle }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/backend/${resource}?limit=40`, { cache: "no-store" });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.error?.message || `Unable to load ${resource}.`);
        if (active) setItems(Array.isArray(data.items) ? data.items : []);
      } catch (err) {
        if (active) setError(err.message || `Unable to load ${resource}.`);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [resource]);

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return items;
    return items.filter((item) => JSON.stringify(item).toLowerCase().includes(value));
  }, [items, query]);

  return (
    <div>
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-600">Workspace</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">{title}</h1>
          <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
        </div>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${title.toLowerCase()}...`} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-slate-950 focus:ring-4 focus:ring-slate-100 sm:max-w-xs" />
      </div>

      {loading ? (
        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((key) => <div key={key} className="h-48 animate-pulse rounded-2xl border border-slate-200 bg-white" />)}
        </div>
      ) : error ? (
        <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-medium text-red-700">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <h2 className="text-lg font-bold">No {title.toLowerCase()} found</h2>
          <p className="mt-2 text-sm text-slate-500">Published data from your backend will appear here.</p>
        </div>
      ) : (
        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((item) => (
            <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 h-2 w-12 rounded-full bg-slate-950" />
              <h2 className="text-lg font-bold leading-snug">{item.title || item.name || "Untitled"}</h2>
              <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-blue-600">{secondaryText(resource, item) || "Available"}</p>
              <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-600">{descriptionText(resource, item)}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
