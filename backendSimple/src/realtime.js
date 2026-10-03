import { createHmac, timingSafeEqual } from "node:crypto";

// The sending side of live updates. It has no socket.io import, so every service can use it.
//   - In the process that runs the socket server (frontend-api, or backendSimple) events go
//     straight to the connected sockets.
//   - In any other service they are forwarded over HTTP to that process (/internal/emit).
let local = null;
export const setLocalRealtime = (io) => {
  local = io;
};
export const userRoom = (id) => `user:${id}`;

export const internalToken = () =>
  createHmac("sha256", process.env.JWT_ACCESS_SECRET || "uddeepto-dev")
    .update("uddeepto-internal-emit")
    .digest("hex");
export function verifyInternalToken(value) {
  const given = Buffer.from(String(value || ""));
  const wanted = Buffer.from(internalToken());
  return given.length === wanted.length && timingSafeEqual(given, wanted);
}

/** Deliver to sockets in this process. Returns false when this process has no socket server. */
export function emitLocal(items) {
  if (!local) return false;
  for (const { rooms, event, payload } of items) {
    const list = [].concat(rooms).filter(Boolean);
    if (list.length) local.to(list).emit(event, payload);
  }
  return true;
}

function forward(items) {
  const base = process.env.FRONTEND_API_URL || "http://localhost:4010";
  fetch(`${base}/internal/emit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-token": internalToken(),
    },
    body: JSON.stringify({ items }),
    signal: AbortSignal.timeout(4000),
  }).catch(() => {});
}

/** items: [{ rooms, event, payload }]. Never throws; live updates are best effort. */
export function emitBatch(items) {
  try {
    const clean = items.filter((item) => [].concat(item.rooms).some(Boolean));
    if (!clean.length || emitLocal(clean)) return;
    for (let i = 0; i < clean.length; i += 300) forward(clean.slice(i, i + 300));
  } catch (error) {
    console.error("realtime emit failed:", error.message);
  }
}
export const emit = (rooms, event, payload) =>
  emitBatch([{ rooms, event, payload }]);

/** Take a user's sockets out of a room, for example after they leave or are removed. */
export function leaveRoom(userId, room) {
  try {
    local?.in(userRoom(userId)).socketsLeave(room);
  } catch (error) {
    console.error("realtime leave failed:", error.message);
  }
}
