export const sections = {
  dashboard: "Dashboard",
  showcase: "Showcase",
  courses: "Courses",
  contests: "Contests",
  webinars: "Webinars",
  communities: "Communities",
  jobs: "Jobs",
  messages: "Messages",
  profile: "Profile",
  admin: "Management",
  moderation: "Moderation",
  settings: "Settings",
};
export function allowedSections(role) {
  if (role === "admin")
    return ["dashboard", "courses", "contests", "webinars", "jobs", "admin", "moderation", "settings"];
  if (role === "hirer") return ["dashboard", "showcase", "jobs"];
  return [
    "dashboard",
    "showcase",
    "courses",
    "contests",
    "webinars",
    "communities",
    "jobs",
    "messages",
    "profile",
  ];
}
export function allowedCategorizedSections(role) {
  if (role === "admin")
    return [
      {
        title: "Admin console",
        sections: ["dashboard"],
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
        sections: ["dashboard", "showcase", "jobs"],
      },
    ];
  return [
    {
      title: "Overview",
      sections: ["dashboard", "showcase"],
    },
    {
      title: "Workspace",
      sections: ["courses", "contests", "webinars", "jobs"],
    },
    {
      title: "Social",
      sections: ["communities", "messages", "profile"],
    },
  ];
}
export function canAccess(role, section) {
  return section === "profile" || allowedSections(role).includes(section);
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
