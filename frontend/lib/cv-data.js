// What a CV is made of, how it starts out (from the profile) and the choices offered in the CV Generator.

export const TEMPLATES = [
  { id: "classic", name: "Classic", blurb: "Traditional single column with serif headings. Safe for every employer." },
  { id: "modern", name: "Modern", blurb: "A coloured side panel for contact details and skills, with the story on the right." },
  { id: "minimal", name: "Minimal", blurb: "Quiet and airy, with dates in a column on the left." },
  { id: "executive", name: "Executive", blurb: "A bold header band and a two-column body that fits a lot on one page." },
  { id: "creative", name: "Creative", blurb: "A timeline, skill chips and an accent colour that stands out." },
];

export const ACCENTS = [
  { id: "#19704f", name: "Green" },
  { id: "#1d4ed8", name: "Blue" },
  { id: "#7c3aed", name: "Purple" },
  { id: "#be123c", name: "Crimson" },
  { id: "#e77b38", name: "Orange" },
  { id: "#334155", name: "Slate" },
];

export const emptyCv = () => ({
  accent: ACCENTS[0].id,
  personal: { name: "", headline: "", email: "", phone: "", address: "", website: "" },
  summary: "",
  experience: [],
  education: [],
  skills: [],
  languages: [],
  projects: [],
  certifications: [],
});

export const blankExperience = () => ({ title: "", workplace: "", location: "", start: "", end: "", current: false, description: "" });
export const blankEducation = () => ({ institution: "", degree: "", field: "", start: "", end: "", grade: "" });
export const blankProject = () => ({ name: "", link: "", description: "" });
export const blankCertification = () => ({ title: "", issuer: "", year: "" });

const month = (value) => (value ? String(value).slice(0, 7) : "");

/** A first draft of the CV built from what is already on the profile. */
export function cvFromProfile(profile) {
  const cv = emptyCv();
  if (!profile) return cv;
  cv.personal = {
    name: profile.name || "",
    headline: profile.headline || "",
    email: profile.personal?.email || "",
    phone: profile.personal?.phone || "",
    address: profile.personal?.current_address || "",
    website: "",
  };
  cv.summary = profile.bio || "";
  cv.experience = (profile.experience || []).map((item) => ({
    title: item.title || "",
    workplace: item.workplace || "",
    location: item.location || "",
    start: month(item.start_date),
    end: month(item.end_date),
    current: !item.end_date,
    description: item.description || "",
  }));
  cv.education = (profile.education || []).map((item) => ({
    institution: item.institution || "",
    degree: item.degree || "",
    field: item.field_of_study || "",
    start: month(item.start_date),
    end: month(item.end_date),
    grade: item.grade || "",
  }));
  cv.skills = (profile.interests || []).map((item) => item.name);
  return cv;
}

/** Makes sure a CV loaded from the server (or a draft) has every field the editor expects. */
export function normalizeCv(value) {
  const base = emptyCv();
  const source = value && typeof value === "object" ? value : {};
  return {
    ...base,
    ...source,
    personal: { ...base.personal, ...(source.personal || {}) },
    experience: Array.isArray(source.experience) ? source.experience.map((item) => ({ ...blankExperience(), ...item })) : [],
    education: Array.isArray(source.education) ? source.education.map((item) => ({ ...blankEducation(), ...item })) : [],
    skills: Array.isArray(source.skills) ? source.skills.map(String) : [],
    languages: Array.isArray(source.languages) ? source.languages.map(String) : [],
    projects: Array.isArray(source.projects) ? source.projects.map((item) => ({ ...blankProject(), ...item })) : [],
    certifications: Array.isArray(source.certifications) ? source.certifications.map((item) => ({ ...blankCertification(), ...item })) : [],
  };
}

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function monthLabel(value) {
  const match = /^(\d{4})(?:-(\d{2}))?/.exec(String(value || ""));
  if (!match) return "";
  const index = match[2] ? Number(match[2]) - 1 : -1;
  return index >= 0 && index < 12 ? `${monthNames[index]} ${match[1]}` : match[1];
}
export function dateRange(start, end, current) {
  const from = monthLabel(start);
  const to = current ? "Present" : monthLabel(end);
  if (from && to) return `${from} - ${to}`;
  return from || to || "";
}

/** Text split into lines, with any leading bullet marks removed. */
export function lines(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-•*]\s*/, "").trim())
    .filter(Boolean);
}

/** True when the CV has nothing worth printing yet. */
export const isBlank = (cv) => !cv.personal.name.trim();

export function fileNameFor(cv) {
  const base = (cv.personal.name || "cv").trim().replace(/[^\w\- ]+/g, "").replace(/\s+/g, "-").slice(0, 60) || "cv";
  return `${base}-CV.pdf`;
}
