import { Server } from "socket.io";
import { setLocalRealtime, userRoom } from "./realtime.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The live socket server. It is attached to an existing HTTP server and knows nothing about the
 * database: everything it needs is passed in.
 *   authenticate(ticket)            -> { id, name, role } or null
 *   conversationMembers(id)         -> array of user ids (empty when the conversation is unknown)
 *   isCommunityMember(user, id)     -> boolean
 *   activeUsers(ids)                -> array of ids whose accounts are still active
 * Rooms: user:<id> (every socket of a person), community:<id> (members who opened the community).
 */
export function createRealtime(
  httpServer,
  { origins = [], authenticate, conversationMembers, isCommunityMember, activeUsers, recheckEveryMs = 5 * 60 * 1000 },
) {
  const io = new Server(httpServer, {
    // WebSocket only: no long-polling fallback, so several server copies never need sticky sessions.
    transports: ["websocket"],
    serveClient: false,
    cors: { origin: origins.length ? origins : false, credentials: true },
    allowRequest: (req, done) => {
      const origin = req.headers.origin;
      done(null, !origin || !origins.length || origins.includes(origin));
    },
    // Messages are sent over the REST API; sockets only carry small signals.
    maxHttpBufferSize: 16 * 1024,
    pingInterval: 25000,
    pingTimeout: 20000,
  });
  setLocalRealtime(io);

  io.use(async (socket, next) => {
    try {
      const user = await authenticate(socket.handshake.auth?.ticket);
      if (!user) return next(new Error("unauthorized"));
      socket.data.user = user;
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.data.user;
    socket.join(userRoom(user.id));
    const knownConversations = new Map();
    let lastTyping = 0;

    // Start receiving a community's live messages, after checking the person may read them.
    socket.on("community:join", async (id, ack) => {
      const reply = typeof ack === "function" ? ack : () => {};
      try {
        if (typeof id !== "string" || !UUID.test(id)) return reply({ ok: false });
        if (!(await isCommunityMember(user, id))) return reply({ ok: false });
        socket.join(`community:${id}`);
        reply({ ok: true });
      } catch {
        reply({ ok: false });
      }
    });
    socket.on("community:leave", (id) => {
      if (typeof id === "string") socket.leave(`community:${id}`);
    });

    // "X is typing…" signals, at most one every 1.5 seconds per connection.
    socket.on("typing", async (message) => {
      try {
        const now = Date.now();
        if (now - lastTyping < 1500 || !message || typeof message !== "object") return;
        lastTyping = now;
        const base = { user_id: user.id, name: user.name };
        if (message.scope === "dm" && UUID.test(String(message.conversation_id))) {
          const id = message.conversation_id;
          const cached = knownConversations.get(id);
          let members = cached && now - cached.at < 60000 ? cached.members : null;
          if (!members) {
            members = await conversationMembers(id);
            knownConversations.set(id, { members, at: now });
            if (knownConversations.size > 50) knownConversations.clear();
          }
          if (!members.includes(user.id)) return;
          const others = members.filter((member) => member !== user.id).map(userRoom);
          if (others.length) io.to(others).emit("typing", { ...base, scope: "dm", conversation_id: id });
        } else if (message.scope === "community" && UUID.test(String(message.community_id)) && UUID.test(String(message.chat_id))) {
          const room = `community:${message.community_id}`;
          if (!socket.rooms.has(room)) return;
          socket.to(room).emit("typing", { ...base, scope: "community", community_id: message.community_id, chat_id: message.chat_id });
        }
      } catch {
        /* a lost typing signal is harmless */
      }
    });
  });

  // Accounts can be suspended while connected: drop those sockets.
  const timer = setInterval(async () => {
    try {
      const sockets = await io.fetchSockets();
      const ids = [...new Set(sockets.map((socket) => socket.data.user.id))];
      if (!ids.length) return;
      const active = new Set(await activeUsers(ids));
      for (const id of ids) if (!active.has(id)) io.in(userRoom(id)).disconnectSockets(true);
    } catch {
      /* try again next time */
    }
  }, recheckEveryMs);
  timer.unref();

  return {
    io,
    close: () => {
      clearInterval(timer);
      return new Promise((resolve) => io.close(resolve));
    },
  };
}
