import { announceJob } from "../services/jobs.service.js";
import { ApiError } from "@uddeepto/common";
export const normalizeJobLocation = (q, _s, n) => {
  if (["POST", "PATCH"].includes(q.method) && q.body && ("latitude" in q.body || "longitude" in q.body)) {
    const clean = v => v === "" || v === undefined ? null : v;
    const la = clean(q.body.latitude),
      lo = clean(q.body.longitude);
    if (la === null !== (lo === null)) return n(new ApiError(422, "Choose a location on the map"));
    if (la !== null) {
      const x = Number(la),
        y = Number(lo);
      if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > 90 || Math.abs(y) > 180) return n(new ApiError(422, "That map position is not valid"));
      q.body.latitude = x;
      q.body.longitude = y;
    } else {
      q.body.latitude = null;
      q.body.longitude = null;
    }
  }
  n();
};
export const observeJobCreation = (q, s, n) => {
  const json = s.json.bind(s);
  s.json = body => {
    const sent = json(body);
    if (s.statusCode === 201 && body?.id) announceJob(body, q.user);
    return sent;
  };
  n();
};
