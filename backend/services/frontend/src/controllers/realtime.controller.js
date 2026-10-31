import { run } from "../middleware/response.middleware.js";
import { signSocketTicket } from "@uddeepto/common";
export const createRealtimeTicket = run(async req => ({
  ticket: signSocketTicket({
    id: req.user.sub
  })
}));
