"use client";
import { useEffect, useState, useRef } from "react";
import {
  X,
  Search,
  ArrowLeft,
  ArrowRight,
  Inbox,
  ChevronDown,
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
