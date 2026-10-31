import { ApiError } from "@uddeepto/common";
export const uddeeptoIdPattern = /^\d{3}-\d{3}-\d{3}$/;
export const asDate = value => {
  if (value === undefined || value === null || value === "") return null;
  const text = String(value);
  const full = /^\d{4}-\d{2}$/.test(text) ? `${text}-01` : text;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(full) || Number.isNaN(Date.parse(full))) throw new ApiError(422, "Enter a valid date");
  return full;
};
export const timeline = body => {
  const start = asDate(body.start_date),
    end = asDate(body.end_date);
  if (end && end < start) throw new ApiError(422, "The end date must be after the start date");
  return [start, end];
};
