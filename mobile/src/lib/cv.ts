// The CV: what it is made of, how it starts out (from the profile) and the HTML the five templates print to PDF.
// The data has the same shape the website's CV generator saves, so a CV made on either can be opened on the other.

export const TEMPLATES = [
  { id: "classic", name: "Classic", blurb: "Traditional single column with serif headings." },
  { id: "modern", name: "Modern", blurb: "A coloured side panel with contact details and skills." },
  { id: "minimal", name: "Minimal", blurb: "Quiet and airy, with dates in a column on the left." },
  { id: "executive", name: "Executive", blurb: "A bold header band and a two-column body." },
  { id: "creative", name: "Creative", blurb: "A timeline, skill chips and a strong accent colour." },
];
export const ACCENTS = [
  { id: "#19704f", name: "Green" },
  { id: "#1d4ed8", name: "Blue" },
  { id: "#7c3aed", name: "Purple" },
  { id: "#be123c", name: "Crimson" },
  { id: "#e77b38", name: "Orange" },
  { id: "#334155", name: "Slate" },
];

export type CvExperience = { title: string; workplace: string; location: string; start: string; end: string; current: boolean; description: string };
export type CvEducation = { institution: string; degree: string; field: string; start: string; end: string; grade: string };
export type CvProject = { name: string; link: string; description: string };
export type CvCertification = { title: string; issuer: string; year: string };
export type Cv = {
  accent: string;
  personal: { name: string; headline: string; email: string; phone: string; address: string; website: string };
  summary: string;
  experience: CvExperience[];
  education: CvEducation[];
  skills: string[];
  languages: string[];
  projects: CvProject[];
  certifications: CvCertification[];
};

export const emptyCv = (): Cv => ({ accent: ACCENTS[0].id, personal: { name: "", headline: "", email: "", phone: "", address: "", website: "" }, summary: "", experience: [], education: [], skills: [], languages: [], projects: [], certifications: [] });
export const blankExperience = (): CvExperience => ({ title: "", workplace: "", location: "", start: "", end: "", current: false, description: "" });
export const blankEducation = (): CvEducation => ({ institution: "", degree: "", field: "", start: "", end: "", grade: "" });
export const blankProject = (): CvProject => ({ name: "", link: "", description: "" });
export const blankCertification = (): CvCertification => ({ title: "", issuer: "", year: "" });

const month = (value?: string | null) => (value ? String(value).slice(0, 7) : "");

export function cvFromProfile(profile: any): Cv {
  const cv = emptyCv();
  if (!profile) return cv;
  cv.personal = { name: profile.name || "", headline: profile.headline || "", email: profile.personal?.email || "", phone: profile.personal?.phone || "", address: profile.personal?.current_address || "", website: "" };
  cv.summary = profile.bio || "";
  cv.experience = (profile.experience || []).map((item: any) => ({ title: item.title || "", workplace: item.workplace || "", location: item.location || "", start: month(item.start_date), end: month(item.end_date), current: !item.end_date, description: item.description || "" }));
  cv.education = (profile.education || []).map((item: any) => ({ institution: item.institution || "", degree: item.degree || "", field: item.field_of_study || "", start: month(item.start_date), end: month(item.end_date), grade: item.grade || "" }));
  cv.skills = (profile.interests || []).map((item: any) => item.name);
  return cv;
}

export function normalizeCv(value: any): Cv {
  const base = emptyCv();
  const source = value && typeof value === "object" ? value : {};
  return {
    ...base,
    ...source,
    personal: { ...base.personal, ...(source.personal || {}) },
    experience: Array.isArray(source.experience) ? source.experience.map((item: any) => ({ ...blankExperience(), ...item })) : [],
    education: Array.isArray(source.education) ? source.education.map((item: any) => ({ ...blankEducation(), ...item })) : [],
    skills: Array.isArray(source.skills) ? source.skills.map(String) : [],
    languages: Array.isArray(source.languages) ? source.languages.map(String) : [],
    projects: Array.isArray(source.projects) ? source.projects.map((item: any) => ({ ...blankProject(), ...item })) : [],
    certifications: Array.isArray(source.certifications) ? source.certifications.map((item: any) => ({ ...blankCertification(), ...item })) : [],
  };
}

