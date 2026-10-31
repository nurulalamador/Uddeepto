import { MB, UPLOAD_ROOT } from "../config/storage.config.js";
import { uuid, one, catNamesSql, catDetailsSql, decodeName } from "./shared.service.js";
import { multer } from "@uddeepto/common";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
export const contestKindSql = `(SELECT CASE WHEN k.kind='text' THEN CASE c.type::text WHEN 'competitive_programming' THEN 'code' WHEN 'singing' THEN 'audio' WHEN 'drawing' THEN 'image' ELSE 'text' END ELSE k.kind END FROM (SELECT CASE WHEN bool_or(ic.submission_kind='audio') THEN 'audio' WHEN bool_or(ic.submission_kind='image') THEN 'image' WHEN bool_or(ic.submission_kind='code') THEN 'code' ELSE 'text' END kind FROM interest_categories ic WHERE ic.id IN(SELECT category_id FROM contest_categories WHERE contest_id=c.id UNION SELECT c.category_id)) k)`;
export const contestPhase = "CASE WHEN c.status IN('completed','cancelled') OR c.ending_time<now() THEN 'previous' WHEN c.starting_time>now() THEN 'upcoming' ELSE 'ongoing' END";
export async function visibleContest(req) {
  const id = uuid(req.params.id);
  return one(`SELECT c.id,c.name,c.description,c.type::text type,c.entry_fee,c.currency,c.status::text status,c.max_participants,c.starting_time,c.ending_time,u.name creator_name,${catNamesSql("contests", "c")} category_name,${catDetailsSql("contests", "c")} category_details,(SELECT count(*) FROM contest_participants WHERE contest_id=c.id) participant_count,EXISTS(SELECT 1 FROM contest_participants WHERE contest_id=c.id AND participant_id=$2 AND payment_status='paid') joined,${contestPhase} phase,${contestKindSql} submission_kind FROM contests c JOIN users u ON u.id=c.creator_id WHERE c.id=$1 AND(c.status IN('published','completed','cancelled') OR c.creator_id=$2 OR $3='admin')`, [id, req.user.sub, req.user.role]);
}
export const submissionLimits = {
  image: 10 * MB,
  audio: Number(process.env.MAX_AUDIO_UPLOAD_MB || 50) * MB
};
export const imageMimes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);
export const submissionUpload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const dir = path.join(UPLOAD_ROOT, "contest-submissions", req.contest.id);
      fs.mkdir(dir, {
        recursive: true
      }, error => cb(error, dir));
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(decodeName(file.originalname)).toLowerCase();
      cb(null, `${crypto.randomUUID()}${/^\.[a-z0-9]{1,10}$/.test(ext) ? ext : ""}`);
    }
  }),
  limits: {
    fileSize: Math.max(...Object.values(submissionLimits))
  }
});
