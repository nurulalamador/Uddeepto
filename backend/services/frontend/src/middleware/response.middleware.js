import { asyncHandler } from "@uddeepto/common";
export const run = fn => asyncHandler(async (req, res) => {
  const value = await fn(req, res);
  if (!res.headersSent) res.json(value ?? {
    ok: true
  });
});
