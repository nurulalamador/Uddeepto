import { catNamesSql, speakerNamesSql } from "./shared.service.js";
export const searchEscape = value => value.replace(/[\\%_]/g, "\\$&");
export const categoryMatch = (table, fk, alias) => `EXISTS(SELECT 1 FROM ${table} sc JOIN interest_categories sic ON sic.id=sc.category_id WHERE sc.${fk}=${alias}.id AND sic.name ILIKE $1)`;
export const shortDay = value => value ? new Date(value).toISOString().slice(0, 10) : "";
export const searchTypes = {
  users: {
    roles: ["learner", "hirer", "admin"],
    label: "People",
    from: () => `users u WHERE u.account_status='active' AND(u.name ILIKE $1 OR u.username::text ILIKE $1 OR u.uddeepto_id ILIKE $1 OR coalesce(u.headline,'') ILIKE $1)`,
    select: "u.id,u.uddeepto_id,u.name,u.username,u.headline,u.role::text role,(u.picture IS NOT NULL) has_picture",
    order: "(u.name ILIKE $2) DESC,u.name",
    map: row => ({
      type: "users",
      id: row.id,
      title: row.name,
      subtitle: [`@${row.username}`, row.headline || row.role].filter(Boolean).join(" · "),
      href: `/profile/${row.uddeepto_id}`,
      image: row.has_picture ? `/api/backend/frontend/profile/${row.id}/picture` : null,
      meta: row.uddeepto_id
    })
  },
  courses: {
    roles: ["learner", "admin"],
    label: "Courses",
    from: () => `courses c LEFT JOIN instructors ins ON ins.id=c.instructor_id WHERE c.status='published' AND(c.title ILIKE $1 OR c.description ILIKE $1 OR coalesce(ins.name,'') ILIKE $1 OR ${categoryMatch("course_categories", "course_id", "c")})`,
    select: `c.id,c.title,c.price,c.currency,(c.cover_image IS NOT NULL) has_cover_image,ins.name instructor_name,${catNamesSql("courses", "c")} category_name`,
    order: "(c.title ILIKE $2) DESC,c.published_at DESC NULLS LAST",
    map: row => ({
      type: "courses",
      id: row.id,
      title: row.title,
      subtitle: [row.instructor_name, row.category_name].filter(Boolean).join(" · "),
      href: `/courses/${row.id}`,
      image: row.has_cover_image ? `/api/backend/frontend/course-covers/${row.id}` : null,
      meta: Number(row.price) === 0 ? "Free" : `${row.currency} ${Number(row.price)}`
    })
  },
  contests: {
    roles: ["learner", "admin"],
    label: "Contests",
    from: () => `contests c WHERE c.status IN('published','completed') AND(c.name ILIKE $1 OR c.description ILIKE $1 OR ${categoryMatch("contest_categories", "contest_id", "c")})`,
    select: `c.id,c.name,c.starting_time,c.ending_time,c.status::text status,${catNamesSql("contests", "c")} category_name`,
    order: "(c.name ILIKE $2) DESC,c.starting_time DESC",
    map: row => ({
      type: "contests",
      id: row.id,
      title: row.name,
      subtitle: row.category_name || "Contest",
      href: `/contests/${row.id}`,
      image: null,
      meta: new Date(row.ending_time) < new Date() || row.status === "completed" ? "Ended" : new Date(row.starting_time) > new Date() ? `Starts ${shortDay(row.starting_time)}` : "Live now"
    })
  },
  webinars: {
    roles: ["learner", "admin"],
    label: "Webinars",
    from: () => `webinars w WHERE w.status IN('scheduled','live','completed') AND(w.name ILIKE $1 OR w.description ILIKE $1 OR ${categoryMatch("webinar_categories", "webinar_id", "w")} OR EXISTS(SELECT 1 FROM webinar_speakers ws JOIN instructors si ON si.id=ws.instructor_id WHERE ws.webinar_id=w.id AND si.name ILIKE $1))`,
    select: `w.id,w.name,w.starting_time,w.ending_time,w.status::text status,${speakerNamesSql("w")} speaker_names`,
    order: "(w.name ILIKE $2) DESC,w.starting_time DESC",
    map: row => ({
      type: "webinars",
      id: row.id,
      title: row.name,
      subtitle: row.speaker_names ? `with ${row.speaker_names}` : "Webinar",
      href: `/webinars/${row.id}`,
      image: null,
      meta: new Date(row.ending_time) < new Date() || row.status === "completed" ? "Ended" : new Date(row.starting_time) > new Date() ? `Starts ${shortDay(row.starting_time)}` : "Live now"
    })
  },
  jobs: {
    roles: ["learner", "hirer", "admin"],
    label: "Jobs",
    from: (u, r) => `jobs j JOIN users ju ON ju.id=j.creator_id WHERE((j.status='open' AND(j.application_deadline IS NULL OR j.application_deadline>now())) OR j.creator_id=${u} OR ${r}='admin') AND(j.title ILIKE $1 OR j.description ILIKE $1 OR coalesce(j.location,'') ILIKE $1 OR ju.name ILIKE $1)`,
    select: "j.id,j.title,j.location,j.is_remote,j.type::text type,j.status::text status,ju.name company",
    order: "(j.title ILIKE $2) DESC,j.created_at DESC",
    map: row => ({
      type: "jobs",
      id: row.id,
      title: row.title,
      subtitle: [row.company, row.is_remote ? "Remote" : row.location].filter(Boolean).join(" · "),
      href: `/jobs/${row.id}`,
      image: null,
      meta: row.type.replaceAll("_", " ")
    })
  },
  communities: {
    roles: ["learner"],
    label: "Communities",
    from: u => `communities c WHERE(NOT c.is_private OR c.creator_id=${u} OR EXISTS(SELECT 1 FROM community_members m WHERE m.community_id=c.id AND m.member_id=${u} AND m.status='approved')) AND(c.name ILIKE $1 OR c.description ILIKE $1 OR ${categoryMatch("community_categories", "community_id", "c")})`,
    select: `c.id,c.name,c.description,(SELECT count(*) FROM community_members WHERE community_id=c.id AND status='approved')::int member_count`,
    order: "(c.name ILIKE $2) DESC,c.created_at DESC",
    map: row => ({
      type: "communities",
      id: row.id,
      title: row.name,
      subtitle: (row.description || "").slice(0, 90),
      href: `/communities/${row.id}`,
      image: null,
      meta: `${row.member_count} member${row.member_count === 1 ? "" : "s"}`
    })
  }
};
