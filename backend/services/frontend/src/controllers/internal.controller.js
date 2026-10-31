import { verifyInternalToken, emitLocal } from "@uddeepto/common";
export const createInternalEmit = (req, res) => {
  if (!verifyInternalToken(req.headers["x-internal-token"])) return res.status(403).json({
    error: "Forbidden"
  });
  const items = (Array.isArray(req.body?.items) ? req.body.items : []).slice(0, 500).filter(item => item && typeof item.event === "string");
  emitLocal(items);
  res.json({
    delivered: items.length
  });
};
