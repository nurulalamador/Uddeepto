// A second "person" for real-time tests: a Socket.IO client signed in as `who`.
import { io } from "socket.io-client";
import { apiOk } from "./browser.mjs";
import { ports } from "./config.mjs";

export async function connectAs(who) {
  const { ticket } = await apiOk(who, "frontend/realtime/ticket", { method: "POST" });
  const socket = io(`http://127.0.0.1:${ports.api}`, { transports: ["websocket"], auth: { ticket }, reconnection: false, forceNew: true });
  await new Promise((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("connect_error", reject);
  });
  const seen = [];
  socket.onAny((event, payload) => seen.push({ event, payload }));
  return {
    socket,
    seen,
    joinCommunity: (id) => new Promise((resolve) => socket.emit("community:join", id, resolve)),
    typing: (payload) => socket.emit("typing", payload),
    async next(event, timeout = 5000) {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        const index = seen.findIndex((entry) => entry.event === event);
        if (index >= 0) return seen.splice(index, 1)[0].payload;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      throw new Error(`no "${event}" event within ${timeout}ms`);
    },
    close: () => socket.disconnect(),
  };
}
