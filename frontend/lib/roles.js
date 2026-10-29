export const sections = {
  dashboard: "Dashboard",
  showcase: "Showcase",
  courses: "Courses",
  contests: "Contests",
  webinars: "Webinars",
  communities: "Communities",
  jobs: "Jobs",
  messages: "Messages",
  notifications: "Notifications",
  profile: "Profile",
  admin: "Management",
  moderation: "Moderation",
  settings: "Settings",
  ai: "AI Assistant",
  "job-management": "Job Management", // the old address: it now leads to My Job Posts
  "job-posts": "My Job Posts",
  applicants: "Applicants",
  cv: "CV Generator",
  account: "Settings",
  search: "Search",
};
export function allowedSections(role) {
  if (role === "admin")
    return ["dashboard", "notifications", "courses", "contests", "webinars", "jobs", "admin", "moderation", "settings"];
  if (role === "hirer") return ["dashboard", "showcase", "job-posts", "applicants", "messages", "notifications", "profile"];
  return [
    "dashboard",
    "showcase",
    "courses",
    "contests",
    "webinars",
    "communities",
    "jobs",
    "ai",
    "messages",
    "notifications",
    "profile",
    "cv",
  ];
}
export function allowedCategorizedSections(role) {
  if (role === "admin")
    return [
      {
        title: "Admin console",
        sections: ["dashboard", "notifications"],
      },
      {
        title: "Operations",
        sections: ["courses", "contests", "webinars", "jobs", "admin", "moderation", "settings"],
      },
    ];
  if (role === "hirer")
    return [
      {
        title: "Overview",
        sections: ["dashboard", "showcase"],
      },
      {
        title: "Hiring",
        sections: ["job-posts", "applicants"],
      },
      {
        title: "Social",
        sections: ["messages", "notifications", "profile"],
      },
    ];
  return [
    {
      title: "Overview",
      sections: ["dashboard", "showcase"],
    },
    {
      title: "Workspace",
      sections: ["courses", "contests", "webinars", "jobs", "ai"],
    },
    {
      title: "Social",
      sections: ["communities", "messages", "notifications", "profile"],
    },
  ];
}
export function canAccess(role, section) {
  if (section === "account") return true;
  // Hirers reach individual job pages (/jobs/[id]) from My Job Posts; the old /job-management address redirects there.
  return section === "profile" || section === "search" || allowedSections(role).includes(section) || (role === "hirer" && (section === "jobs" || section === "job-management"));
}
export function timeline(item, now = Date.now()) {
  if (["cancelled", "completed", "archived"].includes(item.status))
    return "previous";
  if (new Date(item.starting_time).getTime() > now) return "upcoming";
  if (new Date(item.ending_time).getTime() < now) return "previous";
  return "ongoing";
}
export function safeLink(value) {
  try {
    const u = new URL(value);
    return ["https:", "http:"].includes(u.protocol) ? u.href : null;
  } catch {
    return null;
  }
}
