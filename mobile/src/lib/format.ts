const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const two = (n: number) => String(n).padStart(2, "0");

export function dateOnly(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}
export function timeOnly(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  const hours = d.getHours() % 12 || 12;
  return `${hours}:${two(d.getMinutes())} ${d.getHours() >= 12 ? "PM" : "AM"}`;
}
export const dateTime = (value?: string | null) => (value ? `${dateOnly(value)}, ${timeOnly(value)}` : "Not scheduled");

/** "just now", "5 min ago", "3 h ago", "2 d ago", else the date. */
export function ago(value?: string | null) {
  if (!value) return "";
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 45) return "just now";
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))} min ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} h ago`;
  if (seconds < 7 * 86400) return `${Math.round(seconds / 86400)} d ago`;
  return dateOnly(value);
}

export function money(value: string | number | null | undefined, currency = "BDT") {
  const amount = Number(value || 0);
  if (!amount) return "Free";
  return `${currency} ${amount.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

export function salary(job: { salary_min?: string | null; salary_max?: string | null; currency?: string; salary_period?: string | null }) {
  const { salary_min: low, salary_max: high } = job;
  if (low == null && high == null) return "Salary negotiable";
  const fmt = (n: string) => Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
  const range = low != null && high != null ? `${fmt(low)} - ${fmt(high)}` : fmt((low ?? high) as string);
  const period = job.salary_period && job.salary_period !== "fixed" ? ` / ${job.salary_period}` : "";
  return `${job.currency || "BDT"} ${range}${period}`;
}

export const initials = (name?: string | null) =>
  (name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

export const label = (value?: string | null) => String(value || "").replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
export const count = (value: unknown) => Number(value || 0);

export const greeting = (hour = new Date().getHours()) => (hour < 5 ? "Good night" : hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : hour < 21 ? "Good evening" : "Good night");
