import { run } from "../middleware/response.middleware.js";
import { searchTypes, searchEscape } from "../services/search.service.js";
import { ApiError, query } from "@uddeepto/common";
export const getSearch = run(async req => {
  const q = String(req.query.q || "").trim().slice(0, 100);
  const allowed = Object.keys(searchTypes).filter(key => searchTypes[key].roles.includes(req.user.role));
  const labels = Object.fromEntries(allowed.map(key => [key, searchTypes[key].label]));
  if (q.length < 2) return {
    q,
    types: allowed,
    labels,
    counts: {},
    results: {}
  };
  const type = req.query.type ? String(req.query.type) : "";
  if (type && !allowed.includes(type)) throw new ApiError(422, "Unknown search type");
  const limit = Math.min(Math.max(parseInt(req.query.limit) || (type ? 20 : 4), 1), 50);
  const offset = type ? Math.max(parseInt(req.query.offset) || 0, 0) : 0;
  const like = `%${searchEscape(q)}%`,
    prefix = `${searchEscape(q)}%`;
  const counts = {},
    results = {};
  await Promise.all(allowed.map(async key => {
    const config = searchTypes[key];
    const bindings = (sql, values) => values.slice(0, Math.max(...[...sql.matchAll(/\$(\d+)/g)].map(match => Number(match[1]))));
    const countSql = `SELECT count(*) FROM ${config.from("$2", "$3")}`;
    counts[key] = Number((await query(countSql, bindings(countSql, [like, req.user.sub, req.user.role]))).rows[0].count);
    if (type && type !== key) return;
    const rowsSql = `SELECT ${config.select} FROM ${config.from("$5", "$6")} ORDER BY ${config.order} LIMIT $3 OFFSET $4`;
    const rows = (await query(rowsSql, bindings(rowsSql, [like, prefix, limit, offset, req.user.sub, req.user.role]))).rows;
    results[key] = rows.map(config.map);
  }));
  return {
    q,
    types: allowed,
    labels,
    counts,
    results
  };
});
