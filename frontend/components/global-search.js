"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Briefcase, BookOpen, Search, Trophy, UserRound, Users, Video, X } from "lucide-react";
import { api } from "@/lib/api";

export const typeMeta = {
  users: { label: "People", Icon: UserRound },
  courses: { label: "Courses", Icon: BookOpen },
  contests: { label: "Contests", Icon: Trophy },
  webinars: { label: "Webinars", Icon: Video },
  jobs: { label: "Jobs", Icon: Briefcase },
  communities: { label: "Communities", Icon: Users },
};

export function ResultThumb({ item }) {
  const { Icon } = typeMeta[item.type];
  return item.image ? (
    <img className={`gs-thumb ${item.type === "users" ? "round" : ""}`} src={item.image} alt="" loading="lazy" />
  ) : (
    <span className={`gs-thumb icon ${item.type}`}>
      <Icon size={18} />
    </span>
  );
}

export function ResultRow({ item, active = false, onNavigate, id }) {
  return (
    <Link
      id={id}
      href={item.href}
      role="option"
      aria-selected={active}
      className={`gs-item${active ? " active" : ""}`}
      onClick={onNavigate}
      onMouseDown={(event) => event.preventDefault()}
    >
      <ResultThumb item={item} />
      <span className="gs-item-text">
        <strong>{item.title}</strong>
        {item.subtitle && <small>{item.subtitle}</small>}
      </span>
      {item.meta && <span className="gs-item-meta">{item.meta}</span>}
    </Link>
  );
}

/** Search box in the top bar with a floating preview of matches across the whole platform. */
export default function GlobalSearch() {
  const router = useRouter();
  const root = useRef(null);
  const input = useRef(null);
  const [value, setValue] = useState("");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [active, setActive] = useState(-1);
  const trimmed = query.trim();

  useEffect(() => {
    const timer = setTimeout(() => setQuery(value), 250);
    return () => clearTimeout(timer);
  }, [value]);

  useEffect(() => {
    if (trimmed.length < 2) {
      setData(null);
      setLoading(false);
      setError("");
      return;
    }
    let live = true;
    setLoading(true);
    setError("");
    api(`frontend/search?q=${encodeURIComponent(trimmed)}&limit=3`)
      .then((result) => live && (setData(result), setActive(-1)))
      .catch((requestError) => live && setError(requestError.message))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [trimmed]);

  const groups = useMemo(() => (data ? data.types.filter((type) => data.results[type]?.length).map((type) => ({ type, items: data.results[type], count: data.counts[type] })) : []), [data]);
  const flat = useMemo(() => groups.flatMap((group) => group.items), [groups]);
  const totalCount = data ? Object.values(data.counts).reduce((sum, count) => sum + count, 0) : 0;

  const close = useCallback(() => {
    setOpen(false);
    setExpanded(false);
    setActive(-1);
  }, []);

  useEffect(() => {
    if (!open && !expanded) return;
    const onPointer = (event) => {
      if (!root.current?.contains(event.target)) close();
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open, expanded, close]);

  // Press "/" anywhere to start searching.
  useEffect(() => {
    const onKey = (event) => {
      const target = event.target;
      const typing = target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
      if (event.key === "/" && !typing && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        setExpanded(true);
        setOpen(true);
        setTimeout(() => input.current?.focus(), 0);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function showAll() {
    if (trimmed.length < 2) return;
    close();
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  function onKeyDown(event) {
    if (event.key === "Escape") {
      close();
      input.current?.blur();
    } else if (event.key === "ArrowDown" && flat.length) {
      event.preventDefault();
      setOpen(true);
      setActive((current) => (current + 1) % flat.length);
    } else if (event.key === "ArrowUp" && flat.length) {
      event.preventDefault();
      setActive((current) => (current <= 0 ? flat.length - 1 : current - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (active >= 0 && flat[active]) {
        close();
        router.push(flat[active].href);
      } else showAll();
    }
  }

  const showPanel = open && value.trim().length > 0;
  let index = -1;

  return (
    <div className={`global-search${expanded ? " expanded" : ""}`} ref={root}>
      <button type="button" className="gs-toggle icon-button" aria-label="Search" onClick={() => { setExpanded(true); setOpen(true); setTimeout(() => input.current?.focus(), 0); }}>
        <Search size={20} />
      </button>
      <div className="gs-box" role="search">
        <Search size={17} aria-hidden="true" />
        <input
          ref={input}
          type="search"
          role="combobox"
          aria-label="Search Uddeepto"
          aria-expanded={showPanel}
          aria-controls="gs-results"
          aria-activedescendant={active >= 0 ? `gs-item-${active}` : undefined}
          autoComplete="off"
          placeholder="Search people, courses, jobs…"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {value ? (
          <button type="button" className="gs-clear" aria-label="Clear search" onClick={() => { setValue(""); setQuery(""); input.current?.focus(); }}>
            <X size={15} />
          </button>
        ) : (
          <kbd aria-hidden="true">/</kbd>
        )}
      </div>

      {showPanel && (
        <div className="gs-panel" id="gs-results" role="listbox" aria-label="Search results">
          {trimmed.length < 2 ? (
            <p className="gs-note">Keep typing — at least 2 characters.</p>
          ) : error ? (
            <p className="gs-note error">{error}</p>
          ) : loading && !data ? (
            <p className="gs-note">
              <span className="spinner" /> Searching…
            </p>
          ) : groups.length ? (
            <>
              {groups.map((group) => {
                const { label, Icon } = typeMeta[group.type];
                return (
                  <section key={group.type} className="gs-group" aria-label={label}>
                    <h3>
                      <Icon size={14} /> {label} <span>{group.count}</span>
                    </h3>
                    {group.items.map((item) => {
                      index += 1;
                      return <ResultRow key={`${item.type}-${item.id}`} item={item} id={`gs-item-${index}`} active={index === active} onNavigate={close} />;
                    })}
                  </section>
                );
              })}
            </>
          ) : (
            <p className="gs-note">
              No results for “{trimmed}”. Try a different word.
            </p>
          )}
          {trimmed.length >= 2 && !error && (
            <button type="button" className="gs-all" onClick={showAll}>
              <span>
                Show all results for “{trimmed}”{totalCount ? ` (${totalCount})` : ""}
              </span>
              <ArrowRight size={16} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
