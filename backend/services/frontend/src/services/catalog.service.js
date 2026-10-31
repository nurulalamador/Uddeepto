export const catalogs = {
  courses: {
    title: "title",
    columns: "price,currency,slug",
    visible: "status='published'"
  },
  contests: {
    title: "name",
    columns: "type,entry_fee,currency,starting_time,ending_time,max_participants",
    visible: "status IN ('published','completed','cancelled')"
  },
  webinars: {
    title: "name",
    columns: "capacity,starting_time,ending_time",
    visible: "status IN ('scheduled','live','completed','cancelled')"
  },
  communities: {
    title: "name",
    columns: "slug,is_private",
    visible: "true"
  }
};
