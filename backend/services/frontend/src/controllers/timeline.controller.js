import { run } from "../middleware/response.middleware.js";
import { timeline } from "../services/profile.service.js";
import { one, uuid } from "../services/shared.service.js";
import { ApiError, query } from "@uddeepto/common";
export function createTimelineControllers(table, schema, columns, label) {
  const columnList = columns.join(",");
  const values = body => {
    const [start, end] = timeline(body);
    return columns.map(c => c === "start_date" ? start : c === "end_date" ? end : body[c] ?? null);
  };
  return {
    createEntry: run(async req => {
      const body = schema.parse(req.body);
      const v = values(body);
      if (Number((await one(`SELECT count(*) FROM ${table} WHERE user_id=$1`, [req.user.sub])).count) >= 30) throw new ApiError(409, `You can add up to 30 ${label} entries`);
      if (body.category_id && !(await query("SELECT 1 FROM interest_categories WHERE id=$1", [body.category_id])).rowCount) throw new ApiError(422, "Choose a valid interest");
      return (await query(`INSERT INTO ${table}(user_id,${columnList}) VALUES($1,${columns.map((_, n) => "$" + (n + 2)).join(",")}) RETURNING id`, [req.user.sub, ...v])).rows[0];
    }),
    updateEntry: run(async req => {
      const body = schema.parse(req.body);
      const v = values(body);
      if (body.category_id && !(await query("SELECT 1 FROM interest_categories WHERE id=$1", [body.category_id])).rowCount) throw new ApiError(422, "Choose a valid interest");
      const result = await query(`UPDATE ${table} SET ${columns.map((c, n) => c + "=$" + (n + 3)).join(",")} WHERE id=$1 AND user_id=$2`, [uuid(req.params.entryId), req.user.sub, ...v]);
      if (!result.rowCount) throw new ApiError(404, "Entry not found");
    }),
    deleteEntry: run(async req => {
      const result = await query(`DELETE FROM ${table} WHERE id=$1 AND user_id=$2`, [uuid(req.params.entryId), req.user.sub]);
      if (!result.rowCount) throw new ApiError(404, "Entry not found");
    })
  };
}