export const isBlank = (cv: Cv) => !cv.personal.name.trim();
export function fileNameFor(cv: Cv) {
  const base = (cv.personal.name || "cv").trim().replace(/[^\w\- ]+/g, "").replace(/\s+/g, "-").slice(0, 60) || "cv";
  return `${base}-CV.pdf`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function monthLabel(value: string) {
  const match = /^(\d{4})(?:-(\d{2}))?/.exec(String(value || ""));
  if (!match) return "";
  const index = match[2] ? Number(match[2]) - 1 : -1;
  return index >= 0 && index < 12 ? `${MONTHS[index]} ${match[1]}` : match[1];
}
function range(start: string, end: string, current?: boolean) {
  const from = monthLabel(start);
  const to = current ? "Present" : monthLabel(end);
  return from && to ? `${from} - ${to}` : from || to || "";
}
const esc = (text: unknown) => String(text ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const lines = (text: string) =>
  String(text || "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-•*]\s*/, "").trim())
    .filter(Boolean);
const bullets = (text: string) => (lines(text).length ? `<ul>${lines(text).map((line) => `<li>${esc(line)}</li>`).join("")}</ul>` : "");

/** The CV as an HTML page for the chosen template; printed to PDF by the phone. */
export function cvHtml(template: string, cv: Cv) {
  const accent = /^#[0-9a-f]{6}$/i.test(cv.accent) ? cv.accent : ACCENTS[0].id;
  const p = cv.personal;
  const contact = [p.email, p.phone, p.address, p.website].filter(Boolean).map(esc);
  const exp = (item: CvExperience) =>
    `<div class="item"><div class="row"><b>${esc(item.title)}</b><span class="date">${esc(range(item.start, item.end, item.current))}</span></div><div class="sub">${esc([item.workplace, item.location].filter(Boolean).join(" · "))}</div>${bullets(item.description)}</div>`;
  const edu = (item: CvEducation) =>
    `<div class="item"><div class="row"><b>${esc(item.institution)}</b><span class="date">${esc(range(item.start, item.end))}</span></div><div class="sub">${esc([item.degree, item.field, item.grade].filter(Boolean).join(" · "))}</div></div>`;
  const proj = (item: CvProject) => `<div class="item"><b>${esc(item.name)}</b>${item.link ? ` <span class="date">${esc(item.link)}</span>` : ""}${bullets(item.description)}</div>`;
  const cert = (item: CvCertification) => `<div class="item row"><span><b>${esc(item.title)}</b>${item.issuer ? ` · ${esc(item.issuer)}` : ""}</span><span class="date">${esc(item.year)}</span></div>`;
  const section = (title: string, body: string) => (body ? `<section><h2>${title}</h2>${body}</section>` : "");
  const chips = (list: string[]) => (list.length ? `<div class="chips">${list.map((item) => `<span>${esc(item)}</span>`).join("")}</div>` : "");

  const main = [
    section("Summary", cv.summary ? `<p>${esc(cv.summary)}</p>` : ""),
    section("Experience", cv.experience.filter((item) => item.title || item.workplace).map(exp).join("")),
    section("Education", cv.education.filter((item) => item.institution).map(edu).join("")),
    section("Projects", cv.projects.filter((item) => item.name).map(proj).join("")),
    section("Certifications", cv.certifications.filter((item) => item.title).map(cert).join("")),
  ].join("");
  const side = [section("Contact", contact.map((line) => `<p>${line}</p>`).join("")), section("Skills", chips(cv.skills)), section("Languages", chips(cv.languages))].join("");
  const flat = [section("Skills", chips(cv.skills)), section("Languages", chips(cv.languages))].join("");

  const base = `*{box-sizing:border-box}body{margin:0;font-family:Helvetica,Arial,sans-serif;color:#1c2a23;font-size:11.5px;line-height:1.5}h1{margin:0;font-size:26px}h2{font-size:12px;text-transform:uppercase;letter-spacing:1.4px;margin:18px 0 8px;color:${accent}}p{margin:0 0 4px}ul{margin:4px 0 0;padding-left:16px}li{margin:1px 0}.item{margin-bottom:10px}.row{display:flex;justify-content:space-between;gap:12px}.date{color:#667;font-size:10.5px;white-space:nowrap}.sub{color:#445}.chips span{display:inline-block;margin:0 5px 5px 0;padding:2px 9px;border-radius:99px;background:${accent}22;color:${accent};font-weight:600}@page{margin:0}`;
  const head = `<h1>${esc(p.name)}</h1>${p.headline ? `<div class="sub" style="font-size:14px;margin-top:2px">${esc(p.headline)}</div>` : ""}`;
  let css = base;
  let body = "";
  switch (template) {
    case "modern":
      css += `body{display:flex;min-height:100vh}.side{width:32%;background:${accent};color:#fff;padding:32px 20px}.side h2{color:#fff;opacity:.85}.side .chips span{background:rgba(255,255,255,.2);color:#fff}.main{flex:1;padding:32px 28px}`;
      body = `<div class="side"><h1 style="font-size:22px">${esc(p.name)}</h1>${side}</div><div class="main">${p.headline ? `<div style="font-size:15px;color:${accent};font-weight:700">${esc(p.headline)}</div>` : ""}${main}</div>`;
      break;
    case "minimal":
      css += `.page{padding:44px 48px}h1{font-weight:300;letter-spacing:1px}h2{color:#889;font-weight:600}.item{display:flex;gap:18px}.item .row{display:block;min-width:110px}.item>div:last-child{flex:1}`;
      body = `<div class="page">${head}<p style="color:#667;margin-top:6px">${contact.join(" &nbsp;·&nbsp; ")}</p>${main}${flat}</div>`;
      break;
    case "executive":
      css += `.band{background:${accent};color:#fff;padding:30px 40px}.band .sub{color:#fff;opacity:.9}.cols{display:flex;gap:28px;padding:10px 40px 30px}.cols>div:first-child{flex:2}.cols>div:last-child{flex:1}`;
      body = `<div class="band">${head}<p style="margin-top:6px">${contact.join(" &nbsp;|&nbsp; ")}</p></div><div class="cols"><div>${main}</div><div>${flat}</div></div>`;
      break;
    case "creative":
      css += `.page{padding:36px 40px}.top{border-left:6px solid ${accent};padding-left:14px;margin-bottom:6px}h1{color:${accent}}.item{border-left:2px solid ${accent}55;padding-left:12px;margin-left:3px}`;
      body = `<div class="page"><div class="top">${head}<p style="color:#667;margin-top:4px">${contact.join(" &nbsp;·&nbsp; ")}</p></div>${main}${flat}</div>`;
      break;
    default:
      css += `.page{padding:40px 46px}h1,h2{font-family:Georgia,'Times New Roman',serif}h1{text-align:center}.center{text-align:center}h2{border-bottom:1px solid ${accent};padding-bottom:3px;color:#1c2a23}`;
      body = `<div class="page"><div class="center">${head}<p style="color:#667;margin-top:4px">${contact.join(" &nbsp;·&nbsp; ")}</p></div>${main}${flat}</div>`;
  }
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body>${body}</body></html>`;
}
