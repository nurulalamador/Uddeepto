"use client";
import { useEffect, useState, useRef } from "react";
import {
  X,
  Plus,
  Search,
  ArrowLeft,
  ArrowRight,
  Inbox,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Upload,
  Palette,
  Spline,
  Star,
} from "lucide-react";
import { api } from "@/lib/api";
export function useResource(path) {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [version, setVersion] = useState(0);
  useEffect(() => {
    if (!path) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError("");
    api(path)
      .then((x) => {
        if (active) setData(x);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [path, version]);
  return {
    data,
    error,
    loading,
    reload: () => setVersion((v) => v + 1),
    setData,
  };
}
export function State({ resource, children }) {
  if (resource.loading)
    return (
      <div className="loading" role="status">
        <span className="spinner" /> Loading your workspace…
      </div>
    );
  if (resource.error)
    return (
      <div className="notice error" role="alert">
        {resource.error}
        <button onClick={resource.reload}>Try again</button>
      </div>
    );
  return children;
}
export function Empty({
  title = "Nothing here yet",
  text = "Check back soon or try a different filter.",
}) {
  return (
    <div className="empty">
      <Inbox size={32} />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
export function Heading({ eyebrow, title, description, children }) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children}
    </div>
  );
}
export function SearchBox({ value, onChange, placeholder = "Search…" }) {
  return (
    <div className="search-box">
      <Search size={19} />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
export function Pager({ page, setPage, hasMore }) {
  return (
    <div className="pager">
      <button disabled={!page} onClick={() => setPage(page - 1)}>
        <ArrowLeft size={16} /> Previous
      </button>
      <span>Page {page + 1}</span>
      <button disabled={!hasMore} onClick={() => setPage(page + 1)}>
        Next <ArrowRight size={16} />
      </button>
    </div>
  );
}
export function Modal({ title, children, onClose }) {
  const ref = useRef();
  useEffect(() => {
    const el = ref.current;
    el.showModal();
    return () => el.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <header>
        <div className="title">{title}</div>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={24}/>
        </button>
      </header>
      <div className="body">{children}</div>
    </dialog>
  );
}
export function Action({ children, onClick, className = "button", ...props }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <>
      <button
        {...props}
        className={className}
        disabled={busy || props.disabled}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            await onClick();
          } catch (e) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Please wait…" : children}
      </button>
      {error && (
        <span role="alert" className="inline-error">
          {error}
        </span>
      )}
    </>
  );
}
export const date = (value) =>
  value
    ? new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "Not scheduled";
export const money = (value, currency = "BDT") =>
  Number(value) === 0
    ? "Free"
    : new Intl.NumberFormat("en", { style: "currency", currency }).format(
        Number(value),
      );
export function Badge({ children }) {
  return (
    <span className="badge">{String(children || "").replaceAll("_", " ")}</span>
  );
}

export function InterestIcon({ iconName, size = 18 }) {
  if (iconName === "palette") return <Palette size={size} aria-hidden="true" />;
  if (iconName === "spline-pointer") return <Spline size={size} aria-hidden="true" />;
  return <Star size={size} aria-hidden="true" />;
}

export function Dropdown({
  options,
  value,
  onChange,
  ariaLabel,
  hasIcon = false,
  name,
  required = false,
  placeholder = "Choose an option",
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selected = options.find(
    (option) => String(option.value ?? "") === String(value ?? ""),
  );

  useEffect(() => {
    function close(event) {
      if (!ref.current?.contains(event.target)) setOpen(false);
    }

    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div className="dropdown" ref={ref}>
      <button
        type="button"
        className="trigger-button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-required={required || undefined}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <div className="row">
          {hasIcon && <InterestIcon iconName={selected?.iconName} size={18} />}
          <span className={!selected ? "placeholder" : undefined}>
            {selected?.label || placeholder}
          </span>
        </div>
        <ChevronDown size={17} />
      </button>
      {name && <input type="hidden" name={name} value={value ?? ""} />}

      {open && (
        <div className="floating-menu" role="listbox" aria-label={ariaLabel}>
          {options.map((option) => (
            <button
              type="button"
              role="option"
              aria-selected={String(option.value ?? "") === String(value ?? "")}
              className={`option ${
                String(option.value ?? "") === String(value ?? "") ? "selected" : ""
              }`}
              key={String(option.value)}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              {hasIcon && <InterestIcon iconName={option.iconName} size={18} />}
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function CategoryPicker({ categories = [], value, onChange, legend = "Interests", noun = "interests" }) {
  const [term, setTerm] = useState("");
  const selected = categories.filter((item) => value.includes(String(item.id)));
  const available = categories.filter(
    (item) =>
      !value.includes(String(item.id)) &&
      item.name.toLowerCase().includes(term.trim().toLowerCase()),
  );
  const add = (id) => onChange(value.includes(String(id)) ? value : [...value, String(id)]);
  const remove = (id) => onChange(value.filter((item) => item !== String(id)));
  return (
    <fieldset className="interest-picker wide">
      <legend>{legend}</legend>
      <section className="interest-picker-section">
        <div className="interest-picker-heading">
          <h4>Selected {noun}</h4>
          <span>{selected.length} selected</span>
        </div>
        <div className="interest-chip-list">
          {selected.length ? (
            selected.map((item) => (
              <div className="interest-chip selected" key={item.id}>
                <InterestIcon iconName={item.icon} size={17} />
                <span>{item.name}</span>
                <button type="button" className="interest-chip-remove" aria-label={`Remove ${item.name}`} title={`Remove ${item.name}`} onClick={() => remove(item.id)}>
                  <X size={15} />
                </button>
              </div>
            ))
          ) : (
            <p className="interest-picker-empty">None selected yet. Add at least one below.</p>
          )}
        </div>
      </section>
      <section className="interest-picker-section">
        <div className="interest-picker-heading">
          <h4>Explore {noun}</h4>
          <span>{available.length} available</span>
        </div>
        <SearchBox value={term} onChange={setTerm} placeholder={`Search ${noun}…`} />
        <div className="interest-chip-list">
          {available.length ? (
            available.map((item) => (
              <button type="button" className="interest-chip available" key={item.id} onClick={() => add(item.id)}>
                <InterestIcon iconName={item.icon} size={17} />
                <span>{item.name}</span>
                <Plus size={15} className="interest-chip-add" />
              </button>
            ))
          ) : (
            <p className="interest-picker-empty">{term ? `No ${noun} match your search.` : `Every available ${noun.replace(/s$/, "")} is selected.`}</p>
          )}
        </div>
      </section>
    </fieldset>
  );
}

export function RailSection({ id, title, description, children, className = "" }) {
  const rail = useRef(null);
  const scroll = (direction) =>
    rail.current?.scrollBy({ left: direction * rail.current.clientWidth * 0.8, behavior: "smooth" });
  return (
    <section className={`recommended ${className}`} aria-labelledby={id}>
      <div className="recommended-head">
        <div>
          <h2 id={id}>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        <div className="recommended-arrows">
          <button type="button" aria-label="Scroll left" onClick={() => scroll(-1)}>
            <ChevronLeft size={18} />
          </button>
          <button type="button" aria-label="Scroll right" onClick={() => scroll(1)}>
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <div className="recommended-rail" ref={rail}>
        {children}
      </div>
    </section>
  );
}

const sizeLabel = (bytes) => {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};
function matchesAccept(file, accept) {
  if (!accept) return true;
  return accept.split(",").some((rule) => {
    const token = rule.trim().toLowerCase();
    if (!token) return false;
    if (token.startsWith(".")) return file.name.toLowerCase().endsWith(token);
    if (token.endsWith("/*")) return file.type.toLowerCase().startsWith(token.slice(0, -1));
    return file.type.toLowerCase() === token;
  });
}
export function FileDropzone({ accept, file, onFile, hint, icon: Icon = Upload, label = "Drag and drop a file here", disabled = false }) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const input = useRef(null);
  function take(list) {
    const chosen = list?.[0];
    if (!chosen) return;
    if (!matchesAccept(chosen, accept)) {
      setError("That file type isn’t supported here.");
      return;
    }
    setError("");
    onFile(chosen);
  }
  const open = () => !disabled && input.current?.click();
  return (
    <div className="dropzone-wrap">
      <div
        className={`dropzone${dragging ? " dragging" : ""}${file ? " has-file" : ""}${disabled ? " disabled" : ""}`}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={file ? `Selected file ${file.name}. Choose a different file` : label}
        onClick={open}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            open();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (!disabled) take(event.dataTransfer.files);
        }}
      >
        <input
          ref={input}
          type="file"
          accept={accept}
          hidden
          tabIndex={-1}
          onChange={(event) => {
            take(event.target.files);
            event.target.value = "";
          }}
        />
        <span className="dropzone-icon">
          <Icon size={22} />
        </span>
        {file ? (
          <span className="dropzone-text">
            <strong>{file.name}</strong>
            <small>{sizeLabel(file.size)} · click or drop to replace</small>
          </span>
        ) : (
          <span className="dropzone-text">
            <strong>
              {label} <u>or browse</u>
            </strong>
            {hint && <small>{hint}</small>}
          </span>
        )}
        {file && (
          <button
            type="button"
            className="dropzone-clear"
            aria-label="Remove file"
            onClick={(event) => {
              event.stopPropagation();
              setError("");
              onFile(null);
            }}
          >
            <X size={16} />
          </button>
        )}
      </div>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
