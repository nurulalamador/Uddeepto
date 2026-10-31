import { one, uuid } from "./shared.service.js";
import { ApiError } from "@uddeepto/common";
export const ownJob = async req => {
  const j = await one("SELECT creator_id FROM jobs WHERE id=$1", [uuid(req.params.id)]);
  if (j.creator_id !== req.user.sub && req.user.role !== "admin") throw new ApiError(403, "Only the job owner can view applications");
};
export const distanceSql = (lat, lng) => `(CASE WHEN ${lat}::float8 IS NULL OR j.latitude IS NULL THEN NULL ELSE 6371*acos(least(1,greatest(-1,cos(radians(${lat}::float8))*cos(radians(j.latitude::float8))*cos(radians(j.longitude::float8)-radians(${lng}::float8))+sin(radians(${lat}::float8))*sin(radians(j.latitude::float8)))))END)`;
export const finiteOrNull = (value, limit) => {
  if (value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || Math.abs(n) > limit) throw new ApiError(422, "Invalid map position");
  return n;
};
